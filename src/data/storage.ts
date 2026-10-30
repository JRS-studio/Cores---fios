import AsyncStorage from '@react-native-async-storage/async-storage';

// Persistência local (no aparelho). Erros de leitura/escrita não derrubam o app:
// a tela segue com os dados em memória.
export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
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
