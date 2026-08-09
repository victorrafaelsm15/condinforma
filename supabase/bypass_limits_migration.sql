-- Cond-Informa — conta com isenção individual de limite (sem ganhar acesso
-- às telas de gestão da plataforma). Rode este arquivo INTEIRO, uma vez, no
-- SQL Editor. Pré-requisito: onboarding_migration.sql e retention_migration.sql
-- já devem ter rodado (usa is_platform_owner() e redefine funções criadas ali).
--
-- Contexto: role='owner' hoje mistura DUAS coisas — (1) isenção de limite de
-- condomínios/sub-usuários/bloqueio por inadimplência e (2) visibilidade das
-- telas administrativas da plataforma (Usuários/Cupons/Auditoria via
-- is_platform_owner()). Este arquivo separa a responsabilidade (1) numa
-- coluna própria, SEM tocar em is_platform_owner() nem em nenhuma policy de
-- RLS que controla a responsabilidade (2) — uma conta com bypass_limits=true
-- e role='customer' continua vendo a interface exatamente como um cliente
-- normal, inclusive se tentar acessar /admin/usuarios direto pela URL (a
-- página já barra por role, e as policies "*_platform_owner_*" já barram a
-- consulta no banco mesmo que a UI fosse contornada).

alter table accounts add column if not exists bypass_limits boolean not null default false;

-- ============================================================
-- Isenção de limite de condomínios — agora por role='owner' OU bypass_limits.
-- ============================================================
create or replace function check_condominio_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_status text;
  v_limit  integer;
  v_count  integer;
  v_bypass boolean;
begin
  select role, status, condominio_limit, bypass_limits into v_role, v_status, v_limit, v_bypass from accounts where id = new.account_id;
  if v_role = 'owner' or v_bypass then
    return new;
  end if;
  if v_status is null or v_status <> 'ativo' then
    raise exception 'Sua assinatura não está ativa. Assine um plano para cadastrar condomínios.' using errcode = 'CI001';
  end if;
  select count(*) into v_count from condominios where account_id = new.account_id;
  if v_count >= v_limit then
    raise exception 'Limite de % condomínio(s) do seu plano atingido. Faça upgrade para cadastrar mais.', v_limit using errcode = 'CI001';
  end if;
  return new;
end;
$$;

-- ============================================================
-- Isenção de limite de sub-usuários — mesma regra.
-- ============================================================
create or replace function check_subusuario_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_limit  integer;
  v_count  integer;
  v_bypass boolean;
begin
  select role, sub_usuario_limit, bypass_limits into v_role, v_limit, v_bypass from accounts where id = new.account_id;
  if v_role = 'owner' or v_bypass then
    return new;
  end if;
  select count(*) into v_count from sub_usuarios where account_id = new.account_id;
  if v_count >= coalesce(v_limit, 0) then
    raise exception 'Limite de % sub-usuário(s) do seu plano atingido. Faça upgrade para adicionar mais.', coalesce(v_limit, 0)
      using errcode = 'CI001';
  end if;
  return new;
end;
$$;

-- ============================================================
-- Bloqueio por inadimplência (block_writes_when_inactive) — mesma regra.
-- ============================================================
create or replace function is_account_active(target_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts
    where id = target_account_id and (status = 'ativo' or role = 'owner' or bypass_limits)
  );
$$;

-- ============================================================
-- Protege bypass_limits igual às outras colunas sensíveis (plan_name,
-- status, condominio_limit, sub_usuario_limit, role, asaas_customer_id,
-- inactive_since, deletion_warning_*) — só service role ou is_platform_owner()
-- (role='owner', DE PROPÓSITO — não bypass_limits) podem alterar. Não mexe
-- na condição do "if" (quem pode editar), só adiciona a coluna nova na lista
-- do que está protegido.
-- ============================================================
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
      or new.inactive_since is distinct from old.inactive_since
      or new.deletion_warning_15d_sent_at is distinct from old.deletion_warning_15d_sent_at
      or new.deletion_warning_3d_sent_at is distinct from old.deletion_warning_3d_sent_at
      or new.bypass_limits is distinct from old.bypass_limits
    then
      raise exception 'Você não tem permissão para alterar esses campos da conta.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Nada muda em is_platform_owner() nem em nenhuma policy "*_platform_owner_*"
-- (accounts_platform_owner_select/update, cupons_platform_owner_all,
-- sub_usuarios_platform_owner_select/delete, sub_usuario_condominios_
-- platform_owner_all): essas continuam checando estritamente role='owner',
-- de propósito, pra bypass_limits nunca dar acesso às telas de gestão da
-- plataforma nem aos dados de outras contas.
