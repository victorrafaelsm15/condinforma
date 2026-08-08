// Edge Function pública: recebe os dados do formulário de assinatura do site,
// cria (ou reaproveita) o cliente no Asaas, cria a assinatura mensal e devolve
// a URL da página de pagamento (Pix, boleto ou cartão).
//
// Chamada pelo navegador com a publishable/anon key (ver PricingSection.jsx).
// verify_jwt = false no config.toml — mas a função exige e valida, ELA
// MESMA, o token de sessão do usuário logado (Authorization: Bearer), pra
// saber a qual conta (account_id) vincular a assinatura. Sem isso, o
// webhook não teria como saber qual conta liberar quando o pagamento cair.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { findOrCreateCustomer, createSubscription, getFirstPaymentLink } from '../_shared/asaas.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { PLAN_PRICES } from '../_shared/plans.ts';
import { validateAndApplyCoupon, incrementCouponUsage } from '../_shared/cupons.ts';

const VALID_BILLING_TYPES = new Set(['PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED']);

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

  // A conta é sempre derivada do token de sessão validado — nunca de um
  // campo accountId enviado no corpo, que qualquer um poderia forjar.
  const authHeader = req.headers.get('authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return jsonResponse({ error: 'Não autenticado. Crie sua conta antes de assinar.' }, 401);
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Sessão inválida ou expirada. Cadastre-se novamente.' }, 401);
  }
  const accountId = userData.user.id;

  const { planName, name, email, cpfCnpj, phone, billingType, couponCode } = await req.json().catch(() => ({}));

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
  const resolvedBillingType = VALID_BILLING_TYPES.has(billingType) ? billingType : 'UNDEFINED';

  // Cupom é opcional — se informado, precisa ser válido. Não deixa a pessoa
  // continuar "sem querer" pagando o preço cheio por causa de um cupom
  // digitado errado: erro específico, sem criar nada no Asaas ainda.
  let finalValue = price;
  let couponId: string | null = null;
  if (couponCode?.trim()) {
    const result = await validateAndApplyCoupon(supabaseAdmin, couponCode, price);
    if (!result.ok) {
      return jsonResponse({ error: result.message, field: 'coupon' }, 400);
    }
    finalValue = result.finalValue;
    couponId = result.couponId;
  }

  try {
    const customer = await findOrCreateCustomer({ name, email, cpfCnpj: cleanCpfCnpj, phone });

    const subscription = await createSubscription({
      customerId: customer.id,
      value: finalValue,
      description: `Cond-Informa — Plano ${planName}`,
      billingType: resolvedBillingType,
      // "account_id:planName" — é assim que o webhook, ao receber o evento
      // de pagamento de volta do Asaas, sabe qual conta liberar e com qual
      // plano/limite, sem precisar adivinhar ou comparar valor pago.
      externalReference: `${accountId}:${planName}`,
    });

    const paymentUrl = await getFirstPaymentLink(subscription.id);

    // Registra o assinante como "pendente" já de cara — o webhook depois
    // atualiza o status conforme os eventos de pagamento chegarem.
    const { error: dbError } = await supabaseAdmin.from('assinantes').upsert({
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      account_id: accountId,
      name,
      email,
      phone,
      cpf_cnpj: cleanCpfCnpj,
      plan_name: planName,
      status: 'pendente',
      last_event: 'SUBSCRIPTION_CREATED',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'asaas_subscription_id' });

    if (dbError) {
      console.error('Erro ao gravar assinante no Supabase:', dbError.message);
      // Não bloqueia o fluxo do cliente por causa disso — o webhook tenta de novo depois.
    }

    if (couponId) await incrementCouponUsage(supabaseAdmin, couponId);

    return jsonResponse({ paymentUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro ao criar assinatura no Asaas:', message);
    return jsonResponse({ error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.' }, 502);
  }
});
