-- Cond-Informa — migração para multi-tenant (Supabase Auth + RLS)
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor do seu projeto Supabase.
--
-- O que ele faz, em ordem:
--   1. Apaga os dados atuais das 5 tabelas (condominios, ambientes,
--      checklist_items, execucoes, ocorrencias) — confirmado com você que
--      são só dados de teste, sem valor a preservar. Se mudou de ideia,
--      NÃO rode este arquivo ainda — me avise antes.
--   2. Adiciona a coluna account_id (uuid, dono do registro) nas 5 tabelas.
--   3. Ativa Row Level Security e cria as políticas de acesso.
--
-- Depois de rodar isto, toda conta nova criada pelo app (cadastro em
-- /admin/signup) só vai ver e conseguir editar os próprios dados.

-- ============================================================
-- 1. Limpa os dados atuais (são de teste — ver observação acima)
-- ============================================================
truncate table
  ocorrencias,
  execucoes,
  checklist_items,
  ambientes,
  condominios
cascade;

-- ============================================================
-- 2. Coluna account_id — dono direto do registro em cada tabela
-- ============================================================
alter table condominios     add column if not exists account_id uuid references auth.users(id) on delete cascade;
alter table ambientes       add column if not exists account_id uuid references auth.users(id) on delete cascade;
alter table checklist_items add column if not exists account_id uuid references auth.users(id) on delete cascade;
alter table execucoes       add column if not exists account_id uuid references auth.users(id) on delete cascade;
alter table ocorrencias     add column if not exists account_id uuid references auth.users(id) on delete cascade;

alter table condominios     alter column account_id set not null;
alter table ambientes       alter column account_id set not null;
alter table checklist_items alter column account_id set not null;
alter table execucoes       alter column account_id set not null;
alter table ocorrencias     alter column account_id set not null;

create index if not exists condominios_account_id_idx     on condominios(account_id);
create index if not exists ambientes_account_id_idx       on ambientes(account_id);
create index if not exists checklist_items_account_id_idx on checklist_items(account_id);
create index if not exists execucoes_account_id_idx       on execucoes(account_id);
create index if not exists ocorrencias_account_id_idx     on ocorrencias(account_id);

-- ============================================================
-- 3. Row Level Security
-- ============================================================
-- Padrão em todas as 5 tabelas: o dono (account_id = auth.uid()) tem
-- controle total (select/insert/update/delete) via uma política "for all".
-- ambientes, checklist_items e execucoes recebem UMA política extra pública
-- (role "anon" apenas — nunca "authenticated", ver nota abaixo) para as
-- páginas sem login funcionarem via QR Code.
--
-- Nota importante sobre "to anon" (não "to anon, authenticated"): se a
-- política pública valesse também pra usuários logados, qualquer gestor
-- autenticado poderia, com uma consulta manual (fora da UI do app), ler os
-- dados de QUALQUER outro cliente — não só do ambiente que ele está vendo.
-- Restringindo a role "anon", o isolamento entre contas continua total pra
-- quem está logado; o efeito colateral é que, se um gestor logado abrir o
-- link público de um ambiente que NÃO é dele (ex.: QR Code de outro
-- cliente) na mesma aba, a página vai dar "não encontrado" — precisa abrir
-- em aba anônima ou deslogado. Achei esse trade-off correto dado que o
-- objetivo aqui é isolamento total dos dados.

alter table condominios     enable row level security;
alter table ambientes       enable row level security;
alter table checklist_items enable row level security;
alter table execucoes       enable row level security;
alter table ocorrencias     enable row level security;

-- --- condominios: só o dono, nunca público ---
create policy "condominios_owner_all" on condominios
  for all
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- --- ambientes: dono tem controle total + leitura pública por ID ---
create policy "ambientes_owner_all" on ambientes
  for all
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "ambientes_public_select" on ambientes
  for select
  to anon
  using (true);

-- --- checklist_items: dono tem controle total + leitura pública por ID ---
create policy "checklist_items_owner_all" on checklist_items
  for all
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "checklist_items_public_select" on checklist_items
  for select
  to anon
  using (true);

-- --- execucoes: dono tem controle total; colaborador (anon) só grava e lê ---
-- (leitura pública é necessária pra página de status público —
-- /ambiente/:id/status — mostrar a última verificação sem exigir login)
create policy "execucoes_owner_all" on execucoes
  for all
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "execucoes_public_insert" on execucoes
  for insert
  to anon
  with check (true);

create policy "execucoes_public_select" on execucoes
  for select
  to anon
  using (true);

-- --- ocorrencias: dono tem controle total; colaborador (anon) só grava ---
create policy "ocorrencias_owner_all" on ocorrencias
  for all
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "ocorrencias_public_insert" on ocorrencias
  for insert
  to anon
  with check (true);
