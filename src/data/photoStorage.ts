import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

// A foto escolhida fica numa pasta temporária; copiamos para os documentos do app
// para que continue disponível nas próximas aberturas.
export async function persistPhoto(asset: ImagePickerAsset, folder: string): Promise<string> {
  try {
    const dir = new Directory(Paths.document, folder);
    dir.create({ idempotent: true, intermediates: true });
    const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = new File(dir, `${Date.now()}.${ext}`);
    await new File(asset.uri).copy(dest);
    return dest.uri;
  } catch {
    return asset.uri;
  }
}

export function deletePhoto(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Arquivo já removido.
  }
}
