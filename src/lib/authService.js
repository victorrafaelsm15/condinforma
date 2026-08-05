// Autenticação real do painel do gestor via Supabase Auth. Cada cliente que
// se cadastra vira um usuário do Supabase Auth — o isolamento de dados entre
// contas é garantido pelas políticas de RLS (ver supabase/schema.sql), que
// usam auth.uid() como account_id dono de cada registro.
import { supabase } from './supabaseClient';

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
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
