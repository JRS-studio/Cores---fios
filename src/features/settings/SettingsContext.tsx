import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { supabase } from '@/data/supabase';
import { reportSyncError } from '@/data/syncStatus';
import { usePersisted } from '@/data/usePersisted';
import { DEFAULT_EXTRA_BENEFITS, DEFAULT_LOYALTY, migrateLoyalty, premiumBenefits, withoutOldBenefits, type LoyaltyRules } from '@/data/loyalty';
import { DEFAULT_SERVICES, type Service } from '@/data/services';
import { toMinutes, toTime, weekdayOf } from '@/utils/date';

export type Settings = {
  professionalName: string;
  studioName: string;
  monthlyGoal: number;
  openTime: string; // HH:MM
  closeTime: string; // HH:MM
  workDays: number[]; // 0 = domingo
  slotStep: number; // minutos entre horários oferecidos (0 = horários colados: o próximo começa quando o anterior termina)
  services: Service[];
  // Horários que a cliente pode escolher, por dia da semana ('0' = domingo). Dia sem lista: todos os livres.
  clientSlots: Record<string, string[]>;
  // WhatsApp da profissional (só dígitos, com DDD): recebe o aviso de cada novo agendamento.
  whatsapp: string;
  loyalty: LoyaltyRules;
  extraBenefits: string[];
  // Tema do app escolhido pela profissional (vale para todas as clientes).
  theme: string;
  // Perfil do studio no Instagram (só o @, sem link).
  instagram: string;
  // Pausas fixas (ex.: almoço) nos dias da semana escolhidos.
  breaks: BreakRule[];
  // Bloqueios de um dia específico (consulta, folga…). Dia inteiro: allDay.
  blocks: Block[];
};

export type BreakRule = { id: string; label: string; days: number[]; start: string; end: string };
export type Block = { id: string; date: string; start: string; end: string; allDay?: boolean; label?: string };

export const DEFAULT_SETTINGS: Settings = {
  professionalName: 'Jhenifer',
  studioName: 'Studio Cores & Fios',
  monthlyGoal: 6000,
  openTime: '09:00',
  closeTime: '19:00',
  workDays: [1, 2, 3, 4, 5, 6],
  slotStep: 30,
  services: DEFAULT_SERVICES,
  clientSlots: {},
  whatsapp: '',
  loyalty: DEFAULT_LOYALTY,
  extraBenefits: DEFAULT_EXTRA_BENEFITS,
  breaks: [],
  blocks: [],
  theme: 'rose',
  instagram: 'js.cooresefios',
};

type SettingsApi = { settings: Settings; ready: boolean; saveSettings: (s: Settings) => Promise<void> };

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, commit, ready] = usePersisted<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

  // Com servidor, os ajustes ficam numa linha única, lida por todas e alterada só pela profissional.
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    const fetchSettings = async () => {
      const { data, error } = await db.from('settings').select('data').eq('id', 1).maybeSingle();
      if (error) reportSyncError(error);
      else if (data) commit(data.data as Settings);
    };
    fetchSettings();
    const channel = db
      .channel('sync-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchSettings)
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [commit]);

  const saveSettings = useCallback(
    (next: Settings) => {
      commit(next);
      // Devolve a gravação no servidor, para quem precisa esperar (ex.: antes de recarregar o app).
      if (!supabase) return Promise.resolve();
      return Promise.resolve(supabase.from('settings').upsert({ id: 1, data: next })).then(({ error }) => {
        if (error) reportSyncError(error);
      });
    },
    [commit],
  );

  // Ajustes salvos antes de um campo existir ganham o valor padrão dele.
  const api = useMemo(
    () => ({
      settings: {
        ...DEFAULT_SETTINGS,
        ...stored,
        loyalty: migrateLoyalty(stored.loyalty),
        extraBenefits: withoutOldBenefits(stored.extraBenefits ?? DEFAULT_EXTRA_BENEFITS),
      },
      ready,
      saveSettings,
    }),
    [stored, ready, saveSettings],
  );
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings precisa estar dentro de SettingsProvider');
  return ctx;
}

export function useLoyalty() {
  return useSettings().settings.loyalty;
}

export function usePremiumBenefits() {
  const { settings } = useSettings();
  return premiumBenefits(settings.loyalty, settings.extraBenefits);
}

export const serviceIn = (settings: Settings, id?: string) => settings.services.find((s) => s.id === id);

// Horários liberados para a cliente naquele dia (null = todos os livres).
// Passo da grade de horários das telas de ajuste e da agenda do dia (com 0 min, a grade usa 15 min).
export const gridStep = (settings: Settings) => (settings.slotStep > 0 ? settings.slotStep : 15);

// O horário está entre os liberados para as clientes? Com horários colados (0 min), o início pode cair
// fora da grade (ex.: 7:40): vale o bloco da grade em que ele começa (7:30).
export function isReleasedTime(settings: Settings, released: string[], time: string) {
  if (released.includes(time)) return true;
  if (settings.slotStep > 0) return false;
  const step = gridStep(settings);
  return released.includes(toTime(Math.floor(toMinutes(time) / step) * step));
}

export function releasedSlots(settings: Settings, date: string): string[] | null {
  return settings.clientSlots[String(weekdayOf(date))] ?? null;
}

// Intervalos (em minutos) em que ninguém pode ser atendido naquele dia: pausas e bloqueios.
export type Unavailable = { start: number; end: number; kind: 'pausa' | 'bloqueio'; label: string; id: string };

export function unavailableOn(settings: Settings, date: string): Unavailable[] {
  const wd = weekdayOf(date);
  const open = toMinutes(settings.openTime);
  const close = toMinutes(settings.closeTime);
  return [
    ...settings.breaks
      .filter((b) => b.days.includes(wd))
      .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end), kind: 'pausa' as const, label: b.label || 'Pausa', id: b.id })),
    ...settings.blocks
      .filter((b) => b.date === date)
      .map((b) => ({
        start: b.allDay ? open : toMinutes(b.start),
        end: b.allDay ? close : toMinutes(b.end),
        kind: 'bloqueio' as const,
        label: b.label || (b.allDay ? 'Dia bloqueado' : 'Bloqueado'),
        id: b.id,
      })),
  ];
}

export const isDayBlocked = (settings: Settings, date: string) => settings.blocks.some((b) => b.date === date && b.allDay);

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle.replace(/^@/, '').trim()}/`;
