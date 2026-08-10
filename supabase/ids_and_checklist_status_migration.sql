-- Cond-Informa — identificadores legíveis (CHK-001/OC-001), status ativo/
-- inativo do checklist de um ambiente, e vínculo opcional entre uma
-- ocorrência e o item de checklist a que ela se refere. Rode este arquivo
-- INTEIRO, uma vez, no SQL Editor.

-- ============================================================
-- Identificador legível do "checklist" (= o ambiente, que é quem carrega
-- o conjunto de checklist_items) — sequencial POR CONDOMÍNIO, gerado no
-- servidor (não no cliente) pra não ter corrida/lacuna quando dois
-- ambientes são criados quase ao mesmo tempo.
-- ============================================================
alter table ambientes add column if not exists checklist_code text;
alter table ambientes add column if not exists checklist_ativo boolean not null default true;

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

-- Backfill dos ambientes já existentes, numerando por ordem de criação
-- dentro de cada condomínio (mesmo critério do trigger acima).
with numbered as (
  select id, row_number() over (partition by condominio_id order by created_at) as rn
  from ambientes
  where checklist_code is null
)
update ambientes a
set checklist_code = 'CHK-' || lpad(numbered.rn::text, 3, '0')
from numbered
where a.id = numbered.id;

-- ============================================================
-- Identificador legível da ocorrência — mesma lógica, sequencial por
-- condomínio (via o ambiente da ocorrência).
-- ============================================================
alter table ocorrencias add column if not exists code text;
-- Vínculo opcional com o item de checklist a que a ocorrência se refere
-- (ex.: "a tarefa X não foi feita e por isso encontrei esse problema").
-- on delete set null: apagar o item de checklist não deve apagar a
-- ocorrência, só perder essa referência.
alter table ocorrencias add column if not exists related_checklist_item_id text references checklist_items(id) on delete set null;

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

with numbered as (
  select o.id, row_number() over (partition by a.condominio_id order by o.created_at) as rn
  from ocorrencias o
  join ambientes a on a.id = o.ambiente_id
  where o.code is null
)
update ocorrencias o
set code = 'OC-' || lpad(numbered.rn::text, 3, '0')
from numbered
where o.id = numbered.id;

-- Redefine protect_ocorrencia_public_update (criado em
-- ocorrencias_reporter_migration.sql) pra também proteger "code" e
-- "related_checklist_item_id" — sem isso, o visitante anônimo que marca
-- uma ocorrência como resolvida (única coisa que a policy pública de
-- update permite) também conseguiria reescrever essas duas colunas na
-- mesma requisição, já que a RLS em si é "using(true) with check(true)"
-- e só o trigger restringe campo a campo.
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
