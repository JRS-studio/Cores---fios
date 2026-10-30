import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { usePersisted } from '@/data/usePersisted';
import type { Settings } from '@/features/settings/SettingsContext';
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
  agendado: 'Agendado',
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
};

const AppointmentsContext = createContext<AppointmentsApi | null>(null);

const byTime = (a: Appointment, b: Appointment) => (a.date + a.time).localeCompare(b.date + b.time);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const [appointments, commit, ready] = usePersisted<Appointment[]>(STORAGE_KEYS.appointments, []);

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
        const busy = appointments
          .filter((a) => a.date === date && a.id !== ignoreId && isActive(a))
          .map((a) => [toMinutes(a.time), toMinutes(a.time) + a.duration]);
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
    }),
    [appointments, commit, ready],
  );

  return <AppointmentsContext.Provider value={api}>{children}</AppointmentsContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error('useAppointments precisa estar dentro de AppointmentsProvider');
  return ctx;
}
