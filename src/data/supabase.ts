import './polyfills';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Servidor online (opcional). Sem estas variáveis o app funciona só no aparelho, como antes.
// Veja supabase/README.md para criar o projeto e preencher o arquivo .env.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isRemote = supabase !== null;

// No celular, o login só se renova com o app em primeiro plano.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Telefone no formato do Supabase Auth: 55 + DDD + número.
export const toAuthPhone = (digits: string) => `55${digits}`;
export const fromAuthPhone = (phone?: string | null) => (phone?.startsWith('55') ? phone.slice(2) : (phone ?? ''));
