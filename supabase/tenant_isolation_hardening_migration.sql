-- Cond-Informa — correção de dois vazamentos críticos de isolamento entre
-- contas, achados em auditoria de segurança antes do lançamento pra
-- usuários reais. Rode este arquivo INTEIRO, uma vez, no SQL Editor.
--
-- ============================================================
-- PROBLEMA 1: escalação de privilégio via sub_usuario_condominios
-- ============================================================
-- A policy "sub_usuario_condominios_owner_all" só conferia que o
-- SUB-USUÁRIO pertence a quem está inserindo — nunca conferia que o
-- CONDOMÍNIO também pertence a essa mesma conta. Qualquer conta paga
-- conseguia se cadastrar como "sub-usuário de si mesma" e vincular esse
-- sub-usuário a um condominio_id de OUTRA conta, ganhando acesso total
-- (leitura + escrita + exclusão) aos dados dela via
-- has_subusuario_access()/has_subusuario_access_via_ambiente(), que
-- confiam cegamente nessa tabela.
drop policy if exists "sub_usuario_condominios_owner_all" on sub_usuario_condominios;
create policy "sub_usuario_condominios_owner_all" on sub_usuario_condominios
  for all to authenticated
  using (
    exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.account_id = auth.uid())
  )
  with check (
    exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.account_id = auth.uid())
    and condominio_owner_account(condominio_id) = auth.uid()
  );

-- ============================================================
-- PROBLEMA 2: leitura/escrita pública "to anon using (true)" = tabela
-- inteira, não "por ID", pra todos os clientes
-- ============================================================
-- O fluxo de QR Code (colaborador executa checklist / morador vê status,
-- ambos sem login) precisa de leitura e escrita anônimas — isso é
-- intencional. O erro foi implementar isso como policy de RLS com
-- "using (true)": RLS não consegue expressar "só se o cliente pediu por
-- ID exato" (ela é avaliada por linha, não pela forma da consulta), então
-- "using (true)" sempre significa "a tabela inteira", pra qualquer pessoa
-- com a anon key — que é pública, está embutida no bundle JS do site.
--
-- A correção correta pra "acesso público só por ID conhecido" em RLS é
-- via funções SECURITY DEFINER parametrizadas por ID: elas só devolvem a
-- linha pedida (nunca uma listagem sem filtro), então dropar a policy de
-- tabela inteira e mover o acesso público pra essas funções fecha o
-- vazamento sem quebrar o QR Code. Ver src/lib/publicChecklist.js (usado
-- por ExecutarChecklistPage.jsx, StatusPublicoPage.jsx e
-- offlineQueue.js) — só esses três arquivos precisam mudar; o resto do
-- app (autenticado) continua acessando essas tabelas do jeito que sempre
-- acessou.

drop policy if exists "ambientes_public_select" on ambientes;
drop policy if exists "checklist_periodos_public_select" on checklist_periodos;
drop policy if exists "checklist_items_public_select" on checklist_items;
drop policy if exists "checklist_item_comentarios_public_select" on checklist_item_comentarios; -- não usada por nenhuma tela pública — "comentários internos", nunca deveriam ter sido públicas
drop policy if exists "execucoes_public_select" on execucoes;
drop policy if exists "execucoes_public_insert" on execucoes;
drop policy if exists "ocorrencias_public_select" on ocorrencias;
drop policy if exists "ocorrencias_public_insert" on ocorrencias;
drop policy if exists "ocorrencias_public_update" on ocorrencias;

-- --- Leitura pública, escopada por ID (substituem os SELECTs acima) ---

create or replace function get_ambiente_publico(p_ambiente_id text)
returns table (id text, name text, account_id uuid)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.account_id from ambientes a where a.id = p_ambiente_id;
$$;

create or replace function get_checklist_periodo_ativo_publico(p_ambiente_id text)
returns table (id text, nome text, ambiente_id text, status text)
language sql stable security definer set search_path = public as $$
  select cp.id, cp.nome, cp.ambiente_id, cp.status
  from checklist_periodos cp
  where cp.ambiente_id = p_ambiente_id and cp.status = 'ativo'
  order by cp.started_at desc
  limit 1;
$$;

create or replace function list_checklist_items_publico(p_checklist_periodo_id text)
returns table (id text, task text, order_index integer, checklist_periodo_id text)
language sql stable security definer set search_path = public as $$
  select ci.id, ci.task, ci.order_index, ci.checklist_periodo_id
  from checklist_items ci
  where ci.checklist_periodo_id = p_checklist_periodo_id
  order by ci.order_index asc;
$$;

create or replace function list_ocorrencias_pendentes_publico(p_ambiente_id text)
returns table (
  id text, description text, photo text, status text, code text,
  reported_by_role text, reporter_name text, reporter_unidade text,
  related_checklist_item_id text, ambiente_id text
)
language sql stable security definer set search_path = public as $$
  select o.id, o.description, o.photo, o.status, o.code,
         o.reported_by_role, o.reporter_name, o.reporter_unidade,
         o.related_checklist_item_id, o.ambiente_id
  from ocorrencias o
  where o.ambiente_id = p_ambiente_id and o.status = 'pendente';
