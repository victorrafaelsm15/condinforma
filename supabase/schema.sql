-- Cond-Informa — schema do Supabase (instalação nova, já multi-tenant)
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e rode uma vez.
--
-- Se você já tem um projeto Supabase rodando este app em modo single-tenant
-- (sem account_id/RLS), NÃO rode este arquivo — use
-- supabase/multitenant_migration.sql em vez disso.
--
-- Este arquivo já inclui os limites de uso por plano (tabela accounts +
-- triggers). Se seu projeto já tinha multitenant_migration.sql rodado antes
-- dos limites de plano existirem, use supabase/plan_limits_migration.sql.
--
-- Autenticação é feita via Supabase Auth (ver src/lib/authService.js). Cada
-- linha das 5 tabelas abaixo pertence a uma conta (account_id = auth.uid()),
-- e o isolamento entre clientes é garantido por Row Level Security.

create table if not exists condominios (
  id         text primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists condominios_account_id_idx on condominios(account_id);

create table if not exists ambientes (
  id              text primary key,
  condominio_id   text not null references condominios(id) on delete cascade,
  account_id      uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  -- Identificador legível (CHK-001, CHK-002...), sequencial por
  -- condomínio, atribuído pelo trigger assign_ambiente_checklist_code()
  -- mais abaixo — nunca setado direto pelo cliente.
  checklist_code  text,
  checklist_ativo boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists ambientes_condominio_id_idx on ambientes(condominio_id);
create index if not exists ambientes_account_id_idx on ambientes(account_id);

create table if not exists checklist_items (
  id           text primary key,
  ambiente_id  text not null references ambientes(id) on delete cascade,
  account_id   uuid not null references auth.users(id) on delete cascade,
  task         text not null,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists checklist_items_ambiente_id_idx on checklist_items(ambiente_id);
create index if not exists checklist_items_account_id_idx on checklist_items(account_id);

create table if not exists execucoes (
  id               text primary key,
  ambiente_id      text not null references ambientes(id) on delete cascade,
  account_id       uuid not null references auth.users(id) on delete cascade,
  executed_by      text,
  completed_count  integer not null default 0,
  total_count      integer not null default 0,
  items            jsonb,
  photo            text,
  free_text_note   text,
  created_at       timestamptz not null default now()
);
create index if not exists execucoes_ambiente_id_idx on execucoes(ambiente_id);
create index if not exists execucoes_account_id_idx on execucoes(account_id);

create table if not exists ocorrencias (
  id                        text primary key,
  ambiente_id               text not null references ambientes(id) on delete cascade,
  account_id                uuid not null references auth.users(id) on delete cascade,
  description               text not null,
  photo                     text,
  status                    text not null default 'pendente',
  reported_by_role          text check (reported_by_role is null or reported_by_role in ('colaborador', 'morador')),
  reporter_name             text,
  reporter_unidade          text,
  -- Identificador legível (OC-001, OC-002...), sequencial por
  -- condomínio, atribuído pelo trigger assign_ocorrencia_code() mais
  -- abaixo — nunca setado direto pelo cliente.
  code                      text,
  -- Item do checklist a que essa ocorrência se refere, opcional (ex.:
  -- "a tarefa X não foi feita e por isso encontrei esse problema").
  related_checklist_item_id text references checklist_items(id) on delete set null,
  created_at                timestamptz not null default now()
);
create index if not exists ocorrencias_ambiente_id_idx on ocorrencias(ambiente_id);
create index if not exists ocorrencias_account_id_idx on ocorrencias(account_id);

-- ============================================================
-- Row Level Security — ver comentário completo em multitenant_migration.sql
-- sobre por que as políticas públicas usam "to anon" (nunca "authenticated").
-- ============================================================

alter table condominios     enable row level security;
alter table ambientes       enable row level security;
alter table checklist_items enable row level security;
alter table execucoes       enable row level security;
alter table ocorrencias     enable row level security;

create policy "condominios_owner_all" on condominios
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy "ambientes_owner_all" on ambientes
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "ambientes_public_select" on ambientes
  for select to anon using (true);

create policy "checklist_items_owner_all" on checklist_items
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "checklist_items_public_select" on checklist_items
  for select to anon using (true);

create policy "execucoes_owner_all" on execucoes
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "execucoes_public_insert" on execucoes
  for insert to anon with check (true);
create policy "execucoes_public_select" on execucoes
  for select to anon using (true);

create policy "ocorrencias_owner_all" on ocorrencias
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "ocorrencias_public_insert" on ocorrencias
  for insert to anon with check (true);
create policy "ocorrencias_public_select" on ocorrencias
  for select to anon using (true);

-- UPDATE público restrito por trigger — ver comentário completo em
-- ocorrencias_reporter_migration.sql. Sem o trigger, "using(true) with
-- check(true)" deixaria qualquer visitante reescrever qualquer campo de
-- qualquer ocorrência, não só marcar a que ele está vendo como resolvida.
create policy "ocorrencias_public_update" on ocorrencias
  for update to anon using (true) with check (true);

create or replace function protect_ocorrencia_public_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'anon' then
    if new.status is distinct from 'resolvido'
      or new.description is distinct from old.description
      or new.photo is distinct from old.photo
      or new.account_id is distinct from old.account_id
      or new.ambiente_id is distinct from old.ambiente_id
      or new.reported_by_role is distinct from old.reported_by_role
      or new.reporter_name is distinct from old.reporter_name
      or new.reporter_unidade is distinct from old.reporter_unidade
      or new.created_at is distinct from old.created_at
      or new.code is distinct from old.code
      or new.related_checklist_item_id is distinct from old.related_checklist_item_id
    then
      raise exception 'Só é permitido marcar a ocorrência como resolvida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_ocorrencia_public_update on ocorrencias;
create trigger trg_protect_ocorrencia_public_update
  before update on ocorrencias
  for each row execute function protect_ocorrencia_public_update();

-- ============================================================
-- Identificadores legíveis (CHK-001/OC-001), sequenciais por condomínio,
-- gerados no servidor pra não ter corrida/lacuna entre criações quase
-- simultâneas.
-- ============================================================
create or replace function assign_ambiente_checklist_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_next integer;
begin
  if new.checklist_code is not null then
    return new;
  end if;
  select count(*) + 1 into v_next from ambientes where condominio_id = new.condominio_id;
  new.checklist_code := 'CHK-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_assign_ambiente_checklist_code on ambientes;
create trigger trg_assign_ambiente_checklist_code
  before insert on ambientes
  for each row execute function assign_ambiente_checklist_code();

create or replace function assign_ocorrencia_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_condominio_id text;
  v_next integer;
begin
  if new.code is not null then
    return new;
  end if;
  select condominio_id into v_condominio_id from ambientes where id = new.ambiente_id;
  select count(*) + 1 into v_next
    from ocorrencias o
    join ambientes a on a.id = o.ambiente_id
    where a.condominio_id = v_condominio_id;
  new.code := 'OC-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_assign_ocorrencia_code on ocorrencias;
create trigger trg_assign_ocorrencia_code
  before insert on ocorrencias
  for each row execute function assign_ocorrencia_code();

-- ============================================================
-- Limites de uso por plano — ver comentário completo em
-- plan_limits_migration.sql sobre o trigger de bloqueio e o SQLSTATE CI001.
-- ============================================================

create table if not exists accounts (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  plan_name             text,
  condominio_limit      integer not null default 0,
  status                text not null default 'trial',
  role                  text not null default 'customer' check (role in ('customer', 'owner')),
  asaas_customer_id     text,
  onboarding_completed  boolean not null default false,
  bypass_limits         boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create or replace function handle_new_user_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (id, email, status, condominio_limit)
  values (new.id, new.email, 'trial', 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function handle_new_user_account();

alter table accounts enable row level security;
create policy "accounts_select_own" on accounts
  for select to authenticated using (id = auth.uid());

-- A conta pode dar UPDATE na própria linha (ex.: marcar onboarding_completed),
-- mas campos sensíveis (plano, limites, status, role) só podem mudar via
-- is_platform_owner() (aba Usuários) ou service role — protegido por
-- trigger logo abaixo, não por GRANT de coluna, porque accounts_platform_
-- owner_update (mais abaixo neste arquivo) precisa continuar editando
-- esses mesmos campos em QUALQUER conta.
create policy "accounts_update_own" on accounts
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- auth.role() <> 'service_role' é essencial: sem essa isenção, o
-- asaas-webhook (que atualiza plan_name/status/etc via service role
-- depois de um pagamento) ficaria bloqueado pelo próprio trigger.
-- Redefinida de novo mais abaixo, junto do bloco de retenção/exclusão,
-- pra incluir mais 3 colunas que só existem a partir dali.
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
      or new.bypass_limits is distinct from old.bypass_limits
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
  -- Conta dona da plataforma ou com isenção individual de limite: acesso
  -- ilimitado, sem depender de assinatura.
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

drop trigger if exists trg_check_condominio_limit on condominios;
create trigger trg_check_condominio_limit
  before insert on condominios
  for each row execute function check_condominio_limit();

-- ============================================================
-- Sub-usuários por conta — ver comentário completo em
-- sub_usuarios_migration.sql.
-- ============================================================

alter table accounts add column if not exists sub_usuario_limit integer not null default 0;
create extension if not exists pgcrypto;

create table if not exists sub_usuarios (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id) on delete cascade,
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null,
  created_at    timestamptz not null default now()
);
create index if not exists sub_usuarios_account_id_idx on sub_usuarios(account_id);

create table if not exists sub_usuario_condominios (
  sub_usuario_id  uuid not null references sub_usuarios(id) on delete cascade,
  condominio_id   text not null references condominios(id) on delete cascade,
  primary key (sub_usuario_id, condominio_id)
);
create index if not exists sub_usuario_condominios_condominio_id_idx on sub_usuario_condominios(condominio_id);

create or replace function has_subusuario_access(target_condominio_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sub_usuarios su
    join sub_usuario_condominios suc on suc.sub_usuario_id = su.id
    where su.auth_user_id = auth.uid() and suc.condominio_id = target_condominio_id
  );
$$;

create or replace function has_subusuario_access_via_ambiente(target_ambiente_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ambientes a
    join sub_usuarios su on su.auth_user_id = auth.uid()
    join sub_usuario_condominios suc on suc.sub_usuario_id = su.id and suc.condominio_id = a.condominio_id
    where a.id = target_ambiente_id
  );
$$;

create or replace function condominio_owner_account(target_condominio_id text)
returns uuid language sql stable security definer set search_path = public as $$
  select account_id from condominios where id = target_condominio_id;
$$;

create or replace function ambiente_owner_account(target_ambiente_id text)
returns uuid language sql stable security definer set search_path = public as $$
  select c.account_id from ambientes a join condominios c on c.id = a.condominio_id where a.id = target_ambiente_id;
$$;

alter table sub_usuarios enable row level security;
alter table sub_usuario_condominios enable row level security;

create policy "sub_usuarios_owner_all" on sub_usuarios
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "sub_usuarios_self_select" on sub_usuarios
  for select to authenticated using (auth_user_id = auth.uid());

create policy "sub_usuario_condominios_owner_all" on sub_usuario_condominios
  for all to authenticated
  using (exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.account_id = auth.uid()))
  with check (exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.account_id = auth.uid()));
create policy "sub_usuario_condominios_self_select" on sub_usuario_condominios
  for select to authenticated
  using (exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.auth_user_id = auth.uid()));

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

drop trigger if exists trg_check_subusuario_limit on sub_usuarios;
create trigger trg_check_subusuario_limit
  before insert on sub_usuarios
  for each row execute function check_subusuario_limit();

-- Políticas adicionais nas tabelas principais, pra sub-usuários (somam às
-- políticas "_owner_all"/"_public_*" já criadas acima, não substituem nada).
create policy "condominios_subusuario_select" on condominios
  for select to authenticated using (has_subusuario_access(id));

create policy "ambientes_subusuario_all" on ambientes
  for all to authenticated
  using (has_subusuario_access(condominio_id))
  with check (has_subusuario_access(condominio_id) and account_id = condominio_owner_account(condominio_id));

create policy "checklist_items_subusuario_all" on checklist_items
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

create policy "execucoes_subusuario_all" on execucoes
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

create policy "ocorrencias_subusuario_all" on ocorrencias
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

-- ============================================================
-- Cupons de desconto — ver supabase/cupons_migration.sql pro comentário
-- completo. Sem policy nenhuma de propósito: só a service role (Edge
-- Function subscribe) consegue ler/validar cupons.
create table if not exists cupons (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  tipo         text not null check (tipo in ('percentual', 'fixo')),
  valor        numeric not null check (valor > 0),
  validade     date,
  limite_usos  integer check (limite_usos is null or limite_usos > 0),
  usos         integer not null default 0,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists cupons_codigo_upper_idx on cupons (upper(codigo));
alter table cupons enable row level security;

-- ============================================================
-- Visão administrativa unificada de Usuários (accounts + sub_usuarios) pra
-- accounts.role = 'owner' — ver supabase/usuarios_admin_migration.sql pro
-- comentário completo. Sufixo "_platform_owner" pra não colidir com as
-- policies "_owner_*" já existentes acima (que significam "a conta
-- principal dona do registro", não o owner da plataforma).
--
-- "quem está logado é owner?" usa uma function SECURITY DEFINER
-- (is_platform_owner()), nunca uma subquery inline em "accounts" — uma
-- policy em accounts que consulta accounts de novo entra em "infinite
-- recursion detected in policy for relation accounts". A function, sendo
-- SECURITY DEFINER, ignora RLS por dentro e rompe o ciclo.
create or replace function is_platform_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = auth.uid() and role = 'owner');
$$;

create policy "accounts_platform_owner_select" on accounts
  for select to authenticated
  using (is_platform_owner());

create policy "accounts_platform_owner_update" on accounts
  for update to authenticated
  using (is_platform_owner())
  with check (is_platform_owner());

create policy "sub_usuarios_platform_owner_select" on sub_usuarios
  for select to authenticated
  using (is_platform_owner());

create policy "sub_usuarios_platform_owner_delete" on sub_usuarios
  for delete to authenticated
  using (is_platform_owner());

create policy "sub_usuario_condominios_platform_owner_all" on sub_usuario_condominios
  for all to authenticated
  using (is_platform_owner())
  with check (is_platform_owner());

-- Sem policy de SELECT geral em condominios pro owner (vazaria pro
-- dashboard comum via consultas sem filtro) — function restrita em vez
-- disso, só id/nome dos ids pedidos.
create or replace function get_condominio_names_for_owner(ids text[])
returns table (id text, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name
  from condominios c
  where c.id = any(ids) and is_platform_owner();
$$;

create or replace function get_account_condominios_for_owner(target_account_id uuid)
returns table (id text, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name
  from condominios c
  where c.account_id = target_account_id and is_platform_owner();
$$;

-- Gerenciamento de cupons pelo owner (aba Cupons em Usuários) — cupons não
-- tem nenhuma outra policy de propósito (só service role lê/valida na
-- Edge Function subscribe), então só o owner ganha acesso direto aqui.
create policy "cupons_platform_owner_all" on cupons
  for all to authenticated
  using (is_platform_owner())
  with check (is_platform_owner());

-- ============================================================
-- Trilha de auditoria de ações administrativas — ver
-- supabase/audit_log_migration.sql pro comentário completo.
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id) on delete cascade,
  auth_user_id  uuid references auth.users(id) on delete set null,
  action        text not null,
  entity_type   text,
  entity_id     text,
  details       jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_account_id_idx on audit_log(account_id, created_at desc);

alter table audit_log enable row level security;

create policy "audit_log_owner_select" on audit_log
  for select to authenticated
  using (account_id = auth.uid());

create policy "audit_log_insert" on audit_log
  for insert to authenticated
  with check (
    account_id = auth.uid()
    or exists (
      select 1 from sub_usuarios su
      where su.auth_user_id = auth.uid() and su.account_id = audit_log.account_id
    )
    or is_platform_owner()
  );

-- ============================================================
-- Inscrições de notificação push (Web Push API nativa) — ver
-- supabase/push_subscriptions_migration.sql pro comentário completo.
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_account_id_idx on push_subscriptions(account_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_owner_all" on push_subscriptions
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());

-- ============================================================
-- Bloqueio de conta inativa (pagamento pendente/cancelado) e exclusão
-- automática após 90 dias — ver supabase/retention_migration.sql pro
-- comentário completo e pro agendamento via pg_cron (que precisa da URL
-- do projeto e de um secret preenchidos à mão, por isso não está aqui).
alter table accounts add column if not exists inactive_since timestamptz;
alter table accounts add column if not exists deletion_warning_15d_sent_at timestamptz;
alter table accounts add column if not exists deletion_warning_3d_sent_at timestamptz;

-- Redefine protect_account_sensitive_columns (declarada mais acima) pra
-- também proteger essas 3 colunas novas, agora que já existem.
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

create table if not exists account_deletions (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null,
  email           text,
  reason          text not null,
  inactive_since  timestamptz,
  deleted_at      timestamptz not null default now()
);
alter table account_deletions enable row level security;

create or replace function is_account_active(target_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts
    where id = target_account_id and (status = 'ativo' or role = 'owner' or bypass_limits)
  );
$$;

create or replace function block_writes_when_inactive()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid;
begin
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

insert into storage.buckets (id, name, public)
values ('data-backups', 'data-backups', false)
on conflict (id) do nothing;
