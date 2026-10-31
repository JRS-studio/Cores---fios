import { useEffect } from 'react';
import { DevSettings, Platform } from 'react-native';

import { useSettings } from '@/features/settings/SettingsContext';
import { activeTheme, storedTheme } from './index';
import { readStoredTheme, writeStoredTheme } from './storage';

// Os estilos são montados ao abrir o app: trocar de tema grava a escolha e recarrega uma vez.
// Só recarrega se conseguiu gravar, para nunca entrar em ciclo.
export function applyTheme(id: string, personal: boolean) {
  writeStoredTheme({ id, personal });
  const saved = readStoredTheme();
  if (saved?.id !== id || saved.personal !== personal || id === activeTheme.id) return;
  const g = globalThis as { location?: { reload: () => void } };
  if (Platform.OS === 'web' && g.location) g.location.reload();
  else DevSettings.reload();
}

// Quem ainda não escolheu um tema segue o padrão do studio (definido pela profissional).
export function ThemeSync() {
  const { settings, ready } = useSettings();
  useEffect(() => {
    if (ready && !storedTheme?.personal) applyTheme(settings.theme, false);
  }, [ready, settings.theme]);
  return null;
}