$$;

-- Deliberadamente SEM "photo" nem "items" (jsonb) — a tela pública de
-- status só usa created_at/completed_count/total_count da execução mais
-- recente; baixar a foto em base64 de centenas de KB só pra mostrar "há
-- quanto tempo" foi a última verificação inflava o payload à toa.
create or replace function get_ultima_execucao_publica(p_ambiente_id text)
returns table (id text, created_at timestamptz, completed_count integer, total_count integer, ambiente_id text)
language sql stable security definer set search_path = public as $$
  select e.id, e.created_at, e.completed_count, e.total_count, e.ambiente_id
  from execucoes e
  where e.ambiente_id = p_ambiente_id
  order by e.created_at desc
  limit 1;
$$;

grant execute on function get_ambiente_publico(text) to anon;
grant execute on function get_checklist_periodo_ativo_publico(text) to anon;
grant execute on function list_checklist_items_publico(text) to anon;
grant execute on function list_ocorrencias_pendentes_publico(text) to anon;
grant execute on function get_ultima_execucao_publica(text) to anon;

-- --- Escrita pública, com account_id derivado no servidor (nunca do
-- cliente) e validação de vínculo real entre as tabelas ---

-- "on conflict (id) do nothing" torna o insert idempotente por natureza:
-- reenviar o mesmo registro (retry de fila offline após queda de rede
-- no meio do envio) nunca cria duplicata nem lança erro — resolve, sem
-- precisar de tratamento especial no cliente, o mesmo problema que antes
-- dependia de checar o código de erro 23505 em offlineQueue.js.
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
returns table (id text, inserted boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid;
  v_new_id text;
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

  insert into execucoes (
    id, created_at, ambiente_id, checklist_periodo_id, account_id,
    executed_by, completed_count, total_count, items, photo, free_text_note
  ) values (
    p_id, coalesce(p_created_at, now()), p_ambiente_id, p_checklist_periodo_id, v_account_id,
    p_executed_by, coalesce(p_completed_count, 0), coalesce(p_total_count, 0), p_items, p_photo, p_free_text_note
  )
  on conflict (id) do nothing
  returning execucoes.id into v_new_id;

  return query select p_id, (v_new_id is not null);
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
returns table (id text, inserted boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid;
  v_related_id text;
  v_new_id text;
begin
  select a.account_id into v_account_id from ambientes a where a.id = p_ambiente_id;
  if v_account_id is null then
    raise exception 'Ambiente não encontrado.' using errcode = 'P0002';
  end if;

  -- Referência a um item de checklist que já não existe mais (apagado
  -- entre o colaborador abrir a tela e confirmar o envio, ou enfileirado
  -- offline por dias) não pode travar o envio — só solta a referência.
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
  returning ocorrencias.id into v_new_id;

  return query select p_id, (v_new_id is not null);
end;
$$;

-- Só marca como resolvida a ocorrência pedida, e só se ela pertencer ao
-- MESMO ambiente informado e ainda estiver pendente — equivalente ao que
-- o trigger protect_ocorrencia_public_update já impunha por coluna, mas
-- agora também restringe a LINHA (o using(true) antigo não restringia
-- nenhuma).
create or replace function resolve_ocorrencia_publica(p_ocorrencia_id text, p_ambiente_id text)
returns void
language sql security definer set search_path = public as $$
  update ocorrencias
  set status = 'resolvido'
  where id = p_ocorrencia_id and ambiente_id = p_ambiente_id and status = 'pendente';
$$;

grant execute on function insert_execucao_publica(text, text, text, text, integer, integer, jsonb, text, text, timestamptz) to anon;
grant execute on function insert_ocorrencia_publica(text, text, text, text, text, text, text, text, timestamptz) to anon;
grant execute on function resolve_ocorrencia_publica(text, text) to anon;

-- O trigger trg_protect_ocorrencia_public_update continua existindo e
-- rodando (BEFORE UPDATE dispara independente de RLS), mas
-- resolve_ocorrencia_publica só tenta mudar "status" mesmo — nenhuma
-- mudança de comportamento aí, só reforço.

-- ============================================================
-- PROBLEMA 3: RPCs de controle interno (rate limit) chamáveis por
-- qualquer anônimo — permitiam zerar buckets (desligar o limite de todo
-- mundo) ou criar um bucket já "estourado" pra travar uma conta alheia
-- ============================================================
-- Só as Edge Functions (via service role, que ignora GRANT/REVOKE)
-- deveriam chamar isso — nenhum client-side (anon nem authenticated)
-- tem motivo legítimo pra chamar check_rate_limit/cleanup_rate_limit_buckets
-- diretamente.
revoke execute on function check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function cleanup_rate_limit_buckets() from public, anon, authenticated;
