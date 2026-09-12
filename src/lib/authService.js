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

// "Esqueci minha senha" — dispara o e-mail de recuperação. O GoTrue sempre
// devolve sucesso aqui independente do e-mail existir ou não na base (não é
// coisa nossa, é o comportamento padrão do endpoint /recover), o que já
// evita enumeração de contas por e-mail sem precisar de nenhuma lógica
// extra — a tela que chama isso (EsqueciSenhaPage) só precisa exibir a
// mesma mensagem genérica de sempre.
export async function requestPasswordReset(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  return { error };
}

// Efetiva a nova senha — só funciona dentro da sessão temporária de
// recuperação que o Supabase cria a partir do link do e-mail (ver
// RedefinirSenhaPage.jsx), a mesma API usada por SegurancaPage.jsx pra
// trocar senha de uma sessão normal já logada.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
