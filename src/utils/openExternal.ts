import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Abre WhatsApp, Instagram e outros links fora do app. No navegador, em outra aba: o Linking do Expo
// trocaria a própria página do app (e cortaria um salvamento que ainda estivesse em andamento).
export function openExternal(url: string) {
  const w = globalThis as { open?: (url: string, target: string, features?: string) => unknown };
  if (Platform.OS === 'web' && w.open) {
    w.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url);
}
