import { describe, it, expect, vi } from 'vitest';
import {
  validateAndApplyCoupon, incrementCouponUsage, registerCouponSubscription, applyCouponToRecurringPayment,
} from './cupons.ts';

// Mock mínimo do client do Supabase — só o suficiente pra simular a cadeia
// .from('cupons').select('*').ilike('codigo', code).maybeSingle() usada por
// validateAndApplyCoupon, e .select/.update usados por incrementCouponUsage.
function mockSupabase(coupon: Record<string, unknown> | null, { selectError = false } = {}) {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(
            selectError ? { data: null, error: new Error('db error') } : { data: coupon, error: null },
          ),
        }),
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: coupon, error: null }),
        }),
      }),
      update: updateMock,
    }),
  };
  return { client, updateMock };
}

const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

describe('validateAndApplyCoupon', () => {
  it('aplica corretamente um cupom percentual', async () => {
    const { client } = mockSupabase({
      id: 'c1', codigo: 'PROMO10', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'PROMO10', 100);
    expect(result).toEqual({
      ok: true, finalValue: 90, couponId: 'c1', tipo: 'percentual', valor: 10, remainingCharges: 0,
    });
  });

  it('aplica corretamente um cupom de valor fixo', async () => {
    const { client } = mockSupabase({
      id: 'c2', codigo: 'DEZOFF', ativo: true, tipo: 'fixo', valor: 20, validade: future, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'DEZOFF', 100);
    expect(result).toEqual({
      ok: true, finalValue: 80, couponId: 'c2', tipo: 'fixo', valor: 20, remainingCharges: 0,
    });
  });

  it('sem duracao_cobrancas definida, trata como cupom de cobrança única (comportamento anterior)', async () => {
    const { client } = mockSupabase({
      id: 'c12', codigo: 'ANTIGO', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'ANTIGO', 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.remainingCharges).toBe(0);
  });

  it('duracao_cobrancas > 1 devolve quantas cobranças futuras ainda recebem desconto', async () => {
    const { client } = mockSupabase({
      id: 'c13', codigo: 'TRESMESES', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0, duracao_cobrancas: 3,
    });
    const result = await validateAndApplyCoupon(client as never, 'TRESMESES', 100);
    expect(result.ok).toBe(true);
    // 3 cobranças no total: a primeira já é aplicada na hora, sobram 2.
    if (result.ok) expect(result.remainingCharges).toBe(2);
  });

  it('duracao_cobrancas null é desconto recorrente sem prazo (remainingCharges null)', async () => {
    const { client } = mockSupabase({
      id: 'c14', codigo: 'VITALICIO', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0, duracao_cobrancas: null,
    });
    const result = await validateAndApplyCoupon(client as never, 'VITALICIO', 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.remainingCharges).toBe(null);
  });

  it('nunca deixa o valor final cair abaixo do mínimo cobrável pela Asaas (R$5)', async () => {
    const { client } = mockSupabase({
      id: 'c3', codigo: 'QUASETUDO', ativo: true, tipo: 'fixo', valor: 999, validade: future, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'QUASETUDO', 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.finalValue).toBe(5);
  });

  it('aplica o piso de R$5 quando um desconto percentual agressivo deixaria o valor abaixo disso', async () => {
    // Caso real que causava o bug: plano de R$49 + cupom de 99% de
    // desconto = R$0,49, que a Asaas rejeitava por estar abaixo do
    // mínimo cobrável — devia virar R$5, não R$0,49 nem R$1.
    const { client } = mockSupabase({
      id: 'c8', codigo: 'VICTOR', ativo: true, tipo: 'percentual', valor: 99, validade: null, limite_usos: 2, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'VICTOR', 49);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.finalValue).toBe(5);
  });

  it('rejeita cupom inexistente', async () => {
    const { client } = mockSupabase(null);
    const result = await validateAndApplyCoupon(client as never, 'NAOEXISTE', 100);
    expect(result).toEqual({ ok: false, message: 'Cupom não encontrado.' });
  });

  it('rejeita cupom inativo', async () => {
    const { client } = mockSupabase({
      id: 'c4', codigo: 'VELHO', ativo: false, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'VELHO', 100);
    expect(result).toEqual({ ok: false, message: 'Este cupom não está mais ativo.' });
  });

  it('rejeita cupom expirado', async () => {
    const { client } = mockSupabase({
      id: 'c5', codigo: 'EXPIROU', ativo: true, tipo: 'percentual', valor: 10, validade: past, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'EXPIROU', 100);
    expect(result).toEqual({ ok: false, message: 'Este cupom expirou.' });
  });

  it('rejeita cupom que já atingiu o limite de usos', async () => {
    const { client } = mockSupabase({
      id: 'c6', codigo: 'ESGOTOU', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: 5, usos: 5,
    });
    const result = await validateAndApplyCoupon(client as never, 'ESGOTOU', 100);
    expect(result).toEqual({ ok: false, message: 'Este cupom já atingiu o limite de usos.' });
  });

  it('permite uso quando ainda não atingiu o limite', async () => {
    const { client } = mockSupabase({
      id: 'c7', codigo: 'QUASE', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: 5, usos: 4,
    });
    const result = await validateAndApplyCoupon(client as never, 'QUASE', 100);
    expect(result.ok).toBe(true);
  });

  it('rejeita cupom restrito a outro(s) plano(s)', async () => {
    const { client } = mockSupabase({
      id: 'c9', codigo: 'SOPRO', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0, planos: ['Pro', 'Business'],
    });
    const result = await validateAndApplyCoupon(client as never, 'SOPRO', 149, 'Start');
    expect(result).toEqual({ ok: false, message: 'Este cupom não é válido para o plano Start.' });
  });

  it('aceita cupom restrito quando o plano está na lista permitida', async () => {
    const { client } = mockSupabase({
      id: 'c10', codigo: 'SOPRO', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0, planos: ['Pro', 'Business'],
    });
    const result = await validateAndApplyCoupon(client as never, 'SOPRO', 149, 'Pro');
    expect(result.ok).toBe(true);
  });

  it('cupom sem restrição de plano (planos null) vale pra qualquer plano', async () => {
    const { client } = mockSupabase({
      id: 'c11', codigo: 'GERAL', ativo: true, tipo: 'percentual', valor: 10, validade: future, limite_usos: null, usos: 0, planos: null,
    });
    const result = await validateAndApplyCoupon(client as never, 'GERAL', 49, 'Start');
    expect(result.ok).toBe(true);
  });

  it('trata erro de consulta como cupom não encontrado', async () => {
    const { client } = mockSupabase(null, { selectError: true });
    const result = await validateAndApplyCoupon(client as never, 'ERRO', 100);
    expect(result.ok).toBe(false);
  });
});

describe('incrementCouponUsage', () => {
  it('incrementa o contador de usos sem lançar exceção', async () => {
    const { client, updateMock } = mockSupabase({ usos: 3 });
    await expect(incrementCouponUsage(client as never, 'c1')).resolves.not.toThrow();
    expect(updateMock).toHaveBeenCalledWith({ usos: 4 });
  });
});

describe('registerCouponSubscription', () => {
  it('não grava nada quando o cupom é de cobrança única (remainingCharges 0)', async () => {
    const insertMock = vi.fn();
    const client = { from: vi.fn().mockReturnValue({ insert: insertMock }) };
    await registerCouponSubscription(client as never, {
      couponId: 'c1', tipo: 'percentual', valor: 10, remainingCharges: 0, asaasSubscriptionId: 'sub_1', accountId: 'acc_1', firstPaymentId: 'pay_1',
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('grava a linha em assinante_cupons quando sobram cobranças futuras', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: insertMock }) };
    await registerCouponSubscription(client as never, {
      couponId: 'c1', tipo: 'percentual', valor: 10, remainingCharges: 2, asaasSubscriptionId: 'sub_1', accountId: 'acc_1', firstPaymentId: 'pay_1',
    });
    expect(insertMock).toHaveBeenCalledWith({
      cupom_id: 'c1', asaas_subscription_id: 'sub_1', account_id: 'acc_1', tipo: 'percentual', valor: 10, primeiro_payment_id: 'pay_1', cobrancas_restantes: 2,
    });
  });

  it('grava normalmente quando remainingCharges é null (desconto sem prazo)', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: insertMock }) };
    await registerCouponSubscription(client as never, {
      couponId: 'c1', tipo: 'fixo', valor: 15, remainingCharges: null, asaasSubscriptionId: 'sub_1', accountId: 'acc_1', firstPaymentId: 'pay_1',
    });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ cobrancas_restantes: null }));
  });
});

