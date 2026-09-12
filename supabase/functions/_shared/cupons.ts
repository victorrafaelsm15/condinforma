// Validação e aplicação de cupom de desconto no fluxo de assinatura.
// Roda só no servidor (service role) — o valor final cobrado nunca vem do
// cliente, sempre recalculado aqui a partir do preço do plano + o cupom.

type SupabaseAdminClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type CouponResult =
  | {
    ok: true;
    finalValue: number;
    couponId: string;
    tipo: 'percentual' | 'fixo';
    valor: number;
    // Quantas cobranças FUTURAS (além desta primeira, já aplicada) ainda
    // devem receber o desconto. null = ilimitado (enquanto a assinatura
    // existir). 0 = cupom de cobrança única (comportamento padrão de
    // sempre) — não precisa de nenhum rastreamento em assinante_cupons.
    remainingCharges: number | null;
  }
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

// Calcula o valor final de uma cobrança aplicando o desconto do cupom,
// respeitando o piso mínimo. Usado tanto na primeira cobrança (aqui embaixo)
// quanto nas cobranças recorrentes seguintes (applyCouponToRecurringPayment).
export function computeFinalValue(tipo: 'percentual' | 'fixo', valor: number, price: number): number {
  const discount = tipo === 'percentual' ? price * (valor / 100) : valor;
  return Math.max(MIN_VALUE, Math.round((price - discount) * 100) / 100);
}

// ILIKE trata "%" e "_" como coringas — sem escapar, um cupom "código"
// vindo direto do cliente (ver AssinaturaPage.jsx) vira um PADRÃO de
// busca, não um valor exato. Um visitante digitando só "%" já casava com
// qualquer cupom cadastrado (aplicava desconto sem saber nenhum código de
// verdade), e mensagens de erro diferentes por cupom (expirado/inativo/
// limite atingido) viravam um oráculo pra enumerar códigos reais tentando
// padrões como "PROMO%". Escapar aqui mantém a comparação
// case-insensitive (mesmo comportamento de antes) sem abrir esse buraco.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function validateAndApplyCoupon(
  supabaseAdmin: SupabaseAdminClient,
  code: string,
  price: number,
  planName?: string,
): Promise<CouponResult> {
  const { data: coupon, error } = await supabaseAdmin
    .from('cupons')
    .select('*')
    .ilike('codigo', escapeLikePattern(code.trim()))
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
  if (Array.isArray(coupon.planos) && coupon.planos.length && !coupon.planos.includes(planName)) {
    return { ok: false, message: `Este cupom não é válido para o plano ${planName}.` };
  }

  const finalValue = computeFinalValue(coupon.tipo, Number(coupon.valor), price);

  // duracao_cobrancas pode não existir ainda (coluna nova, migration não
  // rodou) — tratado como 1 (comportamento anterior: só a primeira
  // cobrança) pra não quebrar cupons já cadastrados. null é explícito:
  // desconto recorrente sem prazo, enquanto a assinatura existir.
  const duracaoCobrancas = coupon.duracao_cobrancas === undefined ? 1 : coupon.duracao_cobrancas;
  const remainingCharges = duracaoCobrancas == null ? null : Math.max(0, Number(duracaoCobrancas) - 1);

  return {
    ok: true, finalValue, couponId: coupon.id, tipo: coupon.tipo, valor: Number(coupon.valor), remainingCharges,
  };
}

// Best-effort — se isso falhar não deve derrubar a assinatura que já foi
// criada no Asaas, só fica um contador de uso levemente desatualizado.
// increment_cupom_usos faz "usos = usos + 1" num único UPDATE no banco —
// atômico de verdade. Antes isso era ler "usos" e gravar "lido + 1" em duas
// chamadas separadas: duas assinaturas com o mesmo cupom quase ao mesmo
// tempo liam o mesmo valor e o contador só subia 1 em vez de 2, furando
// limite_usos silenciosamente.
export async function incrementCouponUsage(supabaseAdmin: SupabaseAdminClient, couponId: string) {
  try {
    const { error } = await supabaseAdmin.rpc('increment_cupom_usos', { p_cupom_id: couponId });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('Erro ao incrementar uso do cupom:', err instanceof Error ? err.message : err);
  }
}

