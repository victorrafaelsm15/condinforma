-- Cond-Informa — conta "owner" (dono da plataforma), isenta do limite de plano
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor do seu projeto Supabase.
-- Pré-requisito: supabase/plan_limits_migration.sql já deve ter rodado antes
-- (precisa da tabela accounts e do trigger check_condominio_limit).
--
-- O que ele faz, em ordem:
--   1. Adiciona a coluna "role" em accounts ('customer' | 'owner').
--   2. Reescreve o trigger de limite de condomínios pra pular a checagem
--      inteira (status e limite) quando role = 'owner'.
--   3. Não mexe em RLS — accounts já não tem NENHUMA policy de insert/
--      update/delete pra authenticated/anon, só leitura da própria linha
--      (accounts_select_own). Ou seja, nenhum usuário consegue alterar a
--      própria role pelo app; só quem tem a service role key (Edge
--      Functions, ou você rodando SQL direto) consegue escrever aqui.

-- ============================================================
-- 1. Coluna role
-- ============================================================
alter table accounts add column if not exists role text not null default 'customer';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_role_check'
  ) then
    alter table accounts add constraint accounts_role_check check (role in ('customer', 'owner'));
  end if;
end $$;

-- ============================================================
-- 2. Trigger de limite: contas 'owner' ficam isentas (status e limite)
-- ============================================================
create or replace function check_condominio_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text;
  v_status text;
  v_limit  integer;
  v_count  integer;
begin
  select role, status, condominio_limit into v_role, v_status, v_limit
  from accounts
  where id = new.account_id;

  -- Conta dona da plataforma: acesso ilimitado, sem depender de assinatura.
  if v_role = 'owner' then
    return new;
  end if;

  if v_status is null or v_status <> 'ativo' then
    raise exception 'Sua assinatura não está ativa. Assine um plano para cadastrar condomínios.'
      using errcode = 'CI001';
  end if;

  select count(*) into v_count from condominios where account_id = new.account_id;

  if v_count >= v_limit then
    raise exception 'Limite de % condomínio(s) do seu plano atingido. Faça upgrade para cadastrar mais.', v_limit
      using errcode = 'CI001';
  end if;

  return new;
end;
$$;
-- O trigger trg_check_condominio_limit em condominios já existe e aponta
-- pra essa função (criado em plan_limits_migration.sql) — só recriar a
-- função, como acima, já é suficiente. Não precisa recriar o trigger.
