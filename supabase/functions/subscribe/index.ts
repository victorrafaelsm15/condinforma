// Edge Function pública: recebe os dados do formulário de assinatura do
// site, cria (ou reaproveita) o cliente no Asaas e cria a assinatura.
//
// Checkout transparente: o cliente nunca é redirecionado pro Asaas — pra
// Pix devolvemos o QR Code (imagem + copia-e-cola) direto no JSON; pra
// boleto devolvemos o link do PDF e a linha digitável; pra cartão os dados
// são processados aqui, do lado do servidor, e o Asaas tenta cobrar na
// hora (nunca expomos ASAAS_API_KEY nem processamos cartão no navegador).
// A resposta só traz dados da cobrança do CLIENTE — nunca informações da
// conta Asaas da plataforma (nome, CNPJ, endereço do dono do site).
//
// Chamada pelo navegador com a publishable/anon key (ver AssinaturaPage.jsx).
// verify_jwt = false no config.toml — mas a função exige e valida, ELA
// MESMA, o token de sessão do usuário logado (Authorization: Bearer), pra
// saber a qual conta (account_id) vincular a assinatura. Sem isso, o
// webhook não teria como saber qual conta liberar quando o pagamento cair.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { findOrCreateCustomer, createSubscription, getFirstPayment, getPixQrCode } from '../_shared/asaas.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { PLAN_PRICES } from '../_shared/plans.ts';
import { validateAndApplyCoupon, incrementCouponUsage } from '../_shared/cupons.ts';
import { validateSubscribeInput, onlyDigits } from '../_shared/subscribeValidation.ts';

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

  const {
    planName, name, email, cpfCnpj, phone, billingType, couponCode, creditCard, cep, addressNumber,
  } = await req.json().catch(() => ({}));

  const validation = validateSubscribeInput(
    { planName, name, email, cpfCnpj, phone, billingType, cep, addressNumber, creditCard },
    PLAN_PRICES,
  );
  if (!validation.ok) return jsonResponse({ error: validation.error }, 400);

  const price = PLAN_PRICES[planName];
  const cleanCpfCnpj = onlyDigits(cpfCnpj);
  const cleanPhone = onlyDigits(phone);

  let creditCardPayload;
  let creditCardHolderInfoPayload;
  if (billingType === 'CREDIT_CARD') {
    const cleanCep = onlyDigits(cep);
    creditCardPayload = {
      holderName: creditCard.holderName,
      number: onlyDigits(creditCard.number),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      ccv: creditCard.ccv,
    };
    creditCardHolderInfoPayload = {
      name, email, cpfCnpj: cleanCpfCnpj, postalCode: cleanCep, addressNumber: addressNumber.trim(), phone: cleanPhone,
    };
  }

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
    const customer = await findOrCreateCustomer({ name, email, cpfCnpj: cleanCpfCnpj, phone: cleanPhone });

    const subscription = await createSubscription({
      customerId: customer.id,
      value: finalValue,
      description: `Cond-Informa — Plano ${planName}`,
      billingType,
      creditCard: creditCardPayload,
      creditCardHolderInfo: creditCardHolderInfoPayload,
      remoteIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      // "account_id:planName" — é assim que o webhook, ao receber o evento
      // de pagamento de volta do Asaas, sabe qual conta liberar e com qual
      // plano/limite, sem precisar adivinhar ou comparar valor pago.
      externalReference: `${accountId}:${planName}`,
    });

    const payment = await getFirstPayment(subscription.id);

    // Registra o assinante como "pendente" já de cara — o webhook depois
    // atualiza o status conforme os eventos de pagamento chegarem.
    const { error: dbError } = await supabaseAdmin.from('assinantes').upsert({
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      account_id: accountId,
      name,
      email,
      phone: cleanPhone,
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

    // Monta a resposta do checkout transparente — só o necessário pra
    // renderizar o pagamento na própria tela, nada da conta da plataforma.
    if (billingType === 'PIX') {
      const pix = await getPixQrCode(payment.id);
      return jsonResponse({
        type: 'PIX',
        value: finalValue,
        qrCodeImage: pix.encodedImage,
        copyPaste: pix.payload,
        expirationDate: pix.expirationDate,
      });
    }
    if (billingType === 'BOLETO') {
      return jsonResponse({
        type: 'BOLETO',
        value: finalValue,
        bankSlipUrl: payment.bankSlipUrl,
        identificationField: payment.identificationField,
        dueDate: payment.dueDate,
      });
    }
    // CREDIT_CARD: o Asaas já tentou cobrar dentro da própria criação da
    // assinatura — o status da primeira cobrança diz se aprovou ou não.
    return jsonResponse({
      type: 'CREDIT_CARD',
      value: finalValue,
      status: payment.status,
      approved: payment.status === 'CONFIRMED' || payment.status === 'RECEIVED',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro ao criar assinatura no Asaas:', message);
    return jsonResponse({ error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.' }, 502);
  }
});
