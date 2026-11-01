import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { toAuthPhone } from '@/data/supabase';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import { useAppointments, type Appointment } from '@/features/agenda/AppointmentsContext';

// Cashback do Premium: a cada atendimento pago, a cliente Premium ganha uma porcentagem do valor
// (Ajustes › Cashback e benefícios). O saldo é um extrato: créditos (+) e usos (−).
// No servidor, só a profissional grava no extrato; a cliente só lê o dela (Row Level Security).
// Ela escolhe usar o saldo ao agendar; o valor só sai do extrato quando a profissional conclui o atendimento.
export type CashbackEntry = {
  id: string;
  createdAt: string;
  clientPhone: string; // só dígitos
  clientName: string;
  amount: number; // + crédito, − uso
  kind: 'credito' | 'uso';
  appointmentId?: string;
  description: string;
};

const REMOTE: RemoteTable<CashbackEntry> = {
  table: 'cashback',
  toRow: (e) => ({ id: e.id, client_phone: toAuthPhone(e.clientPhone), data: e }),
};

export const roundCents = (v: number) => Math.round(v * 100) / 100;

// Valor do cashback que um atendimento pago gera.
export const cashbackFor = (paid: number, percent: number) => (percent > 0 && paid > 0 ? roundCents((paid * percent) / 100) : 0);

const isOpen = (a: Appointment) => a.status === 'agendado' || a.status === 'confirmado';

type CashbackApi = {
  ready: boolean;
  entries: CashbackEntry[];
  // Extrato de uma cliente, do mais novo para o mais antigo.
  historyOf: (phone: string) => CashbackEntry[];
  // Saldo no extrato.
  balanceOf: (phone: string) => number;
  // Separado para horários marcados que ainda não aconteceram.
  reservedOf: (phone: string, ignoreAppointmentId?: string) => number;
  // O que dá para usar num novo agendamento: saldo − reservado.
  availableOf: (phone: string, ignoreAppointmentId?: string) => number;
  addEntries: (entries: CashbackEntry[]) => void;
};

const CashbackContext = createContext<CashbackApi | null>(null);

export function CashbackProvider({ children }: { children: ReactNode }) {
  const [entries, commit, ready] = useCollection<CashbackEntry>(STORAGE_KEYS.cashback, REMOTE);
  const { appointments } = useAppointments();

  const api = useMemo<CashbackApi>(() => {
    const balanceOf = (phone: string) => roundCents(entries.filter((e) => e.clientPhone === phone).reduce((sum, e) => sum + e.amount, 0));
    const reservedOf = (phone: string, ignore?: string) =>
      roundCents(
        appointments
          .filter((a) => a.clientPhone === phone && a.id !== ignore && isOpen(a))
          .reduce((sum, a) => sum + (a.cashbackUse ?? 0), 0),
      );
    return {
      ready,
      entries,
      historyOf: (phone) => entries.filter((e) => e.clientPhone === phone).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      balanceOf,
      reservedOf,
      availableOf: (phone, ignore) => Math.max(0, roundCents(balanceOf(phone) - reservedOf(phone, ignore))),
      addEntries: (list) => {
        if (list.length) commit([...list, ...entries]);
      },
    };
  }, [entries, commit, ready, appointments]);

  return <CashbackContext.Provider value={api}>{children}</CashbackContext.Provider>;
}

export function useCashback() {
  const ctx = useContext(CashbackContext);
  if (!ctx) throw new Error('useCashback precisa estar dentro de CashbackProvider');
  return ctx;
}
