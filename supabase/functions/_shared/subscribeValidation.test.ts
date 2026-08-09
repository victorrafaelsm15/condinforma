import { describe, it, expect } from 'vitest';
import { validateSubscribeInput, isValidEmail, isValidCpfCnpj, isValidPhone, onlyDigits } from './subscribeValidation.ts';
import { PLAN_PRICES } from './plans.ts';

const validBase = {
  planName: 'Pro',
  name: 'Maria Teste',
  email: 'maria@example.com',
  cpfCnpj: '123.456.789-09',
  phone: '(11) 91234-5678',
  billingType: 'PIX',
};

describe('helpers', () => {
  it('isValidEmail aceita e-mails válidos e rejeita inválidos', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('invalido')).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });

  it('onlyDigits remove tudo que não é número', () => {
    expect(onlyDigits('123.456.789-09')).toBe('12345678909');
    expect(onlyDigits(null)).toBe('');
  });

  it('isValidCpfCnpj aceita 11 (CPF) ou 14 (CNPJ) dígitos', () => {
    expect(isValidCpfCnpj('123.456.789-09')).toBe(true);
    expect(isValidCpfCnpj('12.345.678/0001-95')).toBe(true);
    expect(isValidCpfCnpj('123')).toBe(false);
  });

  it('isValidPhone exige DDD + número (mínimo 10 dígitos)', () => {
    expect(isValidPhone('(11) 91234-5678')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('validateSubscribeInput', () => {
  it('aceita um payload PIX válido', () => {
    expect(validateSubscribeInput(validBase, PLAN_PRICES)).toEqual({ ok: true });
  });

  it('calcula o valor correto a partir do plano escolhido', () => {
    expect(PLAN_PRICES.Start).toBe(49);
    expect(PLAN_PRICES.Pro).toBe(149);
    expect(PLAN_PRICES.Business).toBe(299);
  });

  it('rejeita plano inválido', () => {
    const result = validateSubscribeInput({ ...validBase, planName: 'Inexistente' }, PLAN_PRICES);
    expect(result).toEqual({ ok: false, error: 'Plano inválido.' });
  });

  it('rejeita nome ausente/vazio', () => {
    expect(validateSubscribeInput({ ...validBase, name: '' }, PLAN_PRICES).ok).toBe(false);
    expect(validateSubscribeInput({ ...validBase, name: '   ' }, PLAN_PRICES).ok).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const result = validateSubscribeInput({ ...validBase, email: 'nao-e-email' }, PLAN_PRICES);
    expect(result).toEqual({ ok: false, error: 'Informe um e-mail válido.' });
  });

  it('rejeita CPF/CNPJ inválido', () => {
    const result = validateSubscribeInput({ ...validBase, cpfCnpj: '123' }, PLAN_PRICES);
    expect(result).toEqual({ ok: false, error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' });
  });

  it('rejeita telefone inválido', () => {
    const result = validateSubscribeInput({ ...validBase, phone: '123' }, PLAN_PRICES);
    expect(result).toEqual({ ok: false, error: 'Informe um telefone válido com DDD.' });
  });

  it('rejeita forma de pagamento ausente/inválida', () => {
    expect(validateSubscribeInput({ ...validBase, billingType: undefined }, PLAN_PRICES).ok).toBe(false);
    expect(validateSubscribeInput({ ...validBase, billingType: 'DINHEIRO' }, PLAN_PRICES).ok).toBe(false);
  });

  it('exige dados do cartão quando billingType é CREDIT_CARD', () => {
    const result = validateSubscribeInput({ ...validBase, billingType: 'CREDIT_CARD' }, PLAN_PRICES);
    expect(result).toEqual({ ok: false, error: 'Preencha todos os dados do cartão.' });
  });

  it('exige CEP e número do endereço quando billingType é CREDIT_CARD', () => {
    const result = validateSubscribeInput({
      ...validBase,
      billingType: 'CREDIT_CARD',
      creditCard: { number: '4111111111111111', holderName: 'Maria', expiryMonth: '12', expiryYear: '2030', ccv: '123' },
    }, PLAN_PRICES);
    expect(result).toEqual({ ok: false, error: 'Informe o CEP e o número do endereço de cobrança.' });
  });

  it('aceita um payload CREDIT_CARD completo', () => {
    const result = validateSubscribeInput({
      ...validBase,
      billingType: 'CREDIT_CARD',
      cep: '01310-100',
      addressNumber: '1000',
      creditCard: { number: '4111111111111111', holderName: 'Maria', expiryMonth: '12', expiryYear: '2030', ccv: '123' },
    }, PLAN_PRICES);
    expect(result).toEqual({ ok: true });
  });
});
