import { File } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

import { persistPhoto } from './photoStorage';
import { uploadPhoto } from './storageUpload';
import { supabase } from './supabase';

// Com servidor, a foto vai para o Storage do Supabase (visível em qualquer celular);
// sem servidor, fica guardada no aparelho.
export async function storePhoto(asset: ImagePickerAsset, folder: string): Promise<string | null> {
  if (!supabase) return persistPhoto(asset, folder);
  const bytes = await new File(asset.uri).bytes();
  return uploadPhoto(bytes, asset.mimeType ?? 'image/jpeg');
}