describe('applyCouponToRecurringPayment', () => {
  function mockAssinanteCupons(row: Record<string, unknown> | null) {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: row }) }) }),
        update: updateMock,
      }),
    };
    return { client, updateMock, updateEqMock };
  }

  it('não faz nada quando a assinatura não tem cupom associado', async () => {
    const { client } = mockAssinanteCupons(null);
    const updatePaymentValue = vi.fn();
    await applyCouponToRecurringPayment(client as never, {
      asaasSubscriptionId: 'sub_1', payment: { id: 'pay_2', status: 'PENDING', value: 100 }, updatePaymentValue,
    });
    expect(updatePaymentValue).not.toHaveBeenCalled();
  });

  it('ignora a própria primeira cobrança (já aplicada de forma síncrona na criação)', async () => {
    const { client } = mockAssinanteCupons({
      tipo: 'percentual', valor: 10, primeiro_payment_id: 'pay_1', cobrancas_restantes: 2,
    });
    const updatePaymentValue = vi.fn();
    await applyCouponToRecurringPayment(client as never, {
      asaasSubscriptionId: 'sub_1', payment: { id: 'pay_1', status: 'PENDING', value: 100 }, updatePaymentValue,
    });
    expect(updatePaymentValue).not.toHaveBeenCalled();
  });

  it('não aplica desconto quando já não sobra saldo de cobranças', async () => {
    const { client } = mockAssinanteCupons({
      tipo: 'percentual', valor: 10, primeiro_payment_id: 'pay_1', cobrancas_restantes: 0,
    });
    const updatePaymentValue = vi.fn();
    await applyCouponToRecurringPayment(client as never, {
      asaasSubscriptionId: 'sub_1', payment: { id: 'pay_2', status: 'PENDING', value: 100 }, updatePaymentValue,
    });
    expect(updatePaymentValue).not.toHaveBeenCalled();
  });

  it('aplica o desconto na cobrança nova e decrementa o saldo', async () => {
    const { client, updateMock, updateEqMock } = mockAssinanteCupons({
      tipo: 'percentual', valor: 10, primeiro_payment_id: 'pay_1', cobrancas_restantes: 2,
    });
    const updatePaymentValue = vi.fn().mockResolvedValue({});
    await applyCouponToRecurringPayment(client as never, {
      asaasSubscriptionId: 'sub_1', payment: { id: 'pay_2', status: 'PENDING', value: 100 }, updatePaymentValue,
    });
    expect(updatePaymentValue).toHaveBeenCalledWith('pay_2', 90);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ cobrancas_restantes: 1 }));
    expect(updateEqMock).toHaveBeenCalledWith('asaas_subscription_id', 'sub_1');
  });

  it('aplica o desconto indefinidamente quando cobrancas_restantes é null (sem decrementar)', async () => {
    const { client, updateMock } = mockAssinanteCupons({
      tipo: 'fixo', valor: 20, primeiro_payment_id: 'pay_1', cobrancas_restantes: null,
    });
    const updatePaymentValue = vi.fn().mockResolvedValue({});
    await applyCouponToRecurringPayment(client as never, {
      asaasSubscriptionId: 'sub_1', payment: { id: 'pay_3', status: 'PENDING', value: 100 }, updatePaymentValue,
    });
    expect(updatePaymentValue).toHaveBeenCalledWith('pay_3', 80);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('não aplica (nem decrementa) quando a cobrança já não está PENDING', async () => {
    const { client, updateMock } = mockAssinanteCupons({
      tipo: 'percentual', valor: 10, primeiro_payment_id: 'pay_1', cobrancas_restantes: 2,
    });
    const updatePaymentValue = vi.fn();
    await applyCouponToRecurringPayment(client as never, {
      asaasSubscriptionId: 'sub_1', payment: { id: 'pay_2', status: 'CONFIRMED', value: 100 }, updatePaymentValue,
    });
    expect(updatePaymentValue).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('não decrementa o saldo quando a chamada à Asaas falha', async () => {
    const { client, updateMock } = mockAssinanteCupons({
      tipo: 'percentual', valor: 10, primeiro_payment_id: 'pay_1', cobrancas_restantes: 2,
    });
    const updatePaymentValue = vi.fn().mockRejectedValue(new Error('Asaas fora do ar'));
    await applyCouponToRecurringPayment(client as never, {
      asaasSubscriptionId: 'sub_1', payment: { id: 'pay_2', status: 'PENDING', value: 100 }, updatePaymentValue,
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
