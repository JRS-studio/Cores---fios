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
