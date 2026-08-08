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

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('Erro ao excluir usuário:', deleteError.message);
    return jsonResponse({ error: 'Não foi possível excluir esse usuário. Tente novamente.' }, 502);
  }

  return jsonResponse({ ok: true });
});
