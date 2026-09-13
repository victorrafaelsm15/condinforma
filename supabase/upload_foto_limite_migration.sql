-- Cond-Informa — limite de tamanho de foto também no banco, não só na UI.
-- Validação só no navegador (ExecutarChecklistPage.jsx, OcorrenciaForm.jsx,
-- ChecklistItemPage.jsx) é fácil de contornar chamando a RPC direto (ver
-- supabase/tenant_isolation_hardening_migration.sql) — sem limite aqui,
-- qualquer um insere uma string arbitrariamente grande na coluna "photo".
-- Rode uma vez no SQL Editor.
--
-- 7.000.000 caracteres de base64 ~ 5,25 MB de arquivo original (base64
-- expande em ~4/3) — a mesma folga usada na validação do navegador
-- (MAX_FILE_SIZE_BYTES em src/lib/imageUpload.js), com margem pro prefixo
-- "data:image/...;base64,".

create or replace function insert_execucao_publica(
  p_id text,
  p_ambiente_id text,
  p_checklist_periodo_id text,
  p_executed_by text,
  p_completed_count integer,
  p_total_count integer,
  p_items jsonb,
  p_photo text,
  p_free_text_note text,
  p_created_at timestamptz
)
returns table (new_id text, was_inserted boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid;
  v_returned_id text;
begin
  select a.account_id into v_account_id from ambientes a where a.id = p_ambiente_id;
  if v_account_id is null then
    raise exception 'Ambiente não encontrado.' using errcode = 'P0002';
  end if;

  if p_checklist_periodo_id is not null and not exists (
    select 1 from checklist_periodos cp where cp.id = p_checklist_periodo_id and cp.ambiente_id = p_ambiente_id
  ) then
    raise exception 'Período de checklist não pertence a este ambiente.' using errcode = 'P0002';
  end if;

  if p_photo is not null and length(p_photo) > 7000000 then
    raise exception 'Foto excede o tamanho máximo permitido.' using errcode = 'P0003';
  end if;

  insert into execucoes (
    id, created_at, ambiente_id, checklist_periodo_id, account_id,
    executed_by, completed_count, total_count, items, photo, free_text_note
  ) values (
    p_id, coalesce(p_created_at, now()), p_ambiente_id, p_checklist_periodo_id, v_account_id,
    p_executed_by, coalesce(p_completed_count, 0), coalesce(p_total_count, 0), p_items, p_photo, p_free_text_note
  )
  on conflict (id) do nothing
  returning execucoes.id into v_returned_id;

  return query select p_id, (v_returned_id is not null);
end;
$$;

create or replace function insert_ocorrencia_publica(
  p_id text,
  p_ambiente_id text,
  p_description text,
  p_photo text,
  p_reported_by_role text,
  p_reporter_name text,
  p_reporter_unidade text,
  p_related_checklist_item_id text,
  p_created_at timestamptz
)
returns table (new_id text, was_inserted boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid;
  v_related_id text;
  v_returned_id text;
begin
  select a.account_id into v_account_id from ambientes a where a.id = p_ambiente_id;
  if v_account_id is null then
    raise exception 'Ambiente não encontrado.' using errcode = 'P0002';
  end if;

  if p_photo is not null and length(p_photo) > 7000000 then
    raise exception 'Foto excede o tamanho máximo permitido.' using errcode = 'P0003';
  end if;

  v_related_id := null;
  if p_related_checklist_item_id is not null and exists (
    select 1 from checklist_items ci where ci.id = p_related_checklist_item_id and ci.ambiente_id = p_ambiente_id
  ) then
    v_related_id := p_related_checklist_item_id;
  end if;

  insert into ocorrencias (
    id, created_at, ambiente_id, account_id, description, photo, status,
    reported_by_role, reporter_name, reporter_unidade, related_checklist_item_id
  ) values (
    p_id, coalesce(p_created_at, now()), p_ambiente_id, v_account_id, p_description, p_photo, 'pendente',
    p_reported_by_role, p_reporter_name, p_reporter_unidade, v_related_id
  )
  on conflict (id) do nothing
  returning ocorrencias.id into v_returned_id;

  return query select p_id, (v_returned_id is not null);
end;
$$;

grant execute on function insert_execucao_publica(text, text, text, text, integer, integer, jsonb, text, text, timestamptz) to anon;
grant execute on function insert_ocorrencia_publica(text, text, text, text, text, text, text, text, timestamptz) to anon;
