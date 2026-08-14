// Validação e aplicação de cupom de desconto no fluxo de assinatura.
// Roda só no servidor (service role) — o valor final cobrado nunca vem do
// cliente, sempre recalculado aqui a partir do preço do plano + o cupom.

type SupabaseAdminClient = {
  from: (table: string) => any;
};

export type CouponResult =
  | { ok: true; finalValue: number; couponId: string }
  | { ok: false; message: string };

// Asaas rejeita cobranças abaixo de R$ 5 (mínimo documentado pra criação
// de cobranças — Pix/boleto; cartão não tem mínimo, mas usamos o mesmo
// piso pra manter a regra simples e uniforme). Um cupom com desconto
// agressivo (ex: 99%) sem esse piso calculava um valor tipo R$ 0,49, que
// a Asaas recusava — e esse erro chegava como o genérico "Não foi
// possível criar a assinatura agora" porque a causa raiz nunca era
// diferenciada de uma falha de comunicação de verdade (ver catch em
// subscribe/index.ts).
const MIN_VALUE = 5;

export async function validateAndApplyCoupon(
  supabaseAdmin: SupabaseAdminClient,
  code: string,
  price: number,
): Promise<CouponResult> {
  const { data: coupon, error } = await supabaseAdmin
    .from('cupons')
    .select('*')
    .ilike('codigo', code.trim())
    .maybeSingle();

  if (error || !coupon) {
    return { ok: false, message: 'Cupom não encontrado.' };
  }
  if (!coupon.ativo) {
    return { ok: false, message: 'Este cupom não está mais ativo.' };
  }
  if (coupon.validade && new Date(coupon.validade) < new Date(new Date().toISOString().slice(0, 10))) {
    return { ok: false, message: 'Este cupom expirou.' };
  }
  if (coupon.limite_usos != null && coupon.usos >= coupon.limite_usos) {
    return { ok: false, message: 'Este cupom já atingiu o limite de usos.' };
  }

  const discount = coupon.tipo === 'percentual'
    ? price * (Number(coupon.valor) / 100)
    : Number(coupon.valor);
  const finalValue = Math.max(MIN_VALUE, Math.round((price - discount) * 100) / 100);

  return { ok: true, finalValue, couponId: coupon.id };
}

// Best-effort — se isso falhar não deve derrubar a assinatura que já foi
// criada no Asaas, só fica um contador de uso levemente desatualizado.
export async function incrementCouponUsage(supabaseAdmin: SupabaseAdminClient, couponId: string) {
  try {
    const { data } = await supabaseAdmin.from('cupons').select('usos').eq('id', couponId).maybeSingle();
    const current = data?.usos ?? 0;
    await supabaseAdmin.from('cupons').update({ usos: current + 1 }).eq('id', couponId);
  } catch (err) {
    console.error('Erro ao incrementar uso do cupom:', err instanceof Error ? err.message : err);
  }
}
