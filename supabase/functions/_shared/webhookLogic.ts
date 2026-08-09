// Lógica pura de interpretação do webhook do Asaas — extraída de
// asaas-webhook/index.ts pra poder ser testada com Vitest sem precisar do
// runtime Deno (Deno.serve, Deno.env) nem de rede/banco de verdade.

// Eventos que fazem a assinatura contar como "em dia".
export const ACTIVE_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
// Eventos que derrubam o acesso do assinante.
export const INACTIVE_EVENTS = new Set([
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_REQUESTED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_INACTIVATED',
]);

export type AccountStatus = 'ativo' | 'inativo' | null;

export function resolveStatusFromEvent(event: string): AccountStatus {
  if (ACTIVE_EVENTS.has(event)) return 'ativo';
  if (INACTIVE_EVENTS.has(event)) return 'inativo';
  return null;
}

// externalReference foi gravado no formato "account_id:planName" na criação
// da assinatura (ver subscribe/index.ts) — é o único jeito do webhook, que
// só recebe dados do Asaas, saber qual conta liberar.
export function parseExternalReference(externalRef: string | undefined | null): { accountId: string | null; planKey: string | null } {
  if (!externalRef || !externalRef.includes(':')) {
    return { accountId: null, planKey: null };
  }
  const sep = externalRef.indexOf(':');
  return {
    accountId: externalRef.slice(0, sep),
    planKey: externalRef.slice(sep + 1).toLowerCase(),
  };
}

// Idempotência: o Asaas pode reentregar o mesmo evento (retry de webhook),
// e isso não pode gerar uma segunda entrada no audit_log pra troca de plano
// que já tinha sido aplicada — só loga quando o plano de fato mudou.
export function shouldLogPlanChange(previousPlan: string | null, newPlanKey: string): boolean {
  return previousPlan !== newPlanKey;
}
