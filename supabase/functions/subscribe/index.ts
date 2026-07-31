// Edge Function pública: recebe os dados do formulário de assinatura do site,
// cria (ou reaproveita) o cliente no Asaas, cria a assinatura mensal e devolve
// a URL da página de pagamento (Pix, boleto ou cartão).
//
// Chamada pelo navegador com a publishable/anon key (ver PricingSection.jsx).
// verify_jwt = false no config.toml — a validação de quem pode chamar fica
// por conta da própria publishable key, que já é pública por natureza.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { findOrCreateCustomer, createSubscription, getFirstPaymentLink } from '../_shared/asaas.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

// Preço de cada plano é definido AQUI, no servidor — nunca confiar em um
// valor de preço vindo do cliente, senão qualquer pessoa poderia manipular
// o request e assinar o plano Business pagando o preço do Start.
const PLAN_PRICES: Record<string, number> = {
  Start: 49,
  Pro: 149,
  Business: 299,
};

function isValidEmail(email: string | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function onlyDigits(value: string | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

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

  const { planName, name, email, cpfCnpj, phone } = await req.json().catch(() => ({}));

  const price = PLAN_PRICES[planName];
  if (!price) return jsonResponse({ error: 'Plano inválido.' }, 400);
  if (!name?.trim()) return jsonResponse({ error: 'Informe seu nome.' }, 400);
  if (!isValidEmail(email)) return jsonResponse({ error: 'Informe um e-mail válido.' }, 400);

  const cleanCpfCnpj = onlyDigits(cpfCnpj);
  if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
    return jsonResponse({ error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' }, 400);
  }
  if (onlyDigits(phone).length < 10) {
    return jsonResponse({ error: 'Informe um telefone válido com DDD.' }, 400);
  }

  try {
    const customer = await findOrCreateCustomer({ name, email, cpfCnpj: cleanCpfCnpj, phone });

    const subscription = await createSubscription({
      customerId: customer.id,
      value: price,
      description: `Cond-Informa — Plano ${planName}`,
      externalReference: planName,
    });

    const paymentUrl = await getFirstPaymentLink(subscription.id);

    // Registra o assinante como "pendente" já de cara — o webhook depois
    // atualiza o status conforme os eventos de pagamento chegarem.
    const { error: dbError } = await supabaseAdmin.from('assinantes').upsert({
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      name,
      email,
      plan_name: planName,
      status: 'pendente',
      last_event: 'SUBSCRIPTION_CREATED',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'asaas_subscription_id' });

    if (dbError) {
      console.error('Erro ao gravar assinante no Supabase:', dbError.message);
      // Não bloqueia o fluxo do cliente por causa disso — o webhook tenta de novo depois.
    }

    return jsonResponse({ paymentUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro ao criar assinatura no Asaas:', message);
    return jsonResponse({ error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.' }, 502);
  }
});
