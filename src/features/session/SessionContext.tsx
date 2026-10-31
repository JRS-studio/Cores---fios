import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
};

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(isRemote ? 'visitante' : 'local');
  const [phone, setPhone] = useState<string | null>(null);
  const [ready, setReady] = useState(!isRemote);

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    const resolve = async (session: Session | null) => {
      if (!session) {
        setRole('visitante');
        setPhone(null);
      } else {
        const { data: owner } = await db.rpc('is_owner');
        setPhone(session.user.phone ? fromAuthPhone(session.user.phone) : null);
        setRole(owner ? 'profissional' : session.user.phone ? 'cliente' : 'visitante');
      }
      setReady(true);
    };
    db.auth.getSession().then(({ data }) => resolve(data.session));
    // Chamadas ao Supabase dentro do aviso de login travam a sessão; por isso o setTimeout.
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => resolve(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

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
        await supabase?.auth.signOut();
      },
    }),
    [ready, role, phone],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de SessionProvider');
  return ctx;
}
