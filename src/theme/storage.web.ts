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

export type StoredTheme = { id: string; personal: boolean };

// "p:tema" = escolhido pela própria pessoa neste aparelho; "s:tema" = padrão do studio.
export function readStoredTheme(): StoredTheme | null {
  const raw = readThemeSync();
  if (!raw) return null;
  const m = /^(p|s):(.+)$/.exec(raw);
  return m ? { id: m[2], personal: m[1] === 'p' } : { id: raw, personal: false };
}

export function writeStoredTheme(t: StoredTheme) {
  writeThemeSync(`${t.personal ? 'p' : 's'}:${t.id}`);
}
