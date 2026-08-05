-- Cond-Informa — tabela de assinantes (integração de pagamento com Asaas)
-- Cole no SQL Editor do Supabase e rode uma vez.
--
-- Diferente das outras tabelas do projeto (schema.sql), aqui o RLS fica
-- LIGADO e sem nenhuma policy — isso bloqueia completamente o acesso pela
-- anon key (a que fica exposta no navegador). Só a service role key (usada
-- exclusivamente dentro das Edge Functions supabase/functions/subscribe e
-- supabase/functions/asaas-webhook, no servidor) consegue ler ou escrever
-- nesta tabela, porque a service role sempre ignora RLS. Dados de
-- assinatura/pagamento não devem ficar acessíveis pelo frontend.

create table if not exists assinantes (
  asaas_subscription_id  text primary key,
  asaas_customer_id      text not null,
  account_id             uuid references auth.users(id) on delete set null,
  name                   text,
  email                  text,
  plan_name              text,
  status                 text not null default 'pendente', -- pendente | ativo | inativo
  last_event             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists assinantes_customer_id_idx on assinantes(asaas_customer_id);
create index if not exists assinantes_account_id_idx on assinantes(account_id);

-- Se a tabela já existir de uma instalação anterior, roda isto pra adicionar
-- a coluna nova sem precisar recriar a tabela:
-- alter table assinantes add column if not exists account_id uuid references auth.users(id) on delete set null;
-- create index if not exists assinantes_account_id_idx on assinantes(account_id);

alter table assinantes enable row level security;
-- Nenhuma policy criada de propósito: com RLS ligado e sem policies, a anon
-- key não lê nem escreve nada aqui. A service role key sempre ignora RLS.
