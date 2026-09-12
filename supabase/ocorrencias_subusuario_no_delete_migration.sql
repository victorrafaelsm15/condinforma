-- Cond-Informa — sub-usuário não deve conseguir excluir ocorrências.
-- A UI já esconde o botão de excluir pra sub-usuário
-- (OcorrenciaDetailPage.jsx: "{!isSubUsuario && (<botão excluir>)}"), mas
-- a policy de RLS "ocorrencias_subusuario_all" era "for all" — incluía
-- DELETE mesmo assim, então bastava chamar a API direto (sem passar pela
-- UI) pra apagar. Rode este arquivo inteiro, uma vez, no SQL Editor.

drop policy if exists "ocorrencias_subusuario_all" on ocorrencias;

create policy "ocorrencias_subusuario_select" on ocorrencias
  for select to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id));

create policy "ocorrencias_subusuario_insert" on ocorrencias
  for insert to authenticated
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

create policy "ocorrencias_subusuario_update" on ocorrencias
  for update to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

-- Sem policy de DELETE pra sub-usuário — só "ocorrencias_owner_all" (a
-- conta principal) continua podendo excluir.
