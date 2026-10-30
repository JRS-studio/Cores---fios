import type { ImagePickerAsset } from 'expo-image-picker';

const MAX_SIDE = 1080;

// No navegador não há sistema de arquivos: a foto é reduzida e guardada como data URL.
export async function persistPhoto(asset: ImagePickerAsset): Promise<string> {
  try {
    const img = new Image();
    img.src = asset.uri;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return asset.uri;
  }
}

export function deletePhoto() {
  // Nada a apagar: a foto vive dentro do próprio registro.
}
