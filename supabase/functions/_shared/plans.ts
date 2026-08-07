// Preços e limites de cada plano — definidos AQUI, no servidor, e
// compartilhados entre subscribe (cria a assinatura) e asaas-webhook
// (aplica o plano na conta quando o pagamento é confirmado). Nunca confiar
// em preço/limite vindo do cliente.
export const PLAN_PRICES: Record<string, number> = {
  Start: 49,
  Pro: 149,
  Business: 299,
};

// Chaves em minúsculo — é como plan_name fica salvo em accounts.
export const PLAN_LIMITS: Record<string, number> = {
  start: 1,
  pro: 5,
  business: 10,
};

// Limite de sub-usuários por plano — mesma lógica do PLAN_LIMITS acima.
export const SUB_USUARIO_LIMITS: Record<string, number> = {
  start: 2,
  pro: 10,
  business: 30,
};
