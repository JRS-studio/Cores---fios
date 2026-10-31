import { File, Paths } from 'expo-file-system';

// O tema precisa ser lido antes de qualquer tela montar os estilos, por isso a leitura é síncrona.
const file = () => new File(Paths.document, 'tema.txt');

export function readThemeSync(): string | null {
  try {
    const f = file();
    return f.exists ? f.textSync().trim() : null;
  } catch {
    return null;
  }
}

export function writeThemeSync(id: string) {
  try {
    file().writeSync(id);
  } catch {
    // Sem acesso ao armazenamento: o tema volta ao padrão na próxima abertura.
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
