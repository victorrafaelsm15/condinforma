// Edge Function: exclusão completa de uma conta de cliente (usada na aba
// "Usuários" do painel administrativo, só acessível a quem tem role =
// 'owner'). Deletar direto a linha de "accounts" não bastaria — o login em
// auth.users continuaria existindo e a exclusão do auth.users é o que
// dispara, via "on delete cascade", a limpeza de accounts, condominios,
// ambientes, checklist_items, execucoes, ocorrencias, sub_usuarios e
// sub_usuario_condominios daquela conta (ver schema.sql). Só a Auth Admin
// API (service role) pode deletar um usuário — por isso isso vira uma
// função de servidor, e não uma chamada direta do navegador.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { cancelSubscription } from '../_shared/asaas.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
  }

  const { data: callerAccount } = await supabaseAdmin
    .from('accounts')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (callerAccount?.role !== 'owner') {
    return jsonResponse({ error: 'Acesso restrito à conta administradora da plataforma.' }, 403);
  }

  const { userId } = await req.json().catch(() => ({}));
  if (!userId || typeof userId !== 'string') {
    return jsonResponse({ error: 'Informe o usuário a ser excluído.' }, 400);
  }
  if (userId === userData.user.id) {
    return jsonResponse({ error: 'Você não pode excluir a própria conta por aqui.' }, 400);
  }

  const { data: targetAccount } = await supabaseAdmin.from('accounts').select('role').eq('id', userId).maybeSingle();
  if (targetAccount?.role === 'owner') {
    return jsonResponse({ error: 'Não é possível excluir outra conta administradora da plataforma por aqui.' }, 400);
  }

  // Excluir a conta não cancela a assinatura dela na Asaas — sem isso, o
  // cartão do ex-cliente continua sendo debitado todo mês por uma
  // assinatura que já não tem mais conta nenhuma vinculada aqui (o
  // "on delete set null" de assinantes.account_id só apaga o VÍNCULO, não
  // a assinatura em si). Cancela todas as assinaturas ativas/pendentes
  // dessa conta ANTES de excluir o usuário — best-effort: uma falha aqui
  // não pode impedir a exclusão em si (é a ação que o owner pediu), só
  // fica registrada no log pra cancelamento manual depois.
  const { data: assinaturas } = await supabaseAdmin
    .from('assinantes')
    .select('asaas_subscription_id')
    .eq('account_id', userId)
    .in('status', ['ativo', 'pendente']);
  for (const assinatura of assinaturas || []) {
    try {
      await cancelSubscription(assinatura.asaas_subscription_id as string);
    } catch (err) {
      console.error(
        `Erro ao cancelar assinatura ${assinatura.asaas_subscription_id} da conta ${userId} antes da exclusão:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('Erro ao excluir usuário:', deleteError.message);
    return jsonResponse({ error: 'Não foi possível excluir esse usuário. Tente novamente.' }, 502);
  }

  return jsonResponse({ ok: true });
});
