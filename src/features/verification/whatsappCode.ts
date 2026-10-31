// Verificação do número de WhatsApp por código de 6 dígitos: é a única validação de identidade
// da cliente (o app não pede documentos).
//
// Esta versão roda só no aparelho, sem servidor: o código é gerado aqui e devolvido em `testCode`
// para a tela mostrar. Ao ligar o app a um servidor, `requestCode` passa a pedir o envio pela API
// do WhatsApp Business (ou SMS) e `checkCode` passa a conferir lá; as telas não mudam.

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 30;
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Pending = { code: string; expiresAt: number; attempts: number };
const pending = new Map<string, Pending>();

export type CheckResult = 'ok' | 'wrong' | 'expired' | 'blocked';

export async function requestCode(phone: string): Promise<{ testCode: string }> {
  const code = String(Math.floor(Math.random() * 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
  pending.set(phone, { code, expiresAt: Date.now() + TTL_MS, attempts: 0 });
  return { testCode: code };
}

export async function checkCode(phone: string, code: string): Promise<CheckResult> {
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
