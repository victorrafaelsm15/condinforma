-- Cond-Informa — sistema de sub-usuários por conta
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor do seu projeto Supabase.
-- Pré-requisito: plan_limits_migration.sql e owner_role_migration.sql já
-- devem ter rodado antes (precisa de accounts.role/condominio_limit).
--
-- O que ele faz, em ordem:
--   1. accounts.sub_usuario_limit — igual ao condominio_limit, mas pra
--      quantos sub-usuários a conta pode ter.
--   2. Tabela sub_usuarios — cada linha é um sub-usuário: quem é o login
--      dele (auth_user_id) e de qual conta principal ele é dependente
--      (account_id, quem criou e paga o plano).
--   3. Tabela sub_usuario_condominios — relação N:N: pra quais
--      condomínios específicos aquele sub-usuário tem acesso.
--   4. Funções helper (SECURITY DEFINER) reutilizadas nas políticas de RLS
--      das tabelas principais, pra checar "esse usuário logado é um
--      sub-usuário com acesso a este condomínio/ambiente?".
--   5. RLS em sub_usuarios/sub_usuario_condominios: só a conta principal
--      gerencia (CRUD completo); o próprio sub-usuário só lê a própria
--      linha (pra o app saber "eu sou sub-usuário, de qual conta, com
--      acesso a quais condomínios").
--   6. Trigger BEFORE INSERT em sub_usuarios: bloqueia acima do
--      sub_usuario_limit do plano, mesmo padrão do check_condominio_limit
--      (contas 'owner' ficam isentas).
--   7. Políticas NOVAS (adicionais às que já existem) em condominios,
--      ambientes, checklist_items, execucoes e ocorrencias, liberando
--      acesso quando o usuário logado for um sub-usuário autorizado
--      naquele condomínio — sem tirar nem substituir nada que já existia
--      pro dono da conta.

-- ============================================================
-- 1. Limite de sub-usuários
-- ============================================================
alter table accounts add column if not exists sub_usuario_limit integer not null default 0;

-- gen_random_uuid() (usado no id de sub_usuarios) vem da extensão pgcrypto —
-- no Supabase ela já costuma estar habilitada, mas garante aqui também.
create extension if not exists pgcrypto;

-- ============================================================
-- 2 e 3. Tabelas
-- ============================================================
create table if not exists sub_usuarios (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id) on delete cascade,
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null,
  created_at    timestamptz not null default now()
);
create index if not exists sub_usuarios_account_id_idx on sub_usuarios(account_id);

create table if not exists sub_usuario_condominios (
  sub_usuario_id  uuid not null references sub_usuarios(id) on delete cascade,
  condominio_id   text not null references condominios(id) on delete cascade,
  primary key (sub_usuario_id, condominio_id)
);
create index if not exists sub_usuario_condominios_condominio_id_idx on sub_usuario_condominios(condominio_id);

-- ============================================================
-- 4. Funções helper (SECURITY DEFINER — leem sub_usuarios/sub_usuario_
--    condominios independente do RLS de quem está chamando)
-- ============================================================

-- O usuário logado é um sub-usuário com acesso a este condomínio?
create or replace function has_subusuario_access(target_condominio_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from sub_usuarios su
    join sub_usuario_condominios suc on suc.sub_usuario_id = su.id
    where su.auth_user_id = auth.uid()
      and suc.condominio_id = target_condominio_id
  );
$$;

-- Mesma checagem, mas a partir de um ambiente (deriva o condomínio dele).
create or replace function has_subusuario_access_via_ambiente(target_ambiente_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from ambientes a
    join sub_usuarios su on su.auth_user_id = auth.uid()
    join sub_usuario_condominios suc
      on suc.sub_usuario_id = su.id and suc.condominio_id = a.condominio_id
    where a.id = target_ambiente_id
  );
$$;

