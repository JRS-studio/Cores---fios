import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { usePersisted } from '@/data/usePersisted';

export type Settings = {
  professionalName: string;
  studioName: string;
  monthlyGoal: number;
  openTime: string; // HH:MM
  closeTime: string; // HH:MM
  workDays: number[]; // 0 = domingo
  slotStep: number; // minutos entre horários oferecidos
};

export const DEFAULT_SETTINGS: Settings = {
  professionalName: 'Juliana',
  studioName: 'Studio Cores & Fios',
  monthlyGoal: 6000,
  openTime: '09:00',
  closeTime: '19:00',
  workDays: [1, 2, 3, 4, 5, 6],
  slotStep: 30,
};

type SettingsApi = { settings: Settings; ready: boolean; saveSettings: (s: Settings) => void };

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, commit, ready] = usePersisted<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const api = useMemo(() => ({ settings: { ...DEFAULT_SETTINGS, ...stored }, ready, saveSettings: commit }), [stored, ready, commit]);
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings precisa estar dentro de SettingsProvider');
  return ctx;
}
