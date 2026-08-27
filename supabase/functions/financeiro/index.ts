// Edge Function pública: dados da aba Financeiro do painel do síndico
// (FinanceiroPage.jsx) — plano atual, próxima cobrança, forma de pagamento
// e status da última cobrança. Próxima cobrança e forma de pagamento não
// ficam espelhadas em nenhuma tabela nossa (só existem do lado da Asaas),
// por isso essa função busca ao vivo, em vez de expor a service role no
// navegador pra fazer isso direto.
//
// verify_jwt = false no config.toml — a função exige e valida ELA MESMA o
// token de sessão do usuário logado, mesmo padrão de subscribe/index.ts.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getSubscription, getLatestPayment } from '../_shared/asaas.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { PLAN_PRICES } from '../_shared/plans.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
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

  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('plan_name, condominio_limit, sub_usuario_limit, status')
    .eq('id', accountId)
    .maybeSingle();

  // Uma conta pode ter mais de uma linha em "assinantes" (plano trocado,
  // pagamento antigo cancelado etc.) — prioriza a que está 'ativo'; sem
  // nenhuma ativa, cai pra mais recente (dá pra ver o que aconteceu com a
  // última tentativa mesmo se não vingou).
  const { data: assinantes } = await supabaseAdmin
    .from('assinantes')
    .select('asaas_subscription_id, status, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  const assinante = (assinantes || []).find((a) => a.status === 'ativo') || (assinantes || [])[0] || null;

  let billingType: string | null = null;
  let nextDueDate: string | null = null;
  let subscriptionStatus: string | null = null;
  let lastPayment: { status: string; value: number; dueDate: string } | null = null;

  if (assinante?.asaas_subscription_id && !String(assinante.asaas_subscription_id).startsWith('pixauto_')) {
    try {
      const sub = await getSubscription(assinante.asaas_subscription_id as string);
      billingType = sub.billingType ?? null;
      nextDueDate = sub.nextDueDate ?? null;
      subscriptionStatus = sub.status ?? null;
    } catch (err) {
      console.error('Erro ao buscar assinatura na Asaas:', err instanceof Error ? err.message : err);
    }
    try {
      const payment = await getLatestPayment(assinante.asaas_subscription_id as string);
      if (payment) {
        lastPayment = { status: payment.status, value: payment.value, dueDate: payment.dueDate };
      }
    } catch (err) {
      console.error('Erro ao buscar última cobrança na Asaas:', err instanceof Error ? err.message : err);
    }
  }

  const planKey = (account?.plan_name || '').toLowerCase();
  const planLabel = planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : null;
  const price = planLabel ? PLAN_PRICES[planLabel] ?? null : null;

  return jsonResponse({
    planName: planLabel,
    price,
    condominioLimit: account?.condominio_limit ?? 0,
    subUsuarioLimit: account?.sub_usuario_limit ?? 0,
    accountStatus: account?.status || null,
    billingType,
    nextDueDate,
    subscriptionStatus,
    lastPayment,
  });
});
