import { supabase } from './supabaseClient';

// sub_usuarios usa uuid gerado pelo próprio Postgres e
// sub_usuario_condominios tem chave composta — nenhuma das duas tabelas se
// encaixa no CRUD genérico de createStore.js (que assume um "id" text tipo
// uid() de app). Por isso essas duas usam consultas diretas ao Supabase
// aqui, em vez de passar por lib/stores.js.

// A sessão atual é de um sub-usuário (não da conta principal)? Se for,
// devolve o próprio registro — id, account_id (da conta principal, dona de
// verdade), nome e email.
export async function getSubUsuarioInfo(userId) {
  const { data } = await supabase.from('sub_usuarios').select('*').eq('auth_user_id', userId).maybeSingle();
  return data || null;
}

// Lista os sub-usuários da conta principal logada, já com os IDs dos
// condomínios liberados pra cada um.
export async function listSubUsuarios(accountId) {
  const { data: subUsuarios, error } = await supabase
    .from('sub_usuarios')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });
  if (error || !subUsuarios?.length) return [];

  const { data: links } = await supabase
    .from('sub_usuario_condominios')
    .select('sub_usuario_id, condominio_id')
    .in('sub_usuario_id', subUsuarios.map((s) => s.id));

  return subUsuarios.map((s) => ({
    ...s,
    condominioIds: (links || []).filter((l) => l.sub_usuario_id === s.id).map((l) => l.condominio_id),
  }));
}

// Cria o sub-usuário via Edge Function (precisa da service role pra criar
// o login com senha definida na hora — ver supabase/functions/create-sub-usuario).
export async function createSubUsuario({ nome, email, password, condominioIds }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-sub-usuario`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ nome, email, password, condominioIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível criar o sub-usuário.');
  return data.subUsuario;
}

// Substitui a lista de condomínios liberados pra um sub-usuário existente.
export async function updateSubUsuarioCondominios(subUsuarioId, condominioIds) {
  const { error: delError } = await supabase.from('sub_usuario_condominios').delete().eq('sub_usuario_id', subUsuarioId);
  if (delError) throw delError;
  if (condominioIds.length) {
    const { error: insError } = await supabase
      .from('sub_usuario_condominios')
      .insert(condominioIds.map((condominio_id) => ({ sub_usuario_id: subUsuarioId, condominio_id })));
    if (insError) throw insError;
  }
}

// Remove o sub-usuário (cascade apaga as permissões de condomínio junto).
// O login em auth.users continua existindo, mas sem sub_usuarios/
// sub_usuario_condominios ele não enxerga mais nada no app.
export async function removeSubUsuario(subUsuarioId) {
  const { error } = await supabase.from('sub_usuarios').delete().eq('id', subUsuarioId);
  if (error) throw error;
}
