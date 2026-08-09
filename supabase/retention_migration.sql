-- Cond-Informa — bloqueio administrativo de conta inativa, exclusão
-- automática após 90 dias de inadimplência, e agendamento (pg_cron) do
-- backup diário e da varredura de retenção. Rode este arquivo INTEIRO,
-- uma vez, no SQL Editor. Pré-requisito: usuarios_admin_migration.sql
-- (is_platform_owner) e audit_log_migration.sql já devem ter rodado.
--
-- IMPORTANTE: antes de rodar, troque as DUAS ocorrências de
-- 'COLOQUE_AQUI_O_CRON_SECRET' abaixo pelo valor real do secret (o mesmo
-- configurado via "supabase secrets set CRON_SECRET=..." nas Edge
-- Functions data-backup-export e data-retention-sweep).

-- ============================================================
-- Rastreio de inatividade/exclusão em accounts
-- ============================================================
alter table accounts add column if not exists inactive_since timestamptz;
alter table accounts add column if not exists deletion_warning_15d_sent_at timestamptz;
alter table accounts add column if not exists deletion_warning_3d_sent_at timestamptz;

-- Redefine protect_account_sensitive_columns (criado em
-- onboarding_migration.sql) pra também proteger essas 3 colunas novas —
-- só a service role (asaas-webhook/data-retention-sweep) deve gravar
-- nelas. Se você já rodou supabase/hotfix_accounts_trigger_service_role.sql
-- antes deste arquivo (recomendado, é urgente e independente), isto aqui
-- só adiciona a proteção das 3 colunas novas por cima do que o hotfix já
-- corrigiu — sem problema rodar os dois.
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
    then
      raise exception 'Você não tem permissão para alterar esses campos da conta.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Registro de exclusões por inadimplência — tabela própria, SEM foreign
-- key com cascade pra accounts/auth.users: se ficasse no audit_log
-- normal, a própria entrada seria apagada junto pelo cascade quando a
-- conta é excluída, perdendo o rastro exatamente do evento mais importante.
create table if not exists account_deletions (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null,
  email           text,
  reason          text not null,
  inactive_since  timestamptz,
  deleted_at      timestamptz not null default now()
);
alter table account_deletions enable row level security;
-- Sem policy nenhuma de propósito — só a service role (Edge Function
-- data-retention-sweep) grava/lê aqui, igual ao padrão já usado em cupons.

-- ============================================================
-- Bloqueio de "ações de gestão" quando a conta está inativa — RLS/trigger,
-- não só UI: o pedido foi explícito em tratar isso tanto no frontend
-- quanto nas policies, pra não dar pra contornar batendo direto na API.
-- ============================================================

-- role='owner' nunca é bloqueado (não depende de assinatura, mesmo
-- critério já usado em check_condominio_limit/check_subusuario_limit).
create or replace function is_account_active(target_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts
    where id = target_account_id and (status = 'ativo' or role = 'owner')
  );
$$;

create or replace function block_writes_when_inactive()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid;
begin
  -- Só bloqueia ação de conta AUTENTICADA (gestor ou sub-usuário) — o
  -- fluxo público (colaborador/morador, sem login, via QR Code) nunca é
  -- afetado, mesmo com a conta bloqueada, pra não travar a operação
  -- física do condomínio (execuções e ocorrências continuam entrando
  -- normalmente mesmo com o pagamento em atraso).
  if auth.role() <> 'authenticated' then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  v_account_id := coalesce(new.account_id, old.account_id);
  if not is_account_active(v_account_id) then
    raise exception 'Sua assinatura está inativa. Regularize o pagamento para voltar a gerenciar seus condomínios.' using errcode = 'CI002';
  end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_block_inactive_condominios on condominios;
create trigger trg_block_inactive_condominios
  before insert or update or delete on condominios
  for each row execute function block_writes_when_inactive();

drop trigger if exists trg_block_inactive_ambientes on ambientes;
create trigger trg_block_inactive_ambientes
  before insert or update or delete on ambientes
  for each row execute function block_writes_when_inactive();

drop trigger if exists trg_block_inactive_checklist_items on checklist_items;
create trigger trg_block_inactive_checklist_items
  before insert or update or delete on checklist_items
  for each row execute function block_writes_when_inactive();

drop trigger if exists trg_block_inactive_sub_usuarios on sub_usuarios;
create trigger trg_block_inactive_sub_usuarios
  before insert or update or delete on sub_usuarios
  for each row execute function block_writes_when_inactive();

drop trigger if exists trg_block_inactive_execucoes on execucoes;
create trigger trg_block_inactive_execucoes
  before insert or update or delete on execucoes
  for each row execute function block_writes_when_inactive();

drop trigger if exists trg_block_inactive_ocorrencias on ocorrencias;
create trigger trg_block_inactive_ocorrencias
  before insert or update or delete on ocorrencias
  for each row execute function block_writes_when_inactive();

-- ============================================================
-- Bucket privado pro backup diário (data-backup-export) — só a service
-- role lê/escreve (nenhuma policy de storage.objects criada pra
-- anon/authenticated == acesso negado por padrão).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('data-backups', 'data-backups', false)
on conflict (id) do nothing;

-- ============================================================
-- Agendamento via pg_cron + pg_net — chama as duas Edge Functions 1x por
-- dia. Troque a URL do projeto e o CRON_SECRET abaixo pelos valores reais
-- antes de rodar.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cond-informa-data-backup-export',
  '17 6 * * *', -- todo dia às 06:17 UTC (~03:17 horário de Brasília)
  $$
  select net.http_post(
    url := 'https://vhpljzykqheinydvfntd.supabase.co/functions/v1/data-backup-export',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'COLOQUE_AQUI_O_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'cond-informa-data-retention-sweep',
  '42 6 * * *', -- todo dia às 06:42 UTC (~03:42 horário de Brasília)
  $$
  select net.http_post(
    url := 'https://vhpljzykqheinydvfntd.supabase.co/functions/v1/data-retention-sweep',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'COLOQUE_AQUI_O_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
