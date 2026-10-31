import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { supabase } from '@/data/supabase';
import { reportSyncError } from '@/data/syncStatus';
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
  professionalName: 'Jhenifer',
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
      supabase?.from('settings').upsert({ id: 1, data: next }).then(({ error }) => error && reportSyncError(error));
    },
    [commit],
  );

  const api = useMemo(() => ({ settings: { ...DEFAULT_SETTINGS, ...stored }, ready, saveSettings }), [stored, ready, saveSettings]);
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings precisa estar dentro de SettingsProvider');
  return ctx;
}
