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
  // Desconto de aniversário da cliente Premium (%) e o valor cheio do serviço antes dele.
  birthdayDiscount?: number;
  fullPrice?: number;
  // Cashback que a cliente escolheu usar neste horário (sai do saldo quando o atendimento é concluído).
  cashbackUse?: number;
  // Cashback usado e ganho, gravados quando a profissional conclui o atendimento.
  cashbackUsed?: number;
  cashbackEarned?: number;
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
    // Cliente avulsa sem WhatsApp: fica vazio (nenhuma cliente logada tem número vazio, então ninguém mais vê).
    client_phone: a.clientPhone ? toAuthPhone(a.clientPhone) : '',
    status: a.status,
    starts_at: `${a.date} ${a.time}`,
    ends_at: `${a.date} ${toTime(toMinutes(a.time) + a.duration)}`,
    data: a,
  }),
};

const isComplete = (a: Appointment) =>
  !!a && typeof a.id === 'string' && typeof a.date === 'string' && typeof a.time === 'string' && typeof a.duration === 'number';

const byTime = (a: Appointment, b: Appointment) => (a.date + a.time).localeCompare(b.date + b.time);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const [stored, commitStored, ready] = useCollection<Appointment>(STORAGE_KEYS.appointments, REMOTE);
  // Registros incompletos (ex.: sobras de testes no banco) ficam de fora: sem data e horário, quebrariam a agenda.
  const appointments = useMemo(() => stored.filter(isComplete), [stored]);
  // Ao gravar, os incompletos voltam junto (o app só não os usa; não apaga nada do banco por conta própria).
  const commit = useCallback(
    (next: Appointment[]) => commitStored([...next, ...stored.filter((a) => !isComplete(a))]),
    [commitStored, stored],
  );
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
        // Só ao remarcar existe um horário a ignorar (sem o id, um registro sem id seria encontrado por engano).
        const ignored = ignoreId ? appointments.find((a) => a.id === ignoreId) : undefined;
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
        if (settings.slotStep > 0) {
          for (let start = open; start + duration <= close; start += settings.slotStep) {
            const end = start + duration;
            if (start <= nowMinutes) continue;
            if (busy.some(([s, e]) => start < e && end > s)) continue;
            slots.push(toTime(start));
          }
          return slots;
        }
        // 0 min (horários colados): cada horário começa quando o anterior termina; se esbarra num
        // atendimento, pausa ou bloqueio, o próximo começa logo depois dele.
        const length = Math.max(duration, 5);
        let start = open;
        while (start + length <= close) {
          if (start <= nowMinutes) {
            start = Math.ceil((nowMinutes + 1) / 5) * 5;
            continue;
          }
          const clash = busy.find(([s, e]) => start < e && start + length > s);
          if (clash) {
            start = clash[1];
            continue;
          }
          slots.push(toTime(start));
          start += length;
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
