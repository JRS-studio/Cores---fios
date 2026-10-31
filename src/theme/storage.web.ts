const KEY = 'cores:tema';

export function readThemeSync(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeThemeSync(id: string) {
  try {
    globalThis.localStorage?.setItem(KEY, id);
  } catch {
    // Armazenamento bloqueado (ex.: navegação privada): fica o tema padrão.
  }
}
