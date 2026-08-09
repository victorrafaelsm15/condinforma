-- Cond-Informa — trilha de auditoria de ações administrativas.
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor.
-- Pré-requisito: sub_usuarios_migration.sql já deve ter rodado (usa a
-- tabela sub_usuarios pra saber se quem grava é sub-usuário da conta).
--
-- account_id é sempre a conta PRINCIPAL (nunca o sub-usuário) — é assim
-- que o dono da conta enxerga, num lugar só, tudo que aconteceu nela,
-- não importa se foi ele mesmo ou um sub-usuário autorizado quem agiu.
-- auth_user_id é sempre quem realizou a ação de fato.

create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id) on delete cascade,
  auth_user_id  uuid references auth.users(id) on delete set null,
  action        text not null,
  entity_type   text,
  entity_id     text,
  details       jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_account_id_idx on audit_log(account_id, created_at desc);

alter table audit_log enable row level security;

-- A conta principal lê o próprio histórico (não os sub-usuários — é uma
-- visão de "dono da conta", mesmo padrão de PlanoSection/SubUsuariosSection).
create policy "audit_log_owner_select" on audit_log
  for select to authenticated
  using (account_id = auth.uid());

-- Quem pode GRAVAR uma entrada pra uma conta: a própria conta principal,
-- um sub-usuário autorizado dela (agindo em nome da conta que o
-- convidou), ou o owner da plataforma (que gerencia sub-usuários de
-- QUALQUER conta pela aba global de Usuários — ver
-- usuarios_admin_migration.sql pro is_platform_owner()). Sem policy de
-- update/delete de propósito: log de auditoria não deve ser editável nem
-- apagável pelo cliente.
create policy "audit_log_insert" on audit_log
  for insert to authenticated
  with check (
    account_id = auth.uid()
    or exists (
      select 1 from sub_usuarios su
      where su.auth_user_id = auth.uid() and su.account_id = audit_log.account_id
    )
    or is_platform_owner()
  );
