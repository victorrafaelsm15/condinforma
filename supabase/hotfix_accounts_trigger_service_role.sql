-- Cond-Informa — HOTFIX URGENTE: o trigger protect_account_sensitive_columns
-- (criado em onboarding_migration.sql) nunca isentou a service role, então
-- desde que essa migration rodou, TODA atualização de plan_name/status/
-- condominio_limit/sub_usuario_limit/role/asaas_customer_id feita pelo
-- asaas-webhook (via service role) vem sendo BLOQUEADA silenciosamente —
-- o próprio comentário original já dizia "as colunas sensíveis continuam
-- graváveis apenas pela service role", mas o código nunca implementou essa
-- isenção de fato.
--
-- RODE ESTE ARQUIVO ISOLADO, AGORA, antes de rodar retention_migration.sql
-- (que depois redefine essa mesma function de novo, incluindo mais 3
-- colunas que ele mesmo cria — mas isso pode esperar; este hotfix aqui é
-- urgente e não depende de mais nada).
--
-- Checado: não há evidência de cliente real afetado até agora (nenhum
-- evento novo na tabela "assinantes" desde antes dessa trigger existir),
-- mas o próximo pagamento real cairia nesse bug se isso não for corrigido.

create or replace function protect_account_sensitive_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not is_platform_owner() then
    if new.plan_name is distinct from old.plan_name
      or new.status is distinct from old.status
      or new.condominio_limit is distinct from old.condominio_limit
      or new.sub_usuario_limit is distinct from old.sub_usuario_limit
      or new.role is distinct from old.role
      or new.asaas_customer_id is distinct from old.asaas_customer_id
    then
      raise exception 'Você não tem permissão para alterar esses campos da conta.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
