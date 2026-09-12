import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Não basta checar se a var existe: se ela vier PREENCHIDA mas mal formada
// (faltando "https://", espaço/quebra de linha colada ao copiar do painel
// da Vercel, etc — já aconteceu de verdade em produção, causando tela
// branca) o `supabaseUrl || 'placeholder'` abaixo não pega o caso, porque
// a string não é vazia. createClient() então lança "Invalid supabaseUrl"
// e trava a árvore de imports antes do React montar qualquer coisa.
export function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(isValidHttpUrl(supabaseUrl) && supabaseAnonKey);

// A checagem "de verdade" (que impede o app de sequer montar sem essas
// variáveis configuradas corretamente, mostrando uma tela de erro visível)
// fica em main.jsx — mas como App.jsx (e tudo que ele importa, inclusive
// este arquivo) é importado no TOPO de main.jsx, esse módulo aqui roda
// ANTES da checagem de main.jsx ter qualquer chance de executar. Por isso
// createClient() nunca pode receber a URL/chave cruas sem validar: se
// vierem ausentes OU presentes mas inválidas, cai pro placeholder aqui
// mesmo, senão o erro estoura no meio da árvore de imports (inclusive
// antes da tela de erro conseguir aparecer). Desde a migração pra
// multi-tenant com Supabase Auth real, não existe mais um fallback
// funcional pra localStorage — sem Supabase configurado, o app não
// funciona de verdade, só não deve quebrar de um jeito que produza tela
// branca sem nenhuma pista.
// flowType: 'pkce' é obrigatório aqui por causa do HashRouter (main.jsx) —
// o flow padrão ("implicit") entrega o token de recuperação de senha DENTRO
// do fragmento da URL (depois do "#"), que é exatamente onde o HashRouter
// já espera encontrar a rota da SPA. As duas coisas competem pelo mesmo "#"
// e o token nunca é reconhecido (vira parte do path, não do fragmento de
// auth). PKCE evita isso porque entrega um "?code=" como query string de
// verdade, antes do "#" — sem conflito com o roteamento. Ver
// EsqueciSenhaPage.jsx / RedefinirSenhaPage.jsx.
export const supabase = createClient(
  isValidHttpUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { auth: { flowType: 'pkce' } }
);
