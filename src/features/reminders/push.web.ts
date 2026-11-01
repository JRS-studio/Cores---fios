import { supabase } from '@/data/supabase';

// Lembretes no navegador (Web Push): o celular guarda uma "inscrição" que o servidor usa para
// mandar a notificação 1 hora antes do horário, mesmo com o site fechado.
export type ReminderState = 'unsupported' | 'install' | 'off' | 'on' | 'denied' | 'not-ready' | 'error';

type Nav = Navigator & { standalone?: boolean };

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isInstalled = () => (navigator as Nav).standalone === true || matchMedia('(display-mode: standalone)').matches;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// O service worker fica ao lado do manifest.json (no GitHub Pages, dentro do subcaminho do site).
function workerUrl() {
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const base = manifest ? new URL('.', manifest.href).href : `${location.origin}/`;
  return { url: `${base}sw.js`, scope: base };
}

async function registration() {
  const { url, scope } = workerUrl();
  return (await navigator.serviceWorker.getRegistration(scope)) ?? navigator.serviceWorker.register(url, { scope });
}

// Permissão de notificações. A API de permissões é mais confiável que Notification.permission em alguns navegadores.
async function permission(): Promise<NotificationPermission> {
  try {
    const status = await navigator.permissions.query({ name: 'notifications' });
    return status.state === 'prompt' ? 'default' : status.state;
  } catch {
    return Notification.permission;
  }
}

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function getReminderState(): Promise<ReminderState> {
  try {
    if (!supabase) return 'unsupported';
    // No iPhone, só o app adicionado à Tela de Início recebe notificações.
    if (!supported()) return isIOS() && !isInstalled() ? 'install' : 'unsupported';
    const current = await permission();
    if (current === 'denied') return 'denied';
    if (current !== 'granted') return 'off';
    const reg = await navigator.serviceWorker.getRegistration(workerUrl().scope);
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch {
    return 'unsupported';
  }
}

// Precisa ser chamada a partir de um toque (o navegador só pede permissão assim).
// forOwner: celular da profissional, que recebe os avisos de cancelamento (e não lembretes de um número).
export async function enableReminders(forOwner = false): Promise<ReminderState> {
  if (!supabase || !supported()) return getReminderState();
  try {
    if ((await permission()) !== 'granted') await Notification.requestPermission();
    const answer = await permission();
    if (answer !== 'granted') return answer === 'denied' ? 'denied' : 'off';
    const { data: key } = await supabase.rpc('vapid_public_key');
    if (!key) return 'not-ready';
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key as string) }));
    const json = sub.toJSON();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, ...(forOwner ? { phone: 'profissional' } : {}) },
        { onConflict: 'endpoint', ignoreDuplicates: true },
      );
    if (error) return 'error';
    return 'on';
  } catch {
    return 'error';
  }
}

export async function disableReminders(): Promise<ReminderState> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(workerUrl().scope);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    return 'off';
  } catch {
    return 'error';
  }
}

// Ao sair da conta: este celular para de receber os lembretes do número.
export async function forgetReminders() {
  await disableReminders();
}
