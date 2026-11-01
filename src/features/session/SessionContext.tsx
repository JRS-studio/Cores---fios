import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fromAuthPhone, isRemote, supabase } from '@/data/supabase';
import { forgetReminders } from '@/features/reminders/push';
import { disableBiometric } from '@/features/session/biometric';

// local: sem servidor, o app é da profissional e funciona só no aparelho (como antes).
// profissional / cliente / visitante: com servidor, cada uma vê o que as regras do banco permitem.
export type Role = 'local' | 'profissional' | 'cliente' | 'visitante';

type SessionApi = {
  ready: boolean;
  remote: boolean;
  role: Role;
  // WhatsApp da cliente logada (só dígitos, sem o 55).
  phone: string | null;
  // Quem está usando (id do login no servidor; 'local' sem servidor). Usado nas curtidas.
  userId: string | null;
  canManage: boolean;
  signInProfessional: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  // Relê o login (ex.: depois de ligar o número ao aparelho).
  refresh: () => Promise<void>;
  // Garante um login (anônimo, sem pedir nada) para quem só quer curtir uma publicação.
  ensureUser: () => Promise<string | null>;
};

// O Supabase só entra com e-mail: um login curto (ex.: "Jhenifer") vira jhenifer@coresefios.app,
// que é o e-mail cadastrado para a profissional em Authentication › Users.
export const LOGIN_DOMAIN = 'coresefios.app';
export function loginToEmail(login: string) {
  const value = login.trim().toLowerCase();
  if (value.includes('@')) return value;
  const user = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]/g, '');
  return `${user}@${LOGIN_DOMAIN}`;
}

const SessionContext = createContext<SessionApi | null>(null);

// Quem estava logada neste aparelho na última vez. O app abre direto como essa pessoa (sem mostrar
// por um instante o perfil do studio, com o nome da profissional) e confere com o servidor em seguida.
const CACHE_KEY = 'cores:sessao:v1';
type Cached = { role: Role; phone: string | null; userId: string | null };
const storage = () => (globalThis as { localStorage?: Storage }).localStorage;
function readCache(): Cached | null {
  try {
    const raw = storage()?.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}
function writeCache(value: Cached | null) {
  try {
    if (value) storage()?.setItem(CACHE_KEY, JSON.stringify(value));
    else storage()?.removeItem(CACHE_KEY);
  } catch {
    // Sem armazenamento: só não lembra.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [cached] = useState(() => (isRemote ? readCache() : null));
  const [role, setRole] = useState<Role>(isRemote ? (cached?.role ?? 'visitante') : 'local');
  const [phone, setPhone] = useState<string | null>(cached?.phone ?? null);
  const [userId, setUserId] = useState<string | null>(isRemote ? (cached?.userId ?? null) : 'local');
  const [ready, setReady] = useState(!isRemote || !!cached);

  const resolve = useCallback(async (session: Session | null) => {
    if (!supabase) return;
    if (!session) {
      setUserId(null);
      setRole('visitante');
      setPhone(null);
      writeCache(null);
      setReady(true);
      return;
    }
    const { data: owner, error: ownerError } = await supabase.rpc('is_owner');
    // Número confirmado por código (no login) ou preso a este aparelho (entrada sem código).
    let authPhone = session.user.phone || null;
    let claimError = null;
    if (!authPhone && !owner) {
      const { data, error } = await supabase.from('phone_claims').select('phone').eq('user_id', session.user.id).maybeSingle();
      authPhone = data?.phone ?? null;
      claimError = error;
    }
    // Sem resposta do servidor (internet fraca): mantém quem já estava logada em vez de trocar de perfil.
    if (ownerError || claimError) {
      setReady(true);
      return;
    }
    const next: Cached = {
      role: owner ? 'profissional' : authPhone ? 'cliente' : 'visitante',
      phone: owner ? null : authPhone ? fromAuthPhone(authPhone) : null,
      userId: session.user.id,
    };
    setUserId(next.userId);
    setPhone(next.phone);
    setRole(next.role);
    writeCache(next);
    setReady(true);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    await resolve(data.session);
  }, [resolve]);

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    db.auth.getSession().then(({ data }) => resolve(data.session));
    // Chamadas ao Supabase dentro do aviso de login travam a sessão; por isso o setTimeout.
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => resolve(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [resolve]);

  const api = useMemo<SessionApi>(
    () => ({
      ready,
      remote: isRemote,
      role,
      phone,
      canManage: role === 'local' || role === 'profissional',
      signInProfessional: async (email, password) => {
        if (!supabase) return 'O app ainda não está ligado ao servidor.';
        const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(email), password });
        return error ? 'Login ou senha incorretos.' : null;
      },
      signOut: async () => {
        // A cliente solta o número ao sair, para poder entrar de novo em qualquer aparelho.
        if (role === 'cliente') {
          await forgetReminders();
          await supabase?.rpc('release_my_phone');
        }
        // Quem sai entra de novo com login e senha (e pode ativar a biometria outra vez).
        disableBiometric();
        // Sai só deste aparelho. O padrão do Supabase ("global") desconectava a profissional de todos os
        // celulares ao tocar em Sair em um deles (e o app passava a mostrar a versão da cliente).
        await supabase?.auth.signOut({ scope: 'local' });
      },
      refresh,
      userId,
      ensureUser: async () => {
        if (!supabase || userId) return userId;
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) return null;
        setUserId(data.user.id);
        return data.user.id;
      },
    }),
    [ready, role, phone, userId, refresh],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de SessionProvider');
  return ctx;
}