-- account_id dono de um condomínio (pra validar que o sub-usuário só grava
-- registros com o account_id CORRETO — o da conta principal, nunca o dele).
create or replace function condominio_owner_account(target_condominio_id text)
returns uuid
language sql stable security definer set search_path = public as $$
  select account_id from condominios where id = target_condominio_id;
$$;

-- account_id dono de um ambiente, via condomínio dele.
create or replace function ambiente_owner_account(target_ambiente_id text)
returns uuid
language sql stable security definer set search_path = public as $$
  select c.account_id
  from ambientes a
  join condominios c on c.id = a.condominio_id
  where a.id = target_ambiente_id;
$$;

-- ============================================================
-- 5. RLS em sub_usuarios / sub_usuario_condominios
-- ============================================================
alter table sub_usuarios enable row level security;
alter table sub_usuario_condominios enable row level security;

-- Conta principal: CRUD completo dos próprios sub-usuários.
create policy "sub_usuarios_owner_all" on sub_usuarios
  for all to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- O próprio sub-usuário só LÊ a própria linha (pra saber que é sub-usuário,
-- de qual conta, e esconder a gestão de sub-usuários/plano no app).
create policy "sub_usuarios_self_select" on sub_usuarios
  for select to authenticated
  using (auth_user_id = auth.uid());

-- Conta principal: CRUD completo das permissões de condomínio dos próprios
-- sub-usuários (via join em sub_usuarios pra confirmar que é dono).
create policy "sub_usuario_condominios_owner_all" on sub_usuario_condominios
  for all to authenticated
  using (exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.account_id = auth.uid()))
  with check (exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.account_id = auth.uid()));

-- O próprio sub-usuário lê quais condomínios tem liberado.
create policy "sub_usuario_condominios_self_select" on sub_usuario_condominios
  for select to authenticated
  using (exists (select 1 from sub_usuarios su where su.id = sub_usuario_id and su.auth_user_id = auth.uid()));

-- ============================================================
-- 6. Trigger de limite de sub-usuários (mesmo padrão de condominios)
-- ============================================================
create or replace function check_subusuario_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_limit integer;
  v_count integer;
begin
  select role, sub_usuario_limit into v_role, v_limit from accounts where id = new.account_id;

  if v_role = 'owner' then
    return new;
  end if;

  select count(*) into v_count from sub_usuarios where account_id = new.account_id;

  if v_count >= coalesce(v_limit, 0) then
    raise exception 'Limite de % sub-usuário(s) do seu plano atingido. Faça upgrade para adicionar mais.', coalesce(v_limit, 0)
      using errcode = 'CI001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_subusuario_limit on sub_usuarios;
create trigger trg_check_subusuario_limit
  before insert on sub_usuarios
  for each row execute function check_subusuario_limit();

-- ============================================================
-- 7. Políticas adicionais nas tabelas principais, pra sub-usuários
-- ============================================================
-- condominios: sub-usuário só ENXERGA os liberados (não cria/exclui —
-- isso fica só com a conta principal, que é quem paga pelo condominio_limit).
create policy "condominios_subusuario_select" on condominios
  for select to authenticated
  using (has_subusuario_access(id));

-- ambientes: sub-usuário tem CRUD completo dentro dos condomínios liberados.
create policy "ambientes_subusuario_all" on ambientes
  for all to authenticated
  using (has_subusuario_access(condominio_id))
  with check (has_subusuario_access(condominio_id) and account_id = condominio_owner_account(condominio_id));

-- checklist_items: idem, via ambiente.
create policy "checklist_items_subusuario_all" on checklist_items
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

-- execucoes: idem (além do INSERT público já existente pro colaborador
-- sem login via QR Code).
create policy "execucoes_subusuario_all" on execucoes
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));

-- ocorrencias: idem.
create policy "ocorrencias_subusuario_all" on ocorrencias
  for all to authenticated
  using (has_subusuario_access_via_ambiente(ambiente_id))
  with check (has_subusuario_access_via_ambiente(ambiente_id) and account_id = ambiente_owner_account(ambiente_id));
