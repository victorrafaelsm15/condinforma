-- Conteúdo real da página de Relatórios: indicadores, gráfico de
-- execuções, rankings de ambientes/itens problemáticos e exportação em
-- PDF, tudo agregado no banco (não no cliente) pra não pesar em contas
-- com múltiplos condomínios grandes.

-- ============================================================
-- 1. ocorrencias.resolvido_em — necessário pro indicador "tempo médio de
-- resolução". Setado automaticamente por trigger sempre que o status
-- vira 'resolvido' (e limpo se reaberto), tanto no fluxo autenticado
-- (gestor resolvendo via OcorrenciaDetailPage) quanto no fluxo público
-- anônimo (morador/colaborador marcando como resolvido) — nenhum client
-- precisa (nem pode) setar esse campo direto.
--
-- Ordem de triggers BEFORE UPDATE em ocorrencias é alfabética por nome:
-- "trg_protect_ocorrencia_public_update" roda ANTES de
-- "trg_set_ocorrencia_resolvido_em", e como nenhum client já escreve em
-- resolvido_em, o trigger de proteção não precisa listar essa coluna —
-- new.resolvido_em chega igual a old.resolvido_em em qualquer update
-- (SQL só altera colunas citadas no SET), então a checagem "is distinct
-- from" dele já passa sozinha.
-- ============================================================
alter table ocorrencias add column if not exists resolvido_em timestamptz;

create or replace function set_ocorrencia_resolvido_em()
returns trigger language plpgsql as $$
begin
  if new.status = 'resolvido' and old.status is distinct from 'resolvido' then
    new.resolvido_em := now();
  elsif new.status is distinct from 'resolvido' then
    new.resolvido_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_ocorrencia_resolvido_em on ocorrencias;
create trigger trg_set_ocorrencia_resolvido_em
  before update on ocorrencias
  for each row execute function set_ocorrencia_resolvido_em();

-- Backfill best-effort: ocorrências já resolvidas antes desta migration
-- não têm como saber quando foram resolvidas de verdade — deixa
-- resolvido_em null pra elas (ficam de fora da média de tempo de
-- resolução, em vez de usar um valor inventado).

-- ============================================================
-- 2. Functions de agregação pros Relatórios — todas "security invoker"
-- (padrão, sem "security definer"): rodam com o papel de quem chamou,
-- então RLS de execucoes/ocorrencias/checklist_items/ambientes/
-- condominios se aplica exatamente como numa consulta direta — dono vê
-- só a própria conta, sub-usuário só os condomínios liberados pra ele.
-- p_condominio_id null = todos os condomínios visíveis pra quem chamou.
-- ============================================================

create or replace function report_execucoes_indicators(
  p_condominio_id text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
) returns table (total_execucoes bigint, completed_sum bigint, total_sum bigint)
language sql stable as $$
  select
    count(*) as total_execucoes,
    coalesce(sum(e.completed_count), 0) as completed_sum,
    coalesce(sum(e.total_count), 0) as total_sum
  from execucoes e
  join ambientes a on a.id = e.ambiente_id
  where (p_condominio_id is null or a.condominio_id = p_condominio_id)
    and (p_date_from is null or e.created_at >= p_date_from)
    and (p_date_to is null or e.created_at <= p_date_to);
$$;

create or replace function report_ocorrencias_indicators(
  p_condominio_id text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
) returns table (abertas bigint, resolvidas bigint, tempo_medio_resolucao_horas numeric)
language sql stable as $$
  select
    count(*) filter (where o.status <> 'resolvido') as abertas,
    count(*) filter (where o.status = 'resolvido') as resolvidas,
    avg(extract(epoch from (o.resolvido_em - o.created_at)) / 3600.0)
      filter (where o.status = 'resolvido' and o.resolvido_em is not null) as tempo_medio_resolucao_horas
  from ocorrencias o
  join ambientes a on a.id = o.ambiente_id
  where (p_condominio_id is null or a.condominio_id = p_condominio_id)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at <= p_date_to);
$$;

-- Taxa de conclusão do relatório é sobre o status individual dos itens
-- do checklist (modelo de períodos atual), não sobre completed_count/
-- total_count das execuções (esse fica só pro card "Total de execuções").
create or replace function report_checklist_items_indicators(
  p_condominio_id text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
) returns table (total_itens bigint, concluidos bigint)
language sql stable as $$
  select
    count(*) as total_itens,
    count(*) filter (where i.status = 'concluido') as concluidos
  from checklist_items i
  join ambientes a on a.id = i.ambiente_id
  where (p_condominio_id is null or a.condominio_id = p_condominio_id)
    and (p_date_from is null or i.created_at >= p_date_from)
    and (p_date_to is null or i.created_at <= p_date_to);
$$;

-- p_bucket: 'day' ou 'week' — o front decide qual usar conforme o
-- tamanho do período selecionado, pra não poluir o eixo X em janelas
-- longas (ex: 90 dias).
create or replace function report_execucoes_series(
  p_condominio_id text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_bucket text default 'day'
) returns table (bucket_date date, total bigint)
language sql stable as $$
  select date_trunc(p_bucket, e.created_at)::date as bucket_date, count(*) as total
  from execucoes e
  join ambientes a on a.id = e.ambiente_id
  where (p_condominio_id is null or a.condominio_id = p_condominio_id)
    and (p_date_from is null or e.created_at >= p_date_from)
    and (p_date_to is null or e.created_at <= p_date_to)
  group by 1
  order by 1;
$$;

create or replace function report_ocorrencias_ranking_ambiente(
  p_condominio_id text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_limit integer default 10
) returns table (ambiente_id text, ambiente_name text, condominio_name text, total bigint)
language sql stable as $$
  select a.id, a.name, c.name, count(*) as total
  from ocorrencias o
  join ambientes a on a.id = o.ambiente_id
  join condominios c on c.id = a.condominio_id
  where (p_condominio_id is null or a.condominio_id = p_condominio_id)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at <= p_date_to)
  group by a.id, a.name, c.name
  order by total desc, a.name asc
  limit p_limit;
$$;

create or replace function report_checklist_item_ranking(
  p_condominio_id text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_limit integer default 10
) returns table (item_id text, task text, ambiente_id text, ambiente_name text, total bigint)
language sql stable as $$
  select i.id, i.task, a.id, a.name, count(o.id) as total
  from ocorrencias o
  join checklist_items i on i.id = o.related_checklist_item_id
  join ambientes a on a.id = i.ambiente_id
  where o.related_checklist_item_id is not null
    and (p_condominio_id is null or a.condominio_id = p_condominio_id)
    and (p_date_from is null or o.created_at >= p_date_from)
    and (p_date_to is null or o.created_at <= p_date_to)
  group by i.id, i.task, a.id, a.name
  order by total desc, i.task asc
  limit p_limit;
$$;
