-- Cond-Informa — reformula o checklist de cada ambiente pra suportar
-- múltiplos GRUPOS nomeados (ex: "Rotina Diária", "Faxina Semanal"), cada
-- um com seu próprio status ativo/inativo e sua própria lista de itens,
-- substituindo o toggle único ambientes.checklist_ativo (que não
-- diferenciava rotinas). Rode este arquivo INTEIRO, uma vez, no SQL
-- Editor. Pré-requisito: schema.sql (ou as migrations anteriores) já
-- devem ter rodado — usa is_account_active(), block_writes_when_inactive(),
-- has_subusuario_access_via_ambiente() e ambiente_owner_account(), todas
-- já existentes.
--
-- Decisão de migração: checklist_items MANTÉM a coluna ambiente_id (em
-- vez de trocar por checklist_grupo_id) e GANHA checklist_grupo_id como
-- coluna adicional — denormalizado de propósito, é a forma mais segura de
-- migrar: preserva 100% das políticas de RLS e das consultas já
-- existentes que filtram checklist_items por ambiente_id (inclusive no
-- fallback de localStorage do createStore.js), sem precisar reescrever
-- nada disso. checklist_grupo_id é só a referência NOVA, usada pela UI
-- pra agrupar/filtrar por rotina.

-- Pré-requisito descoberto ao rodar esta migration: block_writes_when_
-- inactive() (de supabase/retention_migration.sql) nunca foi criada no
-- banco de produção — só as 3 colunas em accounts (inactive_since/
-- deletion_warning_*) e is_account_active() existem (essa por causa do
-- bypass_limits_migration.sql, que também a recria). account_deletions e
-- os triggers trg_block_inactive_* em todas as tabelas também estão
-- faltando — ou seja, o bloqueio de conta inativa e a exclusão
-- automática após 90 dias nunca ficaram realmente ativos, apesar de já
-- terem sido reportados como testados numa sessão anterior. Isso é um
-- problema separado desta migration; recria-se aqui só a function (sem
-- efeito colateral em nenhuma tabela existente) porque checklist_grupos
-- precisa dela pro mesmo padrão de bloqueio-por-inatividade das outras
-- tabelas. NÃO aplica o trigger retroativamente em condominios/
-- ambientes/checklist_items/execucoes/ocorrencias/sub_usuarios — isso
-- mudaria o comportamento de contas já em produção sem aviso prévio,
-- decisão que fica de fora do escopo desta migration de propósito.
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

-- ============================================================
-- Tabela de grupos de checklist
-- ============================================================
create table if not exists checklist_grupos (
  id           text primary key,
  ambiente_id  text not null references ambientes(id) on delete cascade,
  account_id   uuid not null references auth.users(id) on delete cascade,
  nome         text not null,
  status       text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at   timestamptz not null default now()
);
create index if not exists checklist_grupos_ambiente_id_idx on checklist_grupos(ambiente_id);
create index if not exists checklist_grupos_account_id_idx on checklist_grupos(account_id);

alter table checklist_grupos enable row level security;

create policy "checklist_grupos_owner_all" on checklist_grupos
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
-- Colaborador/morador (sem login) precisam ler nome e status dos grupos
-- pra saber quais estão ativos na tela pública de execução — mesmo
-- critério já usado em ambientes/checklist_items.
create policy "checklist_grupos_public_select" on checklist_grupos
  for select to anon using (true);
create policy "checklist_grupos_subusuario_all" on checklist_grupos
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

drop trigger if exists trg_block_inactive_checklist_grupos on checklist_grupos;
create trigger trg_block_inactive_checklist_grupos
  before insert or update or delete on checklist_grupos
  for each row execute function block_writes_when_inactive();

-- ============================================================
-- checklist_items ganha a referência ao grupo (ambiente_id continua
-- existindo, ver decisão de migração no comentário do topo).
-- ============================================================
alter table checklist_items add column if not exists checklist_grupo_id text references checklist_grupos(id) on delete cascade;
create index if not exists checklist_items_checklist_grupo_id_idx on checklist_items(checklist_grupo_id);

-- Backfill: cria um grupo "Checklist Principal" (ativo) pra cada ambiente
-- que já tinha itens, e migra esses itens pra ele — preserva 100% dos
-- dados existentes, sem quebrar nada que já estava funcionando.
insert into checklist_grupos (id, ambiente_id, account_id, nome, status, created_at)
select
  'grp-migrado-' || a.id,
  a.id,
  a.account_id,
  'Checklist Principal',
  'ativo',
  now()
from ambientes a
where exists (select 1 from checklist_items ci where ci.ambiente_id = a.id and ci.checklist_grupo_id is null)
on conflict (id) do nothing;

update checklist_items ci
set checklist_grupo_id = 'grp-migrado-' || ci.ambiente_id
where ci.checklist_grupo_id is null;

-- Daqui em diante todo item precisa pertencer a um grupo — a UI sempre
-- cria dentro de um grupo específico, nunca mais solto no ambiente.
alter table checklist_items alter column checklist_grupo_id set not null;

-- ============================================================
-- execucoes ganha a referência a qual grupo foi executado, pra permitir
-- histórico filtrado por grupo. Nullable (não NOT NULL): fica de fora
-- de execuções antigas que o backfill abaixo não conseguir associar a
-- nenhum grupo, sem impedir a escrita.
-- ============================================================
alter table execucoes add column if not exists checklist_grupo_id text references checklist_grupos(id) on delete set null;
create index if not exists execucoes_checklist_grupo_id_idx on execucoes(checklist_grupo_id);

-- Backfill best-effort: execuções antigas do mesmo ambiente do grupo
-- migrado acima ganham essa referência, pra manter o histórico coerente
-- (essas execuções de fato aconteceram antes de existir o conceito de
-- grupo, então "Checklist Principal" é a atribuição mais correta possível).
update execucoes e
set checklist_grupo_id = 'grp-migrado-' || e.ambiente_id
where e.checklist_grupo_id is null
  and exists (select 1 from checklist_grupos g where g.id = 'grp-migrado-' || e.ambiente_id);

-- ============================================================
-- Remove o toggle antigo de ambientes — substituído pelo status por
-- grupo (checklist_grupos.status).
-- ============================================================
alter table ambientes drop column if exists checklist_ativo;
