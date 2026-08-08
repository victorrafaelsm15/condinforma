import { supabase } from './supabaseClient';

// Tudo aqui só funciona pra quem tem accounts.role = 'owner' — a visão
// administrativa global (aba "Usuários") depende das policies novas de
// supabase/usuarios_admin_migration.sql. Sem elas, essas consultas voltam
// vazias (RLS barra silenciosamente), não dão erro.

export async function listAllAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function updateAccount(id, payload) {
  const { data, error } = await supabase.from('accounts').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Exclusão de usuário precisa da Auth Admin API (service role) — só a
// Edge Function delete-account consegue. Deletar auth.users cascade-remove
// accounts, condominios, ambientes, checklist_items, execucoes, ocorrencias,
// sub_usuarios e sub_usuario_condominios daquela conta (ver schema.sql).
export async function deleteAccount(userId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível excluir esse usuário.');
  return true;
}

export async function listAssinantes() {
  const { data, error } = await supabase.from('assinantes').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function removeAssinante(asaasSubscriptionId) {
  const { error } = await supabase.from('assinantes').delete().eq('asaas_subscription_id', asaasSubscriptionId);
  if (error) throw error;
}
