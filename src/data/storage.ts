import AsyncStorage from '@react-native-async-storage/async-storage';

// A página de teste (web) pode injetar dados de exemplo em `globalThis.__CORES_DEMO_SEED__`,
// usados só quando ainda não há nada salvo naquela chave.
const SEED_OFF = 'cores:seed-off';
const demoSeed = () => (globalThis as { __CORES_DEMO_SEED__?: Record<string, unknown> }).__CORES_DEMO_SEED__;

// Persistência local (no aparelho). Erros de leitura/escrita não derrubam o app:
// a tela segue com os dados em memória.
export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    if (await AsyncStorage.getItem(SEED_OFF)) return fallback;
    const seed = demoSeed()?.[key];
    return seed === undefined ? fallback : (seed as T);
  } catch {
    return fallback;
  }
}

export async function saveJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem espaço ou armazenamento bloqueado: mantém só em memória.
  }
}

export async function clearAll(keys: string[]) {
  try {
    await AsyncStorage.multiRemove(keys);
    // Depois de apagar, os dados de exemplo da página de teste não voltam.
    await AsyncStorage.setItem(SEED_OFF, '1');
  } catch {
    // Nada a fazer.
  }
}

export const STORAGE_KEYS = {
  clients: 'cores:clients:v1',
  feedbacks: 'cores:feedbacks:v1',
  appointments: 'cores:appointments:v1',
  transactions: 'cores:transactions:v1',
  settings: 'cores:settings:v1',
  posts: 'cores:posts:v1',
  likes: 'cores:likes:v1',
  cashback: 'cores:cashback:v1',
  comments: 'cores:comments:v1',
};
