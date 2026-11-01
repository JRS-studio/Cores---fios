import { Platform } from 'react-native';

// Entrada da profissional pela biometria do celular (Face ID, digital), na versão web.
// O login continua guardado no aparelho; a biometria é a trava que abre o app.
// Usa a mesma tecnologia das chaves de acesso (WebAuthn): o próprio celular confere o rosto ou a
// digital e só responde "ok" para quem passou. Nada da biometria sai do aparelho.
const KEY = 'cores:biometria:v1';

type Stored = { credentialId: string };

const storage = () => (globalThis as { localStorage?: Storage }).localStorage;
const creds = () => (globalThis as { navigator?: Navigator }).navigator?.credentials;

const toB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function read(): Stored | null {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function biometricEnabled() {
  return Platform.OS === 'web' && read() !== null;
}

// O celular tem Face ID ou digital que o navegador pode usar?
export async function biometricAvailable() {
  if (Platform.OS !== 'web') return false;
  const PKC = (globalThis as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential;
  if (!PKC?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Cadastra a biometria deste celular. Precisa ser chamada a partir de um toque na tela.
export async function enableBiometric(displayName: string): Promise<string | null> {
  try {
    const cred = (await creds()?.create({
      publicKey: {
        rp: { name: 'Cores & Fios' },
        user: { id: random(16), name: displayName || 'Profissional', displayName: displayName || 'Profissional' },
        challenge: random(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return 'Não foi possível ativar a biometria.';
    storage()?.setItem(KEY, JSON.stringify({ credentialId: toB64(cred.rawId) } satisfies Stored));
    return null;
  } catch (e) {
    return (e as { name?: string }).name === 'NotAllowedError'
      ? 'A biometria foi cancelada. Tente de novo.'
      : 'Este celular ou navegador não permitiu usar a biometria.';
  }
}

// Pede o rosto ou a digital. true = conferido pelo celular.
export async function verifyBiometric(): Promise<boolean> {
  const stored = read();
  if (!stored) return false;
  try {
    const result = await creds()?.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: fromB64(stored.credentialId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!result;
  } catch {
    return false;
  }
}

export function disableBiometric() {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nada a fazer.
  }
}

// iPhone abrindo pelo Safari (e não pelo app da Tela de Início): ali o login pode se perder.
export function isIosBrowserTab() {
  if (Platform.OS !== 'web') return false;
  const nav = (globalThis as { navigator?: Navigator & { standalone?: boolean } }).navigator;
  if (!nav || !/iPhone|iPad|iPod/.test(nav.userAgent)) return false;
  const standalone = nav.standalone || (globalThis as { matchMedia?: (q: string) => MediaQueryList }).matchMedia?.('(display-mode: standalone)').matches;
  return !standalone;
}
