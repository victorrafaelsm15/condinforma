-- Cond-Informa — tabela de assinantes (integração de pagamento com Asaas)
-- Cole no SQL Editor do Supabase e rode uma vez.
--
-- Diferente das outras tabelas do projeto (schema.sql), aqui o RLS fica
-- LIGADO e, por padrão, sem policy pra anon/authenticated comum — só a
-- service role key (usada exclusivamente dentro das Edge Functions
-- supabase/functions/subscribe e supabase/functions/asaas-webhook, no
-- servidor) consegue escrever nesta tabela, porque a service role sempre
-- ignora RLS. A ÚNICA exceção é leitura: contas com role = 'owner' (ver
-- supabase/owner_role_migration.sql) enxergam todas as linhas, pra dar
-- visibilidade de quem assinou dentro do próprio painel administrativo.

create table if not exists assinantes (
  asaas_subscription_id  text primary key,
  asaas_customer_id      text not null,
  account_id             uuid references auth.users(id) on delete set null,
  name                   text,
  email                  text,
  phone                  text,
  cpf_cnpj               text,
  plan_name              text,
  status                 text not null default 'pendente', -- pendente | ativo | inativo
  last_event             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists assinantes_customer_id_idx on assinantes(asaas_customer_id);
create index if not exists assinantes_account_id_idx on assinantes(account_id);

-- Se a tabela já existir de uma instalação anterior, roda isto pra adicionar
-- as colunas novas sem precisar recriar a tabela:
-- alter table assinantes add column if not exists account_id uuid references auth.users(id) on delete set null;
-- alter table assinantes add column if not exists phone text;
-- alter table assinantes add column if not exists cpf_cnpj text;
-- create index if not exists assinantes_account_id_idx on assinantes(account_id);

alter table assinantes enable row level security;

-- Contas "owner" (dono da plataforma) podem ver todos os assinantes —
-- é a única tabela com visibilidade global, propositalmente: as outras
-- seguem isoladas por account_id.
create policy "assinantes_owner_select" on assinantes
  for select
  to authenticated
  using (
    exists (
      select 1 from accounts a where a.id = auth.uid() and a.role = 'owner'
    )
  );
