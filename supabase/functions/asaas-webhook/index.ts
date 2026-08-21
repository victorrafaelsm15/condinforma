// Edge Function pública: recebe eventos do Asaas (PAYMENT_CONFIRMED,
// PAYMENT_RECEIVED, PAYMENT_OVERDUE, e agora também os eventos de
// autorização de Pix Automático PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*),
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
import { cancelSubscription } from '../_shared/asaas.ts';
import {
  resolveStatusFromEvent, parseExternalReference, shouldLogPlanChange,
  isPixAutomaticAuthorizationEvent, resolveStatusFromAuthorizationEvent,
  type AccountStatus,
} from '../_shared/webhookLogic.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function addOneMonth(dateStr: string | undefined | null): string {
  const base = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
}

// Ativa/desativa o plano na conta e cancela outras assinaturas/autorizações
// "ativo" da mesma conta em caso de troca de plano — igual pra evento de
// pagamento (assinatura clássica: Boleto/Cartão) e evento de autorização de
// Pix Automático, só muda como accountId/planKey/status chegam até aqui.
// currentSubscriptionRowId é o valor gravado em assinantes.asaas_subscription_id
// pra ESTA linha (subscriptionId clássico da Asaas OU "pixauto_<authorizationId>"
// sintético) — usado só pra não cancelar a própria assinatura/autorização
// que acabou de ativar.
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
    // assinatura/autorização cobrando por vez. Cancela no Asaas qualquer
    // outra "ativa" dessa mesma conta pra não cobrar duas ao mesmo tempo —
    // não bloqueia o fluxo principal se algo aqui falhar.
    //
    // NOTA: cancelSubscription só cancela assinaturas clássicas (Boleto/
    // Cartão) — uma autorização de Pix Automático antiga (asaas_subscription_id
    // começando com "pixauto_") não é cancelada aqui automaticamente; segue
    // como limitação conhecida até existir cancelPixAutomaticAuthorization.
    if (currentSubscriptionRowId) {
      const { data: outras } = await supabaseAdmin
        .from('assinantes')
        .select('asaas_subscription_id')
        .eq('account_id', accountId)
        .eq('status', 'ativo')
        .neq('asaas_subscription_id', currentSubscriptionRowId);
      for (const outra of outras || []) {
        const outraId = outra.asaas_subscription_id as string;
        if (outraId.startsWith('pixauto_')) {
          console.warn(`Assinatura antiga ${outraId} é Pix Automático — cancelamento automático ainda não suportado, cancelar manualmente no painel Asaas.`);
          continue;
        }
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
    // Eventos de autorização de Pix Automático vêm com "authorization" no
    // corpo, não "payment" — payload bem diferente dos eventos de
    // pagamento tratados mais abaixo.
    if (isPixAutomaticAuthorizationEvent(event)) {
      const authorization = body.authorization;
      if (!authorization?.id) {
        console.warn(`Webhook Pix Automático ${event} sem authorization.id:`, JSON.stringify(body));
        return jsonResponse({ received: true });
      }

      // Resolve a conta pela NOSSA tabela (gravada na criação, ver
      // subscribe/index.ts) — não depende de externalReference/contractId
      // vir ecoado no payload da Asaas pra esses eventos, o que não está
      // confirmado na documentação pública.
      const { data: assinante } = await supabaseAdmin
        .from('assinantes')
        .select('account_id, plan_name')
        .eq('pix_automatic_authorization_id', authorization.id)
        .maybeSingle();

      if (!assinante) {
        console.warn(`Webhook Pix Automático ${event}: nenhum assinante encontrado para authorization ${authorization.id}.`);
        return jsonResponse({ received: true });
      }

      const update: Record<string, unknown> = {
        pix_automatic_status: authorization.status ?? null,
        last_event: event,
        updated_at: new Date().toISOString(),
      };
      if (event === 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED') {
        // Primeira cobrança (mês 1) já foi paga via QR Code imediato — a
        // próxima cobrança criada por pix-automatic-billing é a do mês 2.
        update.next_pix_charge_due_date = addOneMonth(authorization.startDate);
      }
      const status = resolveStatusFromAuthorizationEvent(event);
      if (status) update.status = status;

      const { error } = await supabaseAdmin.from('assinantes').update(update).eq('pix_automatic_authorization_id', authorization.id);
      if (error) console.error('Erro ao atualizar assinante (autorização Pix Automático):', error.message);

      if (status && assinante.account_id) {
        await applyAccountStatus({
          accountId: assinante.account_id as string,
          planKey: assinante.plan_name as string | null,
          status,
          event,
          currentSubscriptionRowId: `pixauto_${authorization.id}`,
        });
      }

      return jsonResponse({ received: true });
    }

    // Eventos de pagamento (PAYMENT_CONFIRMED, PAYMENT_RECEIVED,
    // PAYMENT_OVERDUE etc.) — cobrem tanto assinaturas clássicas (Boleto/
    // Cartão, payment.subscription presente) quanto cobranças avulsas de
    // Pix Automático criadas pela pix-automatic-billing (sem
    // payment.subscription, mas com payment.pixAutomaticAuthorizationId).
    const { payment } = body || {};
    if (!payment) {
      console.warn('Webhook Asaas recebido sem payment:', JSON.stringify(body));
      return jsonResponse({ received: true });
    }

    const status = resolveStatusFromEvent(event);
    const subscriptionId = payment.subscription as string | undefined;
    const customerId = payment.customer as string | undefined;
    const pixAutoAuthId = payment.pixAutomaticAuthorizationId as string | undefined;

    let { accountId, planKey } = parseExternalReference(payment.externalReference);
    let currentSubscriptionRowId: string | null = null;

    if (subscriptionId) {
      currentSubscriptionRowId = subscriptionId;
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
    } else if (pixAutoAuthId) {
      currentSubscriptionRowId = `pixauto_${pixAutoAuthId}`;
      // Cobrança do mês 2 em diante de Pix Automático — o assinante já
      // existe (criado na autorização inicial), só não veio
      // externalReference nesta cobrança específica; recupera
      // accountId/planKey da nossa própria tabela quando faltar.
      if (!accountId || !planKey) {
        const { data: assinante } = await supabaseAdmin
          .from('assinantes')
          .select('account_id, plan_name')
          .eq('pix_automatic_authorization_id', pixAutoAuthId)
          .maybeSingle();
        accountId = accountId ?? (assinante?.account_id as string | null) ?? null;
        planKey = planKey ?? (assinante?.plan_name as string | null) ?? null;
      }
      const update: Record<string, unknown> = { last_event: event, updated_at: new Date().toISOString() };
      if (status) update.status = status;
      const { error } = await supabaseAdmin.from('assinantes').update(update).eq('pix_automatic_authorization_id', pixAutoAuthId);
      if (error) console.error('Erro ao atualizar assinante (cobrança recorrente Pix Automático):', error.message);
    } else {
      console.warn(`Webhook Asaas evento ${event} sem subscription/autorização Pix Automático vinculada (payment ${payment.id}).`);
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
