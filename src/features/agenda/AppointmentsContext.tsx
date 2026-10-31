import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { supabase, toAuthPhone } from '@/data/supabase';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import { unavailableOn, type Settings } from '@/features/settings/SettingsContext';
import { today, toMinutes, toTime, weekdayOf } from '@/utils/date';

export type AppointmentStatus = 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou';

export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito';

export type Appointment = {
  id: string;
  createdAt: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  serviceId?: string;
  serviceName: string;
  price: number;
  duration: number; // minutos
  date: string; // AAAA-MM-DD
  time: string; // HH:MM
  status: AppointmentStatus;
  notes?: string;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  agendado: 'A confirmar',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
};

// Ocupam a agenda: tudo que não foi cancelado nem marcado como falta.
export const isActive = (a: Appointment) => a.status !== 'cancelado' && a.status !== 'faltou';

type AppointmentsApi = {
  ready: boolean;
  appointments: Appointment[];
  getAppointment: (id: string) => Appointment | undefined;
  forDate: (date: string) => Appointment[];
  saveAppointment: (a: Appointment) => void;
  updateStatus: (id: string, status: AppointmentStatus, extra?: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
  availableSlots: (date: string, duration: number, settings: Settings, ignoreId?: string) => string[];
  // Com servidor: busca os horários ocupados do dia (de todas as clientes, sem dados de quem marcou).
  loadBusy: (date: string) => Promise<void>;
};

const AppointmentsContext = createContext<AppointmentsApi | null>(null);

const REMOTE: RemoteTable<Appointment> = {
  table: 'appointments',
  toRow: (a) => ({
    id: a.id,
    client_phone: toAuthPhone(a.clientPhone),
    status: a.status,
    starts_at: `${a.date} ${a.time}`,
    ends_at: `${a.date} ${toTime(toMinutes(a.time) + a.duration)}`,
    data: a,
  }),
};

const byTime = (a: Appointment, b: Appointment) => (a.date + a.time).localeCompare(b.date + b.time);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const [appointments, commit, ready] = useCollection<Appointment>(STORAGE_KEYS.appointments, REMOTE);
  const [remoteBusy, setRemoteBusy] = useState<Record<string, [number, number][]>>({});

  const loadBusy = useCallback(async (date: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('busy_slots', { day: date });
    if (error || !data) return;
    const minutes = (ts: string) => toMinutes(ts.slice(11, 16));
    setRemoteBusy((prev) => ({
      ...prev,
      [date]: (data as { starts_at: string; ends_at: string }[]).map((b) => [minutes(b.starts_at), minutes(b.ends_at)]),
    }));
  }, []);

  const api = useMemo<AppointmentsApi>(
    () => ({
      ready,
      appointments,
      getAppointment: (id) => appointments.find((a) => a.id === id),
      forDate: (date) => appointments.filter((a) => a.date === date).sort(byTime),
      saveAppointment: (appt) => {
        const exists = appointments.some((a) => a.id === appt.id);
        commit(exists ? appointments.map((a) => (a.id === appt.id ? appt : a)) : [...appointments, appt]);
      },
      updateStatus: (id, status, extra) =>
        commit(appointments.map((a) => (a.id === id ? { ...a, ...extra, status } : a))),
      removeAppointment: (id) => commit(appointments.filter((a) => a.id !== id)),
      availableSlots: (date, duration, settings, ignoreId) => {
        if (!settings.workDays.includes(weekdayOf(date))) return [];
        const open = toMinutes(settings.openTime);
        const close = toMinutes(settings.closeTime);
        const ignored = appointments.find((a) => a.id === ignoreId);
        const ignoredRange = ignored ? [toMinutes(ignored.time), toMinutes(ignored.time) + ignored.duration] : null;
        const busy = [
          ...appointments
            .filter((a) => a.date === date && a.id !== ignoreId && isActive(a))
            .map((a) => [toMinutes(a.time), toMinutes(a.time) + a.duration]),
          // Do servidor vem também o próprio horário que está sendo remarcado: ele não conta como ocupado.
          ...(remoteBusy[date] ?? []).filter(
            ([s, e]) => !(ignored?.date === date && ignoredRange && s === ignoredRange[0] && e === ignoredRange[1]),
          ),
          // Pausas fixas e bloqueios da profissional.
          ...unavailableOn(settings, date).map((u) => [u.start, u.end]),
        ];
        const now = new Date();
        const nowMinutes = date === today() ? now.getHours() * 60 + now.getMinutes() : -1;
        const slots: string[] = [];
        for (let start = open; start + duration <= close; start += settings.slotStep) {
          const end = start + duration;
          if (start <= nowMinutes) continue;
          if (busy.some(([s, e]) => start < e && end > s)) continue;
          slots.push(toTime(start));
        }
        return slots;
      },
      loadBusy,
    }),
    [appointments, commit, ready, remoteBusy, loadBusy],
  );

  return <AppointmentsContext.Provider value={api}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error('useAppointments precisa estar dentro de AppointmentsProvider');
  return ctx;
}
