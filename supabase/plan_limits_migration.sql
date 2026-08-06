-- Cond-Informa — limites de uso por plano (Start/Pro/Business)
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor do seu projeto Supabase.
-- Pré-requisito: supabase/multitenant_migration.sql já deve ter rodado antes
-- (precisa da coluna account_id em condominios).
--
-- O que ele faz, em ordem:
--   1. Cria a tabela "accounts" (1 linha por usuário, com plano/limite/status).
--   2. Trigger em auth.users: toda conta nova criada pelo signup já ganha
--      uma linha em "accounts" com status 'trial' e limite 0.
--   3. RLS em "accounts": cada usuário só lê a própria linha; só as Edge
--      Functions (service role) conseguem escrever nela.
--   4. Trigger em condominios: bloqueia o INSERT no banco (não só na UI) se
--      a conta não estiver 'ativo' ou já tiver atingido o limite do plano.

-- ============================================================
-- 1. Tabela accounts
-- ============================================================
create table if not exists accounts (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  plan_name          text,                              -- 'start' | 'pro' | 'business' | null
  condominio_limit   integer not null default 0,
  status             text not null default 'trial',      -- 'trial' | 'ativo' | 'inativo'
  asaas_customer_id  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Backfill: qualquer auth.users que já exista hoje (ex.: sua própria conta,
-- criada antes desta migração) e ainda não tenha linha em accounts.
insert into accounts (id, email, status, condominio_limit)
select u.id, u.email, 'trial', 0
from auth.users u
left join accounts a on a.id = u.id
where a.id is null;

-- ============================================================
-- 2. Trigger: nova conta em auth.users -> linha automática em accounts
-- ============================================================
create or replace function handle_new_user_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id, email, status, condominio_limit)
  values (new.id, new.email, 'trial', 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function handle_new_user_account();

-- ============================================================
-- 3. RLS em accounts — só leitura da própria linha; escrita só via
--    service role (Edge Functions subscribe/asaas-webhook, que ignoram RLS)
-- ============================================================
alter table accounts enable row level security;

create policy "accounts_select_own" on accounts
  for select
  to authenticated
  using (id = auth.uid());

-- ============================================================
-- 4. Trigger: bloqueia INSERT em condominios acima do limite do plano
-- ============================================================
create or replace function check_condominio_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_limit  integer;
  v_count  integer;
begin
  select status, condominio_limit into v_status, v_limit
  from accounts
  where id = new.account_id;

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

drop trigger if exists trg_check_condominio_limit on condominios;
create trigger trg_check_condominio_limit
  before insert on condominios
  for each row execute function check_condominio_limit();

-- ============================================================
-- Nota: se uma conta for rebaixada de plano (ex.: Business -> Start) e
-- ficar com mais condomínios do que o novo limite permite, os condomínios
-- que já existem continuam visíveis e utilizáveis normalmente — o trigger
-- acima só bloqueia a CRIAÇÃO de novos enquanto a contagem estiver >= ao
-- limite. Esse é o comportamento padrão de mercado (não há remoção
-- automática de dados por causa de downgrade).
-- ============================================================

-- ============================================================
-- Opcional: pra testar sem passar pelo pagamento de verdade, ative sua
-- própria conta manualmente rodando (troque o e-mail):
--
-- update accounts set status = 'ativo', plan_name = 'business', condominio_limit = 10
-- where email = 'seu-email@aqui.com';
-- ============================================================
