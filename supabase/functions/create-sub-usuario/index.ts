// Edge Function pública: cria um sub-usuário (login próprio + acesso a
// condomínios específicos) para a conta logada que chamar.
//
// Precisa da service role porque criar um usuário do Supabase Auth com
// senha definida na hora (sem precisar de confirmação por e-mail) só é
// possível via API admin, que exige a service role key — por isso essa
// operação não pode ser feita direto do navegador com a anon key, mesmo
// que quem esteja chamando seja o próprio dono da conta.
//
// verify_jwt = false no config.toml — a função valida ELA MESMA o token de
// sessão de quem chama (dono da conta), igual ao padrão já usado em
// subscribe/index.ts.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function isValidEmail(email: string | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

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
  const accountId = userData.user.id;

  // Rota autenticada: limite por conta. Criar sub-usuário não é uma ação
  // do dia a dia — 10 por hora já é bem mais do que o limite de qualquer
  // plano permite cadastrar de uma vez.
  const allowed = await checkRateLimit({
    supabaseAdmin, key: `create-sub-usuario:acc:${accountId}`, max: 10, windowSeconds: 3600,
  });
  if (!allowed) return rateLimitResponse();

  const { nome, email, password, condominioIds } = await req.json().catch(() => ({}));

  if (!nome?.trim()) return jsonResponse({ error: 'Informe o nome do sub-usuário.' }, 400);
  if (!isValidEmail(email)) return jsonResponse({ error: 'Informe um e-mail válido.' }, 400);
  if (!password || String(password).length < 6) {
    return jsonResponse({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);
  }
  if (!Array.isArray(condominioIds) || condominioIds.length === 0) {
    return jsonResponse({ error: 'Selecione pelo menos um condomínio.' }, 400);
  }

  // Pré-checagem do limite do plano — evita criar um login que não vai
  // conseguir ser vinculado (o trigger no banco também protege isso, mas
  // checar antes evita deixar um usuário de Auth órfão no caminho comum).
  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('role, sub_usuario_limit')
    .eq('id', accountId)
    .single();

  if (account?.role !== 'owner') {
    const { count } = await supabaseAdmin
      .from('sub_usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);
    if ((count ?? 0) >= (account?.sub_usuario_limit ?? 0)) {
      return jsonResponse({
        error: `Limite de ${account?.sub_usuario_limit ?? 0} sub-usuário(s) do seu plano atingido. Faça upgrade para adicionar mais.`,
      }, 400);
    }
  }

  // Confirma que os condomínios selecionados realmente pertencem a essa conta.
  const { data: ownedCondos } = await supabaseAdmin
    .from('condominios')
    .select('id')
    .eq('account_id', accountId)
    .in('id', condominioIds);
  if (!ownedCondos || ownedCondos.length !== condominioIds.length) {
    return jsonResponse({ error: 'Um ou mais condomínios selecionados são inválidos.' }, 400);
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !newUser.user) {
    const alreadyExists = createError?.message?.toLowerCase().includes('already');
    return jsonResponse({
      error: alreadyExists ? 'Já existe uma conta com esse e-mail.' : 'Não foi possível criar o sub-usuário. Tente novamente.',
    }, 400);
  }

  const { data: subUsuario, error: insertError } = await supabaseAdmin
    .from('sub_usuarios')
    .insert({ account_id: accountId, auth_user_id: newUser.user.id, nome: nome.trim(), email })
    .select()
    .single();

  if (insertError) {
    // Limpa o login que acabou de ser criado — sem isso ficaria um usuário
    // de Auth órfão, sem nenhum sub_usuarios correspondente.
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    const limitHit = insertError.code === 'CI001';
    return jsonResponse({ error: limitHit ? insertError.message : 'Não foi possível salvar o sub-usuário.' }, 400);
  }

  const { error: linkError } = await supabaseAdmin
    .from('sub_usuario_condominios')
    .insert(condominioIds.map((condominio_id: string) => ({ sub_usuario_id: subUsuario.id, condominio_id })));

  if (linkError) {
    await supabaseAdmin.from('sub_usuarios').delete().eq('id', subUsuario.id);
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return jsonResponse({ error: 'Não foi possível vincular os condomínios selecionados.' }, 400);
  }

  return jsonResponse({ subUsuario });
});