// Chamado logo após a primeira cobrança já ter recebido o desconto (em
// subscribe/index.ts) — só grava uma linha em assinante_cupons se ainda
// sobrar desconto pra aplicar em cobranças futuras. Cupom de cobrança única
// (remainingCharges === 0, o caso mais comum) não grava nada: não há nada
// pro webhook fazer depois.
export async function registerCouponSubscription(supabaseAdmin: SupabaseAdminClient, params: {
  couponId: string;
  tipo: 'percentual' | 'fixo';
  valor: number;
  remainingCharges: number | null;
  asaasSubscriptionId: string;
  accountId: string;
  firstPaymentId: string;
}) {
  if (params.remainingCharges === 0) return;
  try {
    const { error } = await supabaseAdmin.from('assinante_cupons').insert({
      cupom_id: params.couponId,
      asaas_subscription_id: params.asaasSubscriptionId,
      account_id: params.accountId,
      tipo: params.tipo,
      valor: params.valor,
      primeiro_payment_id: params.firstPaymentId,
      cobrancas_restantes: params.remainingCharges,
    });
    if (error) console.error('Erro ao registrar cupom recorrente da assinatura:', error.message);
  } catch (err) {
    console.error('Erro ao registrar cupom recorrente da assinatura:', err instanceof Error ? err.message : err);
  }
}

type AsaasPayment = { id: string; status: string; value: number };

// Chamado pelo webhook (evento PAYMENT_CREATED) a cada nova cobrança gerada
// pelo ciclo da assinatura. Se essa assinatura tem um cupom multi-cobrança
// com saldo, aplica o mesmo desconto nesta cobrança nova e decrementa o
// saldo — espelha, cobrança a cobrança, o que subscribe/index.ts já faz na
// primeira. Ignora silenciosamente quando não há cupom associado (o caso
// comum) ou quando já não sobra desconto a aplicar.
export async function applyCouponToRecurringPayment(supabaseAdmin: SupabaseAdminClient, params: {
  asaasSubscriptionId: string;
  payment: AsaasPayment;
  updatePaymentValue: (paymentId: string, newValue: number) => Promise<unknown>;
}) {
  const { asaasSubscriptionId, payment, updatePaymentValue } = params;

  const { data: row } = await supabaseAdmin
    .from('assinante_cupons')
    .select('primeiro_payment_id')
    .eq('asaas_subscription_id', asaasSubscriptionId)
    .maybeSingle();
  if (!row) return;

  // A primeira cobrança já recebeu o desconto de forma síncrona, na própria
  // criação da assinatura — reaplicar aqui de novo (pra ela) contaria a
  // mesma cobrança duas vezes contra o saldo de cobranças restantes.
  if (payment.id === row.primeiro_payment_id) return;

  // Só é possível alterar cobrança ainda PENDING (mesma regra da primeira
  // cobrança) — cartão é capturado de forma síncrona e nunca chega aqui
  // como PENDING, mas cupom já é bloqueado pra cartão desde a assinatura.
  if (payment.status !== 'PENDING') {
    console.warn(`Cupom recorrente: cobrança ${payment.id} da assinatura ${asaasSubscriptionId} já não está PENDING (status ${payment.status}) — desconto não pôde ser aplicado.`);
    return;
  }

  // Reivindica atomicamente esta cobrança específica — um único UPDATE no
  // banco (claim_assinante_cupom_desconto) que só decrementa o saldo se
  // ainda sobrar cobrança E se essa cobrança em particular ainda não tiver
  // sido processada antes. Substitui o antigo "ler saldo, decidir, gravar
  // saldo-1" em duas chamadas separadas — não atômico, e sem nenhum
  // registro de "essa cobrança já foi descontada": duas entregas do mesmo
  // evento de webhook (retry da Asaas) decrementavam duas vezes a mesma
  // cobrança, e duas cobranças diferentes chegando quase juntas podiam ler
  // o mesmo saldo e as duas decrementarem a partir dele.
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_assinante_cupom_desconto', {
    p_asaas_subscription_id: asaasSubscriptionId,
    p_payment_id: payment.id,
  });
  if (claimError) {
    console.error('Erro ao reivindicar desconto recorrente do cupom:', claimError.message);
    return;
  }
  const claim = (claimed as { tipo: 'percentual' | 'fixo'; valor: number }[] | null)?.[0];
  // Sem saldo, ou esta cobrança específica já foi processada antes
  // (retry) — nada a fazer, e não é erro.
  if (!claim) return;

  const finalValue = computeFinalValue(claim.tipo, Number(claim.valor), Number(payment.value));
  if (finalValue === Number(payment.value)) return;

  try {
    await updatePaymentValue(payment.id, finalValue);
  } catch (err) {
    // O saldo já foi reivindicado/decrementado no banco neste ponto — se a
    // chamada à Asaas falhar aqui, essa cobrança específica fica sem o
    // desconto (não há retry agendado pra isso hoje, então o resultado
    // prático é o mesmo de antes: essa cobrança não sai descontada). O que
    // mudou é que agora isso nunca decrementa o saldo DUAS VEZES por causa
    // de uma reentrega do mesmo evento — o bug que esta função corrige.
    console.error('Erro ao aplicar desconto recorrente do cupom:', err instanceof Error ? err.message : err);
  }
}
