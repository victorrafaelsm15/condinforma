// Edge Function pública: recebe eventos do Asaas (PAYMENT_CONFIRMED,
// PAYMENT_RECEIVED, PAYMENT_OVERDUE etc.), atualiza o status do assinante na
// tabela "assinantes" (histórico/auditoria) e aplica o plano/limite na conta
// (tabela "accounts"), que é o que realmente libera o uso no app.
//
// Quem chama aqui é o servidor do Asaas, não o Supabase Auth — por isso a
// validação é feita manualmente pelo header "asaas-access-token" (configurado
// no painel do Asaas ao cadastrar a URL do webhook), e verify_jwt = false no
// config.toml pra o gateway do Supabase não exigir apikey/JWT.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { PLAN_LIMITS, SUB_USUARIO_LIMITS } from '../_shared/plans.ts';
import { cancelSubscription } from '../_shared/asaas.ts';

// Eventos que fazem a assinatura contar como "em dia".
const ACTIVE_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
// Eventos que derrubam o acesso do assinante.
const INACTIVE_EVENTS = new Set([
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_REQUESTED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_INACTIVATED',
]);

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

  const token = req.headers.get('asaas-access-token');
  if (!token || token !== Deno.env.get('ASAAS_WEBHOOK_TOKEN')) {
    return jsonResponse({ error: 'Token de webhook inválido.' }, 401);
  }

  const body = await req.json().catch(() => null);
  const { event, payment } = body || {};

  if (!event || !payment) {
    console.warn('Webhook Asaas recebido sem event/payment:', JSON.stringify(body));
    return jsonResponse({ received: true });
  }

  let status: string | null = null;
  if (ACTIVE_EVENTS.has(event)) status = 'ativo';
  else if (INACTIVE_EVENTS.has(event)) status = 'inativo';

  const subscriptionId = payment.subscription;
  const customerId = payment.customer;

  // externalReference foi gravado no formato "account_id:planName" na
  // criação da assinatura (ver subscribe/index.ts) — é o único jeito do
  // webhook, que só recebe dados do Asaas, saber qual conta liberar.
  const externalRef: string | undefined = payment.externalReference;
  let accountId: string | null = null;
  let planKey: string | null = null;
  if (externalRef?.includes(':')) {
    const sep = externalRef.indexOf(':');
    accountId = externalRef.slice(0, sep);
    planKey = externalRef.slice(sep + 1).toLowerCase();
  }

  try {
    if (subscriptionId) {
      const update: Record<string, unknown> = {
        asaas_subscription_id: subscriptionId,
        asaas_customer_id: customerId,
        account_id: accountId,
        last_event: event,
        updated_at: new Date().toISOString(),
      };
      if (status) update.status = status;

      const { error } = await supabaseAdmin
        .from('assinantes')
        .upsert(update, { onConflict: 'asaas_subscription_id' });

      if (error) throw error;
    } else {
      console.warn(`Webhook Asaas evento ${event} sem subscription vinculada (payment ${payment.id}).`);
    }

    // Aplica o plano/limite (ou desativa) na conta — isto sim é o que
    // libera/bloqueia o uso real do app, via o trigger de condominios.
    if (accountId) {
      if (status === 'ativo' && planKey && PLAN_LIMITS[planKey] != null) {
        const { error: accError } = await supabaseAdmin.from('accounts').update({
          plan_name: planKey,
          condominio_limit: PLAN_LIMITS[planKey],
          sub_usuario_limit: SUB_USUARIO_LIMITS[planKey] ?? 0,
          status: 'ativo',
          asaas_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }).eq('id', accountId);
        if (accError) console.error('Erro ao ativar plano na conta:', accError.message);

        // Troca de plano (upgrade/downgrade): a conta só deve ter UMA
        // assinatura cobrando por vez. Cancela no Asaas qualquer outra
        // assinatura "ativa" dessa mesma conta pra não cobrar duas ao mesmo
        // tempo — não bloqueia o fluxo principal se algo aqui falhar.
        if (subscriptionId) {
          const { data: outras } = await supabaseAdmin
            .from('assinantes')
            .select('asaas_subscription_id')
            .eq('account_id', accountId)
            .eq('status', 'ativo')
            .neq('asaas_subscription_id', subscriptionId);
          for (const outra of outras || []) {
            try {
              await cancelSubscription(outra.asaas_subscription_id);
              await supabaseAdmin.from('assinantes')
                .update({ status: 'cancelado', last_event: 'PLAN_CHANGED', updated_at: new Date().toISOString() })
                .eq('asaas_subscription_id', outra.asaas_subscription_id);
            } catch (cancelErr) {
              console.error(
                `Erro ao cancelar assinatura antiga ${outra.asaas_subscription_id} após troca de plano:`,
                cancelErr instanceof Error ? cancelErr.message : cancelErr,
              );
            }
          }
        }
      } else if (status === 'inativo') {
        // Mantém plan_name/condominio_limit intactos — se a pessoa
        // regularizar o pagamento depois, a configuração não se perde.
        const { error: accError } = await supabaseAdmin.from('accounts').update({
          status: 'inativo',
          updated_at: new Date().toISOString(),
        }).eq('id', accountId);
        if (accError) console.error('Erro ao inativar conta:', accError.message);
      }
    }

    return jsonResponse({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro ao processar webhook do Asaas:', message);
    // Ainda assim responde 200: o erro é nosso (Supabase fora do ar, etc.),
    // não do Asaas, e deixar ele retentando não resolve sozinho.
    return jsonResponse({ received: true, warning: 'Falha ao gravar no banco, ver logs.' });
  }
});
