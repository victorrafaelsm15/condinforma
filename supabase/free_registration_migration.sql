-- Cond-Informa — registro livre + ocorrência pelo morador
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor do seu projeto Supabase.
-- Pré-requisito: supabase/multitenant_migration.sql já deve ter rodado antes.
--
-- O que ele faz:
--   1. execucoes.free_text_note — observação livre do colaborador, usada
--      quando a execução não corresponde (ou não depende) de nenhuma
--      tarefa marcada do checklist.
--   2. ocorrencias.reported_by_role — 'colaborador' | 'morador', pra
--      diferenciar a origem no painel administrativo.
--   3. ocorrencias.reporter_name — nome/unidade opcional de quem reportou
--      (usado principalmente pelo morador, que não faz login).
--
-- Não precisa mexer em RLS: as políticas de INSERT já existentes (owner
-- via account_id, e anon público em execucoes/ocorrencias) não restringem
-- por coluna — colunas novas e nullable já ficam cobertas automaticamente.

alter table execucoes add column if not exists free_text_note text;

alter table ocorrencias add column if not exists reported_by_role text;
alter table ocorrencias add column if not exists reporter_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ocorrencias_reported_by_role_check'
  ) then
    alter table ocorrencias add constraint ocorrencias_reported_by_role_check
      check (reported_by_role is null or reported_by_role in ('colaborador', 'morador'));
  end if;
end $$;
