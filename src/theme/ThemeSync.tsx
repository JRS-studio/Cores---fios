import { useEffect } from 'react';
import { DevSettings, Platform } from 'react-native';

import { useSettings } from '@/features/settings/SettingsContext';
import { activeTheme } from './index';
import { readThemeSync, writeThemeSync } from './storage';

// Recarrega o app uma vez quando o tema salvo nos ajustes do studio é diferente do que está aplicado
// (os estilos são montados ao abrir o app). Só recarrega se conseguiu gravar, para nunca entrar em ciclo.
export function applyTheme(id: string) {
  if (id === activeTheme.id) return;
  writeThemeSync(id);
  if (readThemeSync() !== id) return;
  const g = globalThis as { location?: { reload: () => void } };
  if (Platform.OS === 'web' && g.location) g.location.reload();
  else DevSettings.reload();
}

export function ThemeSync() {
  const { settings, ready } = useSettings();
  useEffect(() => {
    if (ready) applyTheme(settings.theme);
  }, [ready, settings.theme]);
  return null;
}
