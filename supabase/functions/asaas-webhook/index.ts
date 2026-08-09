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
import { resolveStatusFromEvent, parseExternalReference, shouldLogPlanChange } from '../_shared/webhookLogic.ts';

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

  const status = resolveStatusFromEvent(event);

  const subscriptionId = payment.subscription;
  const customerId = payment.customer;

  const { accountId, planKey } = parseExternalReference(payment.externalReference);

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
          asaas_customer_id: customerId,
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

    return jsonResponse({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro ao processar webhook do Asaas:', message);
    // Ainda assim responde 200: o erro é nosso (Supabase fora do ar, etc.),
    // não do Asaas, e deixar ele retentando não resolve sozinho.
    return jsonResponse({ received: true, warning: 'Falha ao gravar no banco, ver logs.' });
  }
});
