// Edge Function pública: recebe eventos do Asaas (PAYMENT_CONFIRMED,
// PAYMENT_RECEIVED, PAYMENT_OVERDUE etc.) e atualiza o status do assinante
// na tabela "assinantes".
//
// Quem chama aqui é o servidor do Asaas, não o Supabase Auth — por isso a
// validação é feita manualmente pelo header "asaas-access-token" (configurado
// no painel do Asaas ao cadastrar a URL do webhook), e verify_jwt = false no
// config.toml pra o gateway do Supabase não exigir apikey/JWT.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

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

  try {
    if (subscriptionId) {
      const update: Record<string, unknown> = {
        asaas_subscription_id: subscriptionId,
        asaas_customer_id: customerId,
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

    return jsonResponse({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro ao processar webhook do Asaas:', message);
    // Ainda assim responde 200: o erro é nosso (Supabase fora do ar, etc.),
    // não do Asaas, e deixar ele retentando não resolve sozinho.
    return jsonResponse({ received: true, warning: 'Falha ao gravar no banco, ver logs.' });
  }
});
