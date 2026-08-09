import { describe, it, expect, vi } from 'vitest';
import { validateAndApplyCoupon, incrementCouponUsage } from './cupons.ts';

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
    expect(result).toEqual({ ok: true, finalValue: 90, couponId: 'c1' });
  });

  it('aplica corretamente um cupom de valor fixo', async () => {
    const { client } = mockSupabase({
      id: 'c2', codigo: 'DEZOFF', ativo: true, tipo: 'fixo', valor: 20, validade: future, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'DEZOFF', 100);
    expect(result).toEqual({ ok: true, finalValue: 80, couponId: 'c2' });
  });

  it('nunca deixa o valor final cair abaixo do mínimo cobrável (R$1)', async () => {
    const { client } = mockSupabase({
      id: 'c3', codigo: 'QUASETUDO', ativo: true, tipo: 'fixo', valor: 999, validade: future, limite_usos: null, usos: 0,
    });
    const result = await validateAndApplyCoupon(client as never, 'QUASETUDO', 100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.finalValue).toBe(1);
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
