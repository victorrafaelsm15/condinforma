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
import {
  findOrCreateCustomer, createSubscription, getFirstPayment, updatePaymentValue,
  createPixAutomaticAuthorization,
} from '../_shared/asaas.ts';
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
    const result = await validateAndApplyCoupon(supabaseAdmin, couponCode, price, planName);
    if (!result.ok) {
      return jsonResponse({ error: result.message, field: 'coupon' }, 400);
    }
    finalValue = result.finalValue;
    couponId = result.couponId;

    // Cartão é cobrado de forma síncrona dentro da própria criação da
    // assinatura (Asaas tenta a captura na hora) — não dá pra aplicar o
    // desconto DEPOIS via updatePaymentValue nesse caso, e cobrar o valor
    // cheio no cartão enquanto a tela mostra o valor com desconto seria
    // uma cobrança errada de verdade no cartão da pessoa. Até existir um
    // fluxo que aplique o desconto antes da captura do cartão, cupom só
    // funciona com Pix/Boleto.
    if (billingType === 'CREDIT_CARD') {
      return jsonResponse({
        error: 'Cupons de desconto são válidos apenas para pagamento via Pix ou Boleto no momento. Escolha um desses métodos para usar o cupom, ou continue no cartão sem cupom.',
        field: 'coupon',
      }, 400);
    }
  }

  try {
    const customer = await findOrCreateCustomer({ name, email, cpfCnpj: cleanCpfCnpj, phone: cleanPhone });

    // Pix Automático: diferente de Boleto/Cartão, aqui não existe uma
    // "subscription" clássica da Asaas — a autorização de débito recorrente
    // É o mecanismo recorrente. As cobranças do mês 2 em diante são criadas
    // por fora, pela função agendada pix-automatic-billing (ver
    // supabase/pix_automatico_migration.sql), sempre na janela de 2 a 10
    // dias úteis antes do vencimento exigida pela Asaas.
    if (billingType === 'PIX') {
      const startDate = new Date().toISOString().slice(0, 10);
      const authorization = await createPixAutomaticAuthorization({
        customerId: customer.id,
        // Contrato precisa ser único e <= 35 caracteres — accountId (uuid)
        // sem hífens já garante isso e é suficiente pra rastrear no painel
        // Asaas; a conta em si é resolvida no webhook por
        // pix_automatic_authorization_id, não pelo contractId.
        contractId: accountId.replace(/-/g, ''),
        value: price,
        firstChargeValue: finalValue,
        description: `Cond Informa — Plano ${planName}`,
        startDate,
      });

      const { error: dbError } = await supabaseAdmin.from('assinantes').upsert({
        // Chave primária da tabela é asaas_subscription_id (texto, não
        // nulo) — não existe subscription id aqui, então usamos um valor
        // sintético derivado da autorização pra manter a mesma tabela sem
        // precisar migrar a PK. A correlação real de verdade pro webhook é
        // pix_automatic_authorization_id.
        asaas_subscription_id: `pixauto_${authorization.id}`,
        asaas_customer_id: customer.id,
        account_id: accountId,
        name,
        email,
        phone: cleanPhone,
        cpf_cnpj: cleanCpfCnpj,
        plan_name: planName,
        status: 'pendente',
        last_event: 'PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED',
        pix_automatic_authorization_id: authorization.id,
        pix_automatic_status: authorization.status || 'CREATED',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'asaas_subscription_id' });
      if (dbError) {
        console.error('Erro ao gravar assinante (Pix Automático) no Supabase:', dbError.message);
      }

      if (couponId) await incrementCouponUsage(supabaseAdmin, couponId);

      return jsonResponse({
        type: 'PIX',
        value: finalValue,
        qrCodeImage: authorization.encodedImage,
        copyPaste: authorization.payload,
        expirationDate: authorization.immediateQrCode?.expirationDate,
      });
    }

    // Boleto/Cartão continuam no modelo de assinatura clássico da Asaas.
    // Sempre cria a assinatura pelo valor CHEIO do plano — o desconto do
    // cupom nunca entra aqui, senão ele se propagaria pra todas as
    // cobranças recorrentes (é o valor da assinatura que a Asaas usa como
    // template pra gerar cada cobrança futura do ciclo mensal).
    const subscription = await createSubscription({
      customerId: customer.id,
      value: price,
      description: `Cond Informa — Plano ${planName}`,
      billingType,
      creditCard: creditCardPayload,
      creditCardHolderInfo: creditCardHolderInfoPayload,
      remoteIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      // "account_id:planName" — é assim que o webhook, ao receber o evento
      // de pagamento de volta do Asaas, sabe qual conta liberar e com qual
      // plano/limite, sem precisar adivinhar ou comparar valor pago.
      externalReference: `${accountId}:${planName}`,
    });

    let payment = await getFirstPayment(subscription.id);

    // Desconto do cupom vai só nesta cobrança específica (nunca na
    // assinatura). Só é possível quando a cobrança ainda está PENDING — a
    // Asaas rejeita alterar valor de cobrança já paga, e cartão é
    // capturado de forma síncrona na própria criação da assinatura acima
    // (chega aqui já CONFIRMED/RECEIVED/DENIED), então pra CREDIT_CARD o
    // desconto do cupom não tem como ser aplicado por este caminho.
    if (couponId && finalValue !== price) {
      if (payment.status === 'PENDING') {
        try {
          payment = await updatePaymentValue(payment.id, finalValue);
        } catch (updateErr) {
          console.error('Erro ao aplicar desconto do cupom na primeira cobrança:', updateErr instanceof Error ? updateErr.message : updateErr);
        }
      } else {
        console.warn(`Cupom aplicado mas cobrança ${payment.id} já não está PENDING (status ${payment.status}) — desconto não pôde ser aplicado (billingType ${billingType}).`);
      }
    }

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
    // PIX não chega aqui (retorna mais acima, via Pix Automático).
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
    const status = (err as { status?: number })?.status;
    const asaasResponse = (err as { asaasResponse?: unknown })?.asaasResponse;
    // Log detalhado pra causa raiz nunca mais ficar escondida atrás da
    // mensagem genérica que o usuário vê — inclui o corpo de erro que a
    // Asaas devolveu, não só a mensagem resumida.
    console.error('Erro ao criar assinatura no Asaas:', {
      message, status, asaasResponse, planName, billingType, couponApplied: !!couponId, finalValue,
    });

    // Se um cupom foi aplicado e a Asaas rejeitou por causa do valor
    // (ex.: desconto grande demais deixando a cobrança abaixo do mínimo
    // aceito), isso é um problema do CUPOM, não uma falha genérica de
    // comunicação — devolve erro específico no campo do cupom em vez do
    // "tente novamente" (o piso em validateAndApplyCoupon já evita isso
    // no caso comum; isto é só uma rede de segurança pra qualquer outra
    // situação de valor que a Asaas venha a rejeitar).
    if (couponId && /m[íi]nimo|valor/i.test(message)) {
      return jsonResponse({
        error: 'Esse cupom deixa o valor da assinatura abaixo do mínimo aceito para cobrança. Tente outro cupom ou continue sem cupom.',
        field: 'coupon',
      }, 400);
    }

    return jsonResponse({ error: 'Não foi possível criar a assinatura agora. Tente novamente em instantes.' }, 502);
  }
});
