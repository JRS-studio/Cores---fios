// No app instalado (Android/iOS) os lembretes ainda não estão disponíveis: a versão usada pelas
// clientes é a web (push.web.ts). Para o app das lojas, o caminho é o expo-notifications.
export type ReminderState = 'unsupported' | 'install' | 'off' | 'on' | 'denied' | 'not-ready' | 'error';

export async function getReminderState(): Promise<ReminderState> {
  return 'unsupported';
}

export async function enableReminders(): Promise<ReminderState> {
  return 'unsupported';
}

export async function disableReminders(): Promise<ReminderState> {
  return 'unsupported';
}

export async function forgetReminders() {}
