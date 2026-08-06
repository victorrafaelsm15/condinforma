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
  id             text primary key,
  condominio_id  text not null references condominios(id) on delete cascade,
  account_id     uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  created_at     timestamptz not null default now()
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
  created_at       timestamptz not null default now()
);
create index if not exists execucoes_ambiente_id_idx on execucoes(ambiente_id);
create index if not exists execucoes_account_id_idx on execucoes(account_id);

create table if not exists ocorrencias (
  id           text primary key,
  ambiente_id  text not null references ambientes(id) on delete cascade,
  account_id   uuid not null references auth.users(id) on delete cascade,
  description  text not null,
  photo        text,
  status       text not null default 'pendente',
  created_at   timestamptz not null default now()
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

-- ============================================================
-- Limites de uso por plano — ver comentário completo em
-- plan_limits_migration.sql sobre o trigger de bloqueio e o SQLSTATE CI001.
-- ============================================================

create table if not exists accounts (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  plan_name          text,
  condominio_limit   integer not null default 0,
  status             text not null default 'trial',
  asaas_customer_id  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
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

create or replace function check_condominio_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_limit  integer;
  v_count  integer;
begin
  select status, condominio_limit into v_status, v_limit from accounts where id = new.account_id;
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
