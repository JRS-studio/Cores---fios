import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fromAuthPhone, isRemote, supabase } from '@/data/supabase';

// local: sem servidor, o app é da profissional e funciona só no aparelho (como antes).
// profissional / cliente / visitante: com servidor, cada uma vê o que as regras do banco permitem.
export type Role = 'local' | 'profissional' | 'cliente' | 'visitante';

type SessionApi = {
  ready: boolean;
  remote: boolean;
  role: Role;
  // WhatsApp da cliente logada (só dígitos, sem o 55).
  phone: string | null;
  canManage: boolean;
  signInProfessional: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  // Relê o login (ex.: depois de ligar o número ao aparelho).
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(isRemote ? 'visitante' : 'local');
  const [phone, setPhone] = useState<string | null>(null);
  const [ready, setReady] = useState(!isRemote);

  const resolve = useCallback(async (session: Session | null) => {
    if (!supabase) return;
    if (!session) {
      setRole('visitante');
      setPhone(null);
    } else {
      const { data: owner } = await supabase.rpc('is_owner');
      // Número confirmado por código (no login) ou preso a este aparelho (entrada sem código).
      let authPhone = session.user.phone || null;
      if (!authPhone) {
        const { data } = await supabase.from('phone_claims').select('phone').eq('user_id', session.user.id).maybeSingle();
        authPhone = data?.phone ?? null;
      }
      setPhone(authPhone ? fromAuthPhone(authPhone) : null);
      setRole(owner ? 'profissional' : authPhone ? 'cliente' : 'visitante');
    }
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
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error ? 'E-mail ou senha incorretos.' : null;
      },
      signOut: async () => {
        // A cliente solta o número ao sair, para poder entrar de novo em qualquer aparelho.
        if (role === 'cliente') await supabase?.rpc('release_my_phone');
        await supabase?.auth.signOut();
      },
      refresh,
    }),
    [ready, role, phone, refresh],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de SessionProvider');
  return ctx;
}
