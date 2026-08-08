import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// A checagem "de verdade" (que impede o app de sequer montar sem essas
// variáveis, mostrando uma tela de erro visível) fica em main.jsx, ANTES
// de qualquer módulo do app ser importado. Esse fallback aqui é só uma
// segunda camada de proteção — createClient() não pode lançar exceção
// não tratada por causa de uma URL/chave vazia, senão o erro estoura no
// meio da árvore de imports, antes até do React montar qualquer coisa
// (inclusive a tela de erro). Desde a migração pra multi-tenant com
// Supabase Auth real, não existe mais um fallback funcional pra
// localStorage — sem Supabase configurado, o app não funciona de verdade,
// só não deve quebrar de um jeito que produza tela branca sem nenhuma pista.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
