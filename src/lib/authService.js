// Autenticação real do painel do gestor via Supabase Auth. Cada cliente que
// se cadastra vira um usuário do Supabase Auth — o isolamento de dados entre
// contas é garantido pelas políticas de RLS (ver supabase/schema.sql), que
// usam auth.uid() como account_id dono de cada registro.
import { supabase } from './supabaseClient';

// whatsappPhone vai em options.data (user_metadata) — não é coluna nativa
// de auth.users, só chega em accounts.whatsapp_phone porque
// handle_new_user_account() (schema.sql) lê raw_user_meta_data no INSERT
// automático que dispara na criação do usuário.
export async function signUp(email, password, whatsappPhone) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { whatsapp_phone: whatsappPhone || null } },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return { data, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
