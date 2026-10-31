import { newId } from '@/utils/id';
import { supabase } from './supabase';
import { reportSyncError } from './syncStatus';

// Envia uma foto ao Storage do Supabase e devolve o endereço público.
export async function uploadPhoto(bytes: Uint8Array | ArrayBuffer, contentType: string): Promise<string | null> {
  if (!supabase) return null;
  const path = `${newId()}.${contentType.split('/')[1] ?? 'jpg'}`;
  const { error } = await supabase.storage.from('avaliacoes').upload(path, bytes, { contentType });
  if (error) {
    reportSyncError(error);
    return null;
  }
  return supabase.storage.from('avaliacoes').getPublicUrl(path).data.publicUrl;
}
