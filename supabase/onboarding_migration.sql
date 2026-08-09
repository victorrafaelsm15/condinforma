-- Cond-Informa — estado do onboarding guiado. Rode este arquivo INTEIRO,
-- uma vez, no SQL Editor. Pré-requisito: usuarios_admin_migration.sql já
-- deve ter rodado (usa a function is_platform_owner() que ele cria).

alter table accounts add column if not exists onboarding_completed boolean not null default false;

-- Backfill: contas que já têm pelo menos um condomínio claramente já
-- passaram do primeiro passo há muito tempo — sem isso, TODA conta
-- existente veria o wizard de boas-vindas reaparecer do nada no próximo
-- login, já que a coluna nova nasce "false" pra todo mundo.
update accounts set onboarding_completed = true
where onboarding_completed = false
  and id in (select distinct account_id from condominios);

-- accounts hoje só tem policy de SELECT (accounts_select_own) — sem uma de
-- UPDATE pra "a própria conta", o cliente nunca conseguiria marcar o
-- próprio onboarding como concluído (o update seria bloqueado pelo RLS e
-- o createStore.js cairia pro fallback de localStorage, que não persiste
-- entre aparelhos/navegadores).
--
-- Mas abrir UPDATE geral pra "id = auth.uid()" sem mais nada seria
-- perigoso: o cliente conseguiria alterar o PRÓPRIO plan_name, status,
-- condominio_limit, sub_usuario_limit ou role direto via REST e se
-- auto-conceder plano ilimitado. Um GRANT restrito por coluna não resolve
-- aqui porque a tabela já tem accounts_platform_owner_update (o owner da
-- plataforma edita QUALQUER conta, inclusive esses mesmos campos, pela
-- aba Usuários) — GRANT é por tabela/coluna, não por policy, então
-- restringir a coluna pra "só onboarding_completed" quebraria essa
-- feature já existente. Por isso o controle fino fica num trigger: RLS
-- libera update na própria linha, mas o trigger barra a alteração dos
-- campos sensíveis a menos que quem está editando seja is_platform_owner().
create policy "accounts_update_own" on accounts
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function protect_account_sensitive_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_owner() then
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

drop trigger if exists trg_protect_account_sensitive_columns on accounts;
create trigger trg_protect_account_sensitive_columns
  before update on accounts
  for each row execute function protect_account_sensitive_columns();
