import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { toAuthPhone } from '@/data/supabase';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import type { Appointment } from '@/features/agenda/AppointmentsContext';
import { newId } from '@/utils/id';

// Pedido de cancelamento: só a profissional cancela; a cliente pede pelo app (e pelo WhatsApp) e o
// pedido aparece nos Avisos da profissional, que cancela ou mantém o horário.
export type CancelRequest = {
  id: string;
  appointmentId: string;
  clientPhone: string;
  clientName: string;
  createdAt: string;
  status: 'aberto' | 'resolvido';
};

const REMOTE: RemoteTable<CancelRequest> = {
  table: 'cancel_requests',
  toRow: (r) => ({ id: r.id, appointment_id: r.appointmentId, client_phone: toAuthPhone(r.clientPhone), status: r.status, data: r }),
};

type CancelRequestsApi = {
  // Pedidos em aberto, do mais antigo para o mais novo.
  open: CancelRequest[];
  openFor: (appointmentId: string) => CancelRequest | undefined;
  request: (a: Appointment) => Promise<boolean>;
  // A profissional resolve (cancelando ou mantendo o horário).
  resolveFor: (appointmentId: string) => void;
};

const CancelRequestsContext = createContext<CancelRequestsApi | null>(null);

export function CancelRequestsProvider({ children }: { children: ReactNode }) {
  const [all, commit] = useCollection<CancelRequest>(STORAGE_KEYS.cancelRequests, REMOTE);

  const api = useMemo<CancelRequestsApi>(() => {
    const open = all.filter((r) => r.status === 'aberto').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      open,
      openFor: (appointmentId) => open.find((r) => r.appointmentId === appointmentId),
      request: (a) => {
        if (open.some((r) => r.appointmentId === a.id)) return Promise.resolve(true);
        return commit([
          ...all,
          { id: newId(), appointmentId: a.id, clientPhone: a.clientPhone, clientName: a.clientName, createdAt: new Date().toISOString(), status: 'aberto' },
        ]);
      },
      resolveFor: (appointmentId) => {
        if (!open.some((r) => r.appointmentId === appointmentId)) return;
        commit(all.map((r) => (r.appointmentId === appointmentId && r.status === 'aberto' ? { ...r, status: 'resolvido' } : r)));
      },
    };
  }, [all, commit]);

  return <CancelRequestsContext.Provider value={api}>{children}</CancelRequestsContext.Provider>;
}

export function useCancelRequests() {
  const ctx = useContext(CancelRequestsContext);
  if (!ctx) throw new Error('useCancelRequests precisa estar dentro de CancelRequestsProvider');
  return ctx;
}
