-- Reformulação do checklist: substitui checklist_grupos (grupos nomeados
-- com toggle ativo/inativo, vários simultâneos) por checklist_periodos —
-- volta a ser UM checklist por ambiente, agora organizado em "períodos de
-- execução": sempre existe exatamente UM período ativo por ambiente;
-- fechar o período ativo copia os itens atuais pro período novo (como
-- pendentes) e o período fechado vira histórico read-only, preservando o
-- estado exato de cada item no momento do fechamento. Ver
-- checklist_grupos_migration.sql pro histórico do modelo anterior (que
-- durou pouco).

-- ============================================================
-- 1. Nova tabela checklist_periodos
-- ============================================================
create table if not exists checklist_periodos (
  id           text primary key,
  ambiente_id  text not null references ambientes(id) on delete cascade,
  account_id   uuid not null references auth.users(id) on delete cascade,
  nome         text not null,
  status       text not null default 'ativo' check (status in ('ativo', 'fechado')),
  started_at   timestamptz not null default now(),
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists checklist_periodos_ambiente_id_idx on checklist_periodos(ambiente_id);
create index if not exists checklist_periodos_account_id_idx on checklist_periodos(account_id);

alter table checklist_periodos enable row level security;

create policy "checklist_periodos_owner_all" on checklist_periodos
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "checklist_periodos_public_select" on checklist_periodos
  for select to anon using (true);
create policy "checklist_periodos_subusuario_all" on checklist_periodos
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

-- ============================================================
-- 2. Migra dados: um período inicial ("Período 1") por ambiente que já
-- tinha algum checklist (grupo e/ou itens) — consolida todos os grupos
-- antigos daquele ambiente num único período ativo, sem perder os itens.
-- ============================================================
create temporary table _ambiente_periodo_map (
  ambiente_id text primary key,
  periodo_id  text not null
);

insert into _ambiente_periodo_map (ambiente_id, periodo_id)
select distinct a.id, 'per_' || substr(md5(a.id || clock_timestamp()::text || random()::text), 1, 16)
from ambientes a
where exists (select 1 from checklist_grupos g where g.ambiente_id = a.id)
   or exists (select 1 from checklist_items i where i.ambiente_id = a.id);

insert into checklist_periodos (id, ambiente_id, account_id, nome, status, started_at)
select m.periodo_id, a.id, a.account_id, 'Período 1', 'ativo',
       coalesce((select min(g.created_at) from checklist_grupos g where g.ambiente_id = a.id), now())
from _ambiente_periodo_map m
join ambientes a on a.id = m.ambiente_id;

-- ============================================================
-- 3. checklist_items: troca checklist_grupo_id -> checklist_periodo_id
-- e ganha os campos novos de status individual / rastreio de quem criou
-- e resolveu cada tarefa.
-- ============================================================
alter table checklist_items add column if not exists checklist_periodo_id text references checklist_periodos(id) on delete cascade;

update checklist_items i
set checklist_periodo_id = m.periodo_id
from _ambiente_periodo_map m
where m.ambiente_id = i.ambiente_id;

alter table checklist_items alter column checklist_periodo_id set not null;

alter table checklist_items drop constraint if exists checklist_items_checklist_grupo_id_fkey;
alter table checklist_items drop column if exists checklist_grupo_id;

alter table checklist_items add column if not exists descricao text;
alter table checklist_items add column if not exists status text not null default 'pendente' check (status in ('pendente', 'concluido'));
alter table checklist_items add column if not exists criado_por text;
alter table checklist_items add column if not exists resolvido_por text;
alter table checklist_items add column if not exists resolvido_em timestamptz;

create index if not exists checklist_items_checklist_periodo_id_idx on checklist_items(checklist_periodo_id);
drop index if exists checklist_items_checklist_grupo_id_idx;

-- ============================================================
-- 4. execucoes: troca checklist_grupo_id -> checklist_periodo_id
-- (execuções antigas ficam associadas ao período inicial migrado do
-- mesmo ambiente — o conteúdo detalhado de cada execução já está
-- preservado em items/jsonb; isso só reatribui a etiqueta de período).
-- ============================================================
alter table execucoes add column if not exists checklist_periodo_id text references checklist_periodos(id) on delete set null;

update execucoes e
set checklist_periodo_id = m.periodo_id
from _ambiente_periodo_map m
where m.ambiente_id = e.ambiente_id;

alter table execucoes drop constraint if exists execucoes_checklist_grupo_id_fkey;
alter table execucoes drop column if exists checklist_grupo_id;

create index if not exists execucoes_checklist_periodo_id_idx on execucoes(checklist_periodo_id);
drop index if exists execucoes_checklist_grupo_id_idx;

drop table _ambiente_periodo_map;

-- ============================================================
-- 5. Remove o modelo antigo de grupos (dados já migrados acima).
-- ============================================================
drop table if exists checklist_grupos cascade;

-- ============================================================
-- 6. Comentários por item de checklist — thread interna (gestor/
-- colaborador) em cada item, usada na página de detalhe do item (Tela 2).
-- ============================================================
create table if not exists checklist_item_comentarios (
  id                  text primary key,
  checklist_item_id   text not null references checklist_items(id) on delete cascade,
  ambiente_id         text not null references ambientes(id) on delete cascade,
  account_id          uuid not null references auth.users(id) on delete cascade,
  autor               text,
  texto               text not null,
  created_at          timestamptz not null default now()
);
create index if not exists checklist_item_comentarios_item_id_idx on checklist_item_comentarios(checklist_item_id);
create index if not exists checklist_item_comentarios_account_id_idx on checklist_item_comentarios(account_id);

alter table checklist_item_comentarios enable row level security;

create policy "checklist_item_comentarios_owner_all" on checklist_item_comentarios
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "checklist_item_comentarios_public_select" on checklist_item_comentarios
  for select to anon using (true);
create policy "checklist_item_comentarios_subusuario_all" on checklist_item_comentarios
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

-- ============================================================
-- 7. Bloqueio de escrita quando a conta está inativa — mesmo padrão já
-- usado nas outras tabelas (ver retention_migration.sql). O trigger de
-- checklist_grupos já some sozinho junto com o "drop table cascade" acima.
-- ============================================================
drop trigger if exists trg_block_inactive_checklist_periodos on checklist_periodos;
create trigger trg_block_inactive_checklist_periodos
  before insert or update or delete on checklist_periodos
  for each row execute function block_writes_when_inactive();

drop trigger if exists trg_block_inactive_checklist_item_comentarios on checklist_item_comentarios;
create trigger trg_block_inactive_checklist_item_comentarios
  before insert or update or delete on checklist_item_comentarios
  for each row execute function block_writes_when_inactive();
