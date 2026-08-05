-- Cond-Informa — schema do Supabase (instalação nova, já multi-tenant)
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e rode uma vez.
--
-- Se você já tem um projeto Supabase rodando este app em modo single-tenant
-- (sem account_id/RLS), NÃO rode este arquivo — use
-- supabase/multitenant_migration.sql em vez disso.
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
