import { Platform } from 'react-native';

// Instalação do app na tela inicial (versão web, PWA).
// Android/Chrome: o navegador avisa que dá para instalar ("beforeinstallprompt") e o botão abre a
// janela de instalação dele. iPhone: não existe essa janela; o botão mostra o passo a passo do Safari.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const g = globalThis as {
  window?: Window;
  navigator?: Navigator & { standalone?: boolean; maxTouchPoints?: number };
  matchMedia?: (q: string) => MediaQueryList;
  localStorage?: Storage;
};

let deferred: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Registrado logo que o app carrega (importado no _layout), para não perder o aviso do navegador.
if (Platform.OS === 'web' && g.window) {
  g.window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    notify();
  });
  g.window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function onInstallChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type Device = 'ios' | 'android' | 'outro';

export function device(): Device {
  const ua = g.navigator?.userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (g.navigator?.maxTouchPoints ?? 0) > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'outro';
}

// Navegador de dentro de outro app (Instagram, Facebook…), onde não dá para instalar.
export function inAppBrowser() {
  return /Instagram|FBAN|FBAV|Line\/|Snapchat|TikTok/i.test(g.navigator?.userAgent ?? '');
}

// Já está aberto como app instalado (pelo ícone da tela inicial)?
export function runningInstalled() {
  if (Platform.OS !== 'web') return true;
  return installed || !!g.navigator?.standalone || !!g.matchMedia?.('(display-mode: standalone)').matches;
}

export const canPromptInstall = () => deferred !== null;

// Abre a janela de instalação do navegador (Android/Chrome). true = instalou.
export async function promptInstall() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') installed = true;
  notify();
  return outcome === 'accepted';
}

// "Agora não": o cartão some por alguns dias.
const DISMISS_KEY = 'cores:instalar-dispensado';
const DISMISS_DAYS = 7;

export function installDismissed() {
  const at = Number(g.localStorage?.getItem(DISMISS_KEY) ?? 0);
  return at > 0 && Date.now() - at < DISMISS_DAYS * 86400000;
}

export function dismissInstall() {
  try {
    g.localStorage?.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Nada a fazer.
  }
}
