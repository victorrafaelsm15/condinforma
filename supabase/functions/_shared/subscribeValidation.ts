// Validação pura dos dados de entrada do checkout — extraída de
// subscribe/index.ts pra poder ser testada com Vitest sem precisar do
// runtime Deno.

export const VALID_BILLING_TYPES = new Set(['PIX', 'CREDIT_CARD', 'BOLETO']);

export function isValidEmail(email: string | undefined | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

export function onlyDigits(value: string | undefined | null): string {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCpfCnpj(cpfCnpj: string | undefined | null): boolean {
  const clean = onlyDigits(cpfCnpj);
  return clean.length === 11 || clean.length === 14;
}

export function isValidPhone(phone: string | undefined | null): boolean {
  return onlyDigits(phone).length >= 10;
}

export type SubscribeInput = {
  planName?: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  billingType?: string;
  cep?: string;
  addressNumber?: string;
  creditCard?: { number?: string; holderName?: string; expiryMonth?: string; expiryYear?: string; ccv?: string };
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

// Mesma sequência de checagens do handler original — devolve o primeiro
// erro encontrado, exatamente como a resposta HTTP 400 fazia antes.
export function validateSubscribeInput(input: SubscribeInput, planPrices: Record<string, number>): ValidationResult {
  const price = planPrices[input.planName ?? ''];
  if (!price) return { ok: false, error: 'Plano inválido.' };
  if (!input.name?.trim()) return { ok: false, error: 'Informe seu nome.' };
  if (!isValidEmail(input.email)) return { ok: false, error: 'Informe um e-mail válido.' };
  if (!isValidCpfCnpj(input.cpfCnpj)) return { ok: false, error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' };
  if (!isValidPhone(input.phone)) return { ok: false, error: 'Informe um telefone válido com DDD.' };
  if (!input.billingType || !VALID_BILLING_TYPES.has(input.billingType)) {
    return { ok: false, error: 'Escolha uma forma de pagamento.' };
  }
  if (input.billingType === 'CREDIT_CARD') {
    const c = input.creditCard;
    if (!c?.number || !c?.holderName || !c?.expiryMonth || !c?.expiryYear || !c?.ccv) {
      return { ok: false, error: 'Preencha todos os dados do cartão.' };
    }
    if (onlyDigits(input.cep).length !== 8 || !input.addressNumber?.trim()) {
      return { ok: false, error: 'Informe o CEP e o número do endereço de cobrança.' };
    }
  }
  return { ok: true };
}
