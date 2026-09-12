// Edge Function pública: recebe eventos do Asaas (PAYMENT_CONFIRMED,
// PAYMENT_RECEIVED, PAYMENT_OVERDUE etc.),
// atualiza o status do assinante na tabela "assinantes" (histórico/
// auditoria) e aplica o plano/limite na conta (tabela "accounts"), que é o
// que realmente libera o uso no app.
//
// Quem chama aqui é o servidor do Asaas, não o Supabase Auth — por isso a
// validação é feita manualmente pelo header "asaas-access-token" (configurado
// no painel do Asaas ao cadastrar a URL do webhook), e verify_jwt = false no
// config.toml pra o gateway do Supabase não exigir apikey/JWT.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { PLAN_LIMITS, SUB_USUARIO_LIMITS } from '../_shared/plans.ts';
import { cancelSubscription, updatePaymentValue } from '../_shared/asaas.ts';
import {
  resolveStatusFromEvent, parseExternalReference, shouldLogPlanChange,
  type AccountStatus,
} from '../_shared/webhookLogic.ts';
import { applyCouponToRecurringPayment } from '../_shared/cupons.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Ativa/desativa o plano na conta e cancela outras assinaturas "ativo" da
// mesma conta em caso de troca de plano. currentSubscriptionRowId é o
// asaas_subscription_id desta linha em "assinantes" — usado só pra não
// cancelar a própria assinatura que acabou de ativar.
async function applyAccountStatus({
  accountId, planKey, status, event, currentSubscriptionRowId,
}: {
  accountId: string; planKey: string | null; status: AccountStatus; event: string; currentSubscriptionRowId: string | null;
}) {
  if (status === 'ativo' && planKey && PLAN_LIMITS[planKey] != null) {
    // Lê o plano ANTES de atualizar, só pra saber se isso é uma troca de
    // verdade (loga auditoria) ou uma reconfirmação do mesmo evento que
    // o Asaas já mandou antes (retry) — idempotente: entrega duplicada
    // não deve gerar entrada duplicada no histórico.
    const { data: beforeAccount } = await supabaseAdmin.from('accounts').select('plan_name').eq('id', accountId).maybeSingle();
    const previousPlan = beforeAccount?.plan_name ?? null;

    const { error: accError } = await supabaseAdmin.from('accounts').update({
      plan_name: planKey,
      condominio_limit: PLAN_LIMITS[planKey],
      sub_usuario_limit: SUB_USUARIO_LIMITS[planKey] ?? 0,
      status: 'ativo',
      // Volta a pagar: zera a contagem de inatividade e os avisos de
      // exclusão já enviados — se cair de novo depois, começa do zero.
      inactive_since: null,
      deletion_warning_15d_sent_at: null,
      deletion_warning_3d_sent_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', accountId);
    if (accError) console.error('Erro ao ativar plano na conta:', accError.message);
    else if (shouldLogPlanChange(previousPlan, planKey)) {
      const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
        account_id: accountId,
        auth_user_id: null,
        action: 'plano.alterado',
        entity_type: 'account',
        entity_id: accountId,
        details: { antes: previousPlan, depois: planKey, evento: event },
      });
      if (auditError) console.error('Erro ao gravar auditoria de troca de plano:', auditError.message);
    }

    // Troca de plano (upgrade/downgrade): a conta só deve ter UMA
    // assinatura cobrando por vez. Cancela no Asaas qualquer outra
    // "ativo" OU "pendente" dessa mesma conta pra não cobrar duas ao
    // mesmo tempo — não bloqueia o fluxo principal se algo aqui falhar.
    // Inclui "pendente" porque uma tentativa antiga abandonada (ex.:
    // gerou boleto e nunca pagou) continua sendo uma assinatura de
    // verdade no Asaas, cobrando todo mês, mesmo com essa linha local
    // nunca tendo saído de "pendente".
    if (currentSubscriptionRowId) {
      const { data: outras } = await supabaseAdmin
        .from('assinantes')
        .select('asaas_subscription_id')
        .eq('account_id', accountId)
        .in('status', ['ativo', 'pendente'])
        .neq('asaas_subscription_id', currentSubscriptionRowId);
      for (const outra of outras || []) {
        const outraId = outra.asaas_subscription_id as string;
        try {
          await cancelSubscription(outraId);
          await supabaseAdmin.from('assinantes')
            .update({ status: 'cancelado', last_event: 'PLAN_CHANGED', updated_at: new Date().toISOString() })
            .eq('asaas_subscription_id', outraId);
        } catch (cancelErr) {
          console.error(
            `Erro ao cancelar assinatura antiga ${outraId} após troca de plano:`,
            cancelErr instanceof Error ? cancelErr.message : cancelErr,
          );
        }
      }
    }
  } else if (status === 'inativo') {
    // Um evento negativo (OVERDUE, DELETED, REFUNDED...) chega vinculado a
    // UMA assinatura específica — mas a conta pode ter outra assinatura
    // diferente, essa sim ativa, cobrindo o acesso (ex.: cliente trocou de
    // forma de pagamento; a assinatura antiga é cancelada pelo bloco acima
    // e a própria Asaas dispara PAYMENT_DELETED das cobranças pendentes
    // dela — chegaria aqui e inativaria a conta segundos depois dela ter
    // sido ativada pelo pagamento novo). Só derruba o acesso se NENHUMA
    // outra assinatura da conta estiver ativa agora.
    if (currentSubscriptionRowId) {
      const { data: outraAtiva } = await supabaseAdmin
        .from('assinantes')
        .select('asaas_subscription_id')
        .eq('account_id', accountId)
        .eq('status', 'ativo')
        .neq('asaas_subscription_id', currentSubscriptionRowId)
        .maybeSingle();
      if (outraAtiva) {
        console.warn(`Evento ${event} inativaria a conta ${accountId}, mas ela já tem outra assinatura ativa (${outraAtiva.asaas_subscription_id}) — ignorado.`);
        return;
      }
    }

    // Mantém plan_name/condominio_limit intactos — se a pessoa
    // regularizar o pagamento depois, a configuração não se perde.
    //
    // inactive_since só é gravado na PRIMEIRA vez que a conta cai pra
    // inativo — reentregas do mesmo evento (retry do Asaas) não podem
    // reiniciar a contagem dos 90 dias até a exclusão automática
    // (data-retention-sweep), senão uma conta inadimplente que nunca
    // regulariza, mas cujo evento é reentregue de vez em quando, nunca
    // acumularia os 90 dias.
    const { data: beforeAccount } = await supabaseAdmin.from('accounts').select('inactive_since').eq('id', accountId).maybeSingle();
    const update: Record<string, unknown> = { status: 'inativo', updated_at: new Date().toISOString() };
    if (!beforeAccount?.inactive_since) update.inactive_since = new Date().toISOString();

    const { error: accError } = await supabaseAdmin.from('accounts').update(update).eq('id', accountId);
    if (accError) console.error('Erro ao inativar conta:', accError.message);
  }
}

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
  const { event } = body || {};

  if (!event) {
    console.warn('Webhook Asaas recebido sem event:', JSON.stringify(body));
    return jsonResponse({ received: true });
  }

  try {
    // Eventos de pagamento (PAYMENT_CONFIRMED, PAYMENT_RECEIVED,
    // PAYMENT_OVERDUE etc.) trazem "payment"; eventos de assinatura
    // (SUBSCRIPTION_DELETED, SUBSCRIPTION_INACTIVATED — dispara quando a
    // assinatura é cancelada/inativada direto no painel do Asaas, sem
    // nenhuma cobrança envolvida) trazem "subscription" em vez disso. Os
    // dois precisam ser tratados: sem isso, cancelar uma assinatura
    // inadimplente na Asaas nunca chegava aqui (SUBSCRIPTION_DELETED
    // sempre caía no "sem payment" abaixo e era descartado), e a conta
    // ficava com o plano liberado pra sempre, mesmo cancelada.
    const { payment, subscription } = body || {};
    const eventSource = payment || subscription;
    if (!eventSource) {
      console.warn(`Webhook Asaas evento ${event} sem payment nem subscription:`, JSON.stringify(body));
      return jsonResponse({ received: true });
    }

    const status = resolveStatusFromEvent(event);
    const subscriptionId = (payment ? payment.subscription : subscription.id) as string | undefined;
    const customerId = eventSource.customer as string | undefined;

    const { accountId, planKey } = parseExternalReference(eventSource.externalReference);
    let currentSubscriptionRowId: string | null = null;

    if (subscriptionId) {
      currentSubscriptionRowId = subscriptionId;
      const update: Record<string, unknown> = {
        asaas_subscription_id: subscriptionId,
        asaas_customer_id: customerId,
        last_event: event,
        updated_at: new Date().toISOString(),
      };
      // Só sobrescreve account_id quando o evento realmente trouxe um —
      // um evento sem externalReference reconhecível (formato antigo,
      // cobrança avulsa criada manualmente no painel do Asaas etc.) não
      // pode apagar o vínculo já gravado numa entrega anterior.
      if (accountId) update.account_id = accountId;
      if (status) update.status = status;

      const { error } = await supabaseAdmin
        .from('assinantes')
        .upsert(update, { onConflict: 'asaas_subscription_id' });

      if (error) throw error;

      // PAYMENT_CREATED = o Asaas acabou de gerar uma nova cobrança do ciclo
      // mensal da assinatura (a 2ª em diante — a 1ª já foi tratada de forma
      // síncrona em subscribe/index.ts). Se essa assinatura tem um cupom
      // multi-cobrança com saldo (ver assinante_cupons), aplica o mesmo
      // desconto aqui e decrementa o saldo. No-op silencioso quando não há
      // cupom associado, que é o caso comum.
      if (event === 'PAYMENT_CREATED' && payment) {
        await applyCouponToRecurringPayment(supabaseAdmin, {
          asaasSubscriptionId: subscriptionId,
          payment: { id: payment.id, status: payment.status, value: payment.value },
          updatePaymentValue,
        });
      }
    } else {
      console.warn(`Webhook Asaas evento ${event} sem subscription vinculada.`);
    }

    if (accountId) {
      await applyAccountStatus({ accountId, planKey, status, event, currentSubscriptionRowId });
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
