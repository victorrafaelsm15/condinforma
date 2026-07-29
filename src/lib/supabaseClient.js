import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env — ' +
    'enquanto isso, os dados ficam salvos apenas neste navegador (localStorage). ' +
    'Para o QR Code funcionar entre dispositivos diferentes (celular do colaborador vs painel do gestor), ' +
    'o Supabase precisa estar configurado.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
