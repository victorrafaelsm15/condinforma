// Cliente server-side da API do Asaas (https://docs.asaas.com).
// Roda só dentro de Edge Functions — ASAAS_API_KEY é secreta e nunca deve
// existir em código que roda no navegador.

const BASE_URL = Deno.env.get('ASAAS_ENV') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

function getApiKey(): string {
  const key = Deno.env.get('ASAAS_API_KEY');
  if (!key) throw new Error('ASAAS_API_KEY não configurada nos secrets da função.');
  return key;
}

async function asaasFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: getApiKey(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.errors?.[0]?.description || data?.message || `Asaas retornou ${res.status}`;
    const error = new Error(message) as Error & { status?: number; asaasResponse?: unknown };
    error.status = res.status;
    error.asaasResponse = data;
    throw error;
  }
  return data;
}

function onlyDigits(value: string | undefined | null): string {
  return String(value || '').replace(/\D/g, '');
}

type CustomerInput = { name: string; email: string; cpfCnpj: string; phone: string };

// Busca um cliente existente pelo CPF/CNPJ; cria um novo se não encontrar.
export async function findOrCreateCustomer({ name, email, cpfCnpj, phone }: CustomerInput) {
  const cleanCpfCnpj = onlyDigits(cpfCnpj);
  const cleanPhone = onlyDigits(phone);

  const existing = await asaasFetch(`/customers?cpfCnpj=${cleanCpfCnpj}`);
  if (existing?.data?.length) {
    return existing.data[0];
  }

  return asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({ name, email, cpfCnpj: cleanCpfCnpj, mobilePhone: cleanPhone }),
  });
}

type CreditCardInput = { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
type CreditCardHolderInfoInput = { name: string; email: string; cpfCnpj: string; postalCode: string; addressNumber: string; phone: string };

type SubscriptionInput = {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
  billingType?: string;
  creditCard?: CreditCardInput;
  creditCardHolderInfo?: CreditCardHolderInfoInput;
  remoteIp?: string;
};

// Cria uma assinatura mensal. Checkout transparente: quando billingType é
// PIX/BOLETO/CREDIT_CARD (nunca "UNDEFINED"), o cliente paga sem sair do
// nosso site — pra cartão, os dados vêm de creditCard/creditCardHolderInfo
// e o Asaas tenta cobrar na hora, direto nesta chamada (sem redirecionar
// pra lugar nenhum).
export async function createSubscription({
  customerId, value, description, externalReference, billingType, creditCard, creditCardHolderInfo, remoteIp,
}: SubscriptionInput) {
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);

  const body: Record<string, unknown> = {
    customer: customerId,
    billingType: billingType || 'UNDEFINED',
    cycle: 'MONTHLY',
    value,
    description,
    nextDueDate: nextDueDate.toISOString().slice(0, 10),
    externalReference,
  };
  if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
    body.creditCard = creditCard;
    body.creditCardHolderInfo = creditCardHolderInfo;
    body.remoteIp = remoteIp || '0.0.0.0';
  }

  return asaasFetch('/subscriptions', { method: 'POST', body: JSON.stringify(body) });
}

// Primeira cobrança gerada pela assinatura — é dela que tiramos o QR Code
// Pix, o boleto ou o resultado da cobrança no cartão, pra exibir tudo na
// própria página (checkout transparente, sem redirecionar pro Asaas).
export async function getFirstPayment(subscriptionId: string) {
  const payments = await asaasFetch(`/subscriptions/${subscriptionId}/payments`);
  const first = payments?.data?.[0];
  if (!first) throw new Error('Nenhuma cobrança encontrada para essa assinatura ainda.');
  return first;
}

// QR Code Pix (imagem em base64 + código copia-e-cola) de uma cobrança.
export async function getPixQrCode(paymentId: string) {
  return asaasFetch(`/payments/${paymentId}/pixQrCode`);
}

// Cancela uma assinatura no Asaas — usado quando o cliente troca de plano,
// pra não deixar a assinatura antiga cobrando em paralelo com a nova.
export async function cancelSubscription(subscriptionId: string) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

// Atualiza o valor de UMA cobrança específica (nunca a assinatura toda) —
// usado pra aplicar o desconto do cupom só na primeira cobrança, mantendo
// o valor cheio nas cobranças seguintes. A Asaas só aceita alterar o valor
// de cobranças com status PENDING; chamar isso numa cobrança já paga
// (cartão, cuja captura é síncrona na criação da assinatura) retorna erro —
// por isso o chamador deve checar payment.status antes de chamar.
// IMPORTANTE: nunca passar updatePendingPayments — isso propagaria o novo
// valor pra cobranças futuras da assinatura, que é exatamente o oposto do
// que queremos aqui.
export async function updatePaymentValue(paymentId: string, newValue: number) {
  return asaasFetch(`/payments/${paymentId}`, {
    method: 'PUT',
    body: JSON.stringify({ value: newValue }),
  });
}

type PixAutomaticAuthorizationInput = {
  customerId: string;
  contractId: string;
  value: number;
  description: string;
  startDate: string; // YYYY-MM-DD
};

// Cria a autorização de Pix Automático + QR Code imediato da primeira
// cobrança, num único request (POST /v3/pix/automatic/authorizations).
// paymentCreationMode 'MANUAL': a autorização em si NÃO gera cobrança
// nenhuma sozinha a partir do mês 2 — é o app que precisa criar cada
// cobrança futura chamando POST /v3/payments com
// pixAutomaticAuthorizationId (ver createPixAutomaticCharge abaixo),
// sempre entre 2 e 10 dias úteis antes do vencimento (exigência da Asaas,
// não escolha nossa). Ver supabase/functions/_shared/asaas.ts — a
// alternativa (paymentCreationMode: 'SUBSCRIPTION') deixaria a Asaas gerar
// as cobranças futuras sozinha, mas ainda não foi validada nesta
// integração — não trocar sem confirmar o comportamento real com a Asaas.
export async function createPixAutomaticAuthorization({
  customerId, contractId, value, description, startDate,
}: PixAutomaticAuthorizationInput) {
  return asaasFetch('/pix/automatic/authorizations', {
    method: 'POST',
    body: JSON.stringify({
      customerId,
      contractId,
      startDate,
      value,
      description,
      paymentCreationMode: 'MANUAL',
      immediateQrCode: {
        expirationSeconds: 3600,
        originalValue: value,
        description,
      },
    }),
  });
}

// Cria a cobrança de um mês (2º em diante) vinculada a uma autorização de
// Pix Automático já ATIVA. A Asaas debita automaticamente do pagador sem
// novo QR Code/confirmação manual — mas só aceita a criação entre 2 e 10
// dias úteis antes do vencimento escolhido (dueDate), por isso não pode
// ser criada com muita antecedência.
export async function createPixAutomaticCharge({
  customerId, value, description, dueDate, pixAutomaticAuthorizationId, externalReference,
}: {
  customerId: string; value: number; description: string; dueDate: string;
  pixAutomaticAuthorizationId: string; externalReference?: string;
}) {
  return asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value,
      description,
      dueDate,
      pixAutomaticAuthorizationId,
      externalReference,
    }),
  });
}
