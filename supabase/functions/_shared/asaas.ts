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

type SubscriptionInput = { customerId: string; value: number; description: string; externalReference: string };

// Cria uma assinatura mensal. billingType "UNDEFINED" deixa o cliente escolher
// Pix, boleto ou cartão na própria página de pagamento do Asaas.
export async function createSubscription({ customerId, value, description, externalReference }: SubscriptionInput) {
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);

  return asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'UNDEFINED',
      cycle: 'MONTHLY',
      value,
      description,
      nextDueDate: nextDueDate.toISOString().slice(0, 10),
      externalReference,
    }),
  });
}

// Pega o link de pagamento (invoiceUrl) da primeira cobrança gerada pela assinatura.
export async function getFirstPaymentLink(subscriptionId: string): Promise<string> {
  const payments = await asaasFetch(`/subscriptions/${subscriptionId}/payments`);
  const first = payments?.data?.[0];
  if (!first) throw new Error('Nenhuma cobrança encontrada para essa assinatura ainda.');
  return first.invoiceUrl;
}
