import type { ImagePickerAsset } from 'expo-image-picker';

import { persistPhoto } from './photoStorage';
import { uploadPhoto } from './storageUpload';
import { supabase } from './supabase';

// No navegador a foto já vem reduzida em data URL; com servidor, ela é enviada ao Storage.
export async function storePhoto(asset: ImagePickerAsset, folder: string): Promise<string | null> {
  const dataUrl = await persistPhoto(asset, folder);
  if (!supabase) return dataUrl;
  const bytes = await (await fetch(dataUrl)).arrayBuffer();
  return uploadPhoto(bytes, 'image/jpeg');
}
