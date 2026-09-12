-- Cond-Informa — corrige a mesma classe de bug do
-- cupom_increment_atomico_migration.sql, agora no saldo de cobranças do
-- cupom recorrente (assinante_cupons.cobrancas_restantes). Rode uma vez no
-- SQL Editor.
--
-- applyCouponToRecurringPayment() (cupons.ts) fazia: ler a linha, decidir
-- se aplica o desconto, e só DEPOIS gravar "cobrancas_restantes - 1" numa
-- chamada separada. Dois problemas reais:
-- 1) Read-then-write não é atômico — duas entregas de webhook pra cobranças
--    diferentes da mesma assinatura, próximas no tempo, podiam ler o mesmo
--    saldo e as duas decrementarem a partir dele.
-- 2) Sem nenhum registro de qual foi a ÚLTIMA cobrança processada — se a
--    Asaas reentregar o MESMO evento PAYMENT_CREATED (retry de rede), o
--    código não tinha como saber que aquela cobrança específica já tinha
--    sido descontada, e decrementava de novo.
--
-- A coluna nova guarda o id da última cobrança processada, e a function
-- faz tudo (checar se já foi processada, checar saldo, decrementar) num
-- único UPDATE — atômico por natureza no Postgres, sem precisar de lock
-- explícito nem de segunda chamada.

alter table assinante_cupons add column if not exists ultimo_payment_id_processado text;

-- "cobrancas_restantes - 1" quando a coluna é NULL (cupom sem prazo,
-- desconto recorrente enquanto a assinatura existir) dá NULL em Postgres
-- (aritmética com NULL sempre resulta em NULL) — fica NULL pra sempre,
-- exatamente o comportamento "ilimitado" que já era o esperado, sem
-- precisar de nenhum CASE especial aqui.
create or replace function claim_assinante_cupom_desconto(p_asaas_subscription_id text, p_payment_id text)
returns table (tipo text, valor numeric)
language sql security definer set search_path = public as $$
  update assinante_cupons
  set cobrancas_restantes = cobrancas_restantes - 1,
      ultimo_payment_id_processado = p_payment_id,
      updated_at = now()
  where asaas_subscription_id = p_asaas_subscription_id
    and ultimo_payment_id_processado is distinct from p_payment_id
    and (cobrancas_restantes is null or cobrancas_restantes > 0)
  returning assinante_cupons.tipo, assinante_cupons.valor;
$$;
