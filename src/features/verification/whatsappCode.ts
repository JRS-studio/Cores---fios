// Verificação do número de WhatsApp por código de 6 dígitos: é a única validação de identidade
// da cliente (o app não pede documentos).
//
// Com servidor (Supabase), o código é enviado de verdade pelo WhatsApp e, ao confirmá-lo, a cliente
// fica logada. Sem servidor, o código é gerado no aparelho e devolvido em `testCode` para a tela mostrar.
import { supabase, toAuthPhone } from '@/data/supabase';

// Com servidor, o código pelo WhatsApp só é pedido quando o envio (Twilio) estiver ligado.
// Sem ele, a cliente entra só com o número, que fica preso ao aparelho (ver claim_phone no schema.sql).
export const CODE_BY_WHATSAPP = process.env.EXPO_PUBLIC_WHATSAPP_CODE === '1';

export type ConnectResult = 'ok' | 'taken' | 'error';

export async function connectPhoneWithoutCode(phone: string): Promise<ConnectResult> {
  if (!supabase) return 'error';
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return 'error';
  }
  const { error } = await supabase.rpc('claim_phone', { p_phone: toAuthPhone(phone) });
  if (error) return /phone_taken/.test(error.message) ? 'taken' : 'error';
  return 'ok';
}

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 30;
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Pending = { code: string; expiresAt: number; attempts: number };
const pending = new Map<string, Pending>();

// 'invalid': o servidor não diferencia código errado de expirado (responde igual aos dois).
export type CheckResult = 'ok' | 'wrong' | 'invalid' | 'expired' | 'blocked';

export async function requestCode(phone: string): Promise<{ testCode?: string; error?: string }> {
  if (supabase) {
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+${toAuthPhone(phone)}`,
      options: { channel: 'whatsapp' },
    });
    return error ? { error: 'Não foi possível enviar o código agora. Tente de novo em instantes.' } : {};
  }
  const code = String(Math.floor(Math.random() * 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
  pending.set(phone, { code, expiresAt: Date.now() + TTL_MS, attempts: 0 });
  return { testCode: code };
}

export async function checkCode(phone: string, code: string): Promise<CheckResult> {
  if (supabase) {
    const { error } = await supabase.auth.verifyOtp({ phone: `+${toAuthPhone(phone)}`, token: code, type: 'sms' });
    if (!error) return 'ok';
    return error.status === 429 || /rate|too many/i.test(error.message) ? 'blocked' : 'invalid';
  }
  const entry = pending.get(phone);
  if (!entry || Date.now() > entry.expiresAt) return 'expired';
  if (entry.attempts >= MAX_ATTEMPTS) return 'blocked';
  if (entry.code !== code) {
    entry.attempts += 1;
    return entry.attempts >= MAX_ATTEMPTS ? 'blocked' : 'wrong';
  }
  pending.delete(phone);
  return 'ok';
}
