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
--
-- ATENÇÃO: esse bloco comentado ficou sem rodar em produção por um bom
-- tempo depois que account_id passou a fazer parte do "create table if
-- not exists" acima — como a tabela já existia de uma instalação
-- anterior, o "if not exists" não tinha efeito nenhum, e ninguém rodou
-- o ALTER TABLE manual. Resultado: TODO upsert em assinantes (feito por
-- subscribe/index.ts) falhava silenciosamente por causa da coluna
-- ausente, e a tabela ficou com 0 linhas — nenhuma assinatura real ficou
-- registrada aqui. Corrigido em 2026-08-14 via
-- supabase/assinantes_account_id_migration.sql. Lição: qualquer coluna
-- nova adicionada só dentro do "create table if not exists" também
-- precisa de um ALTER TABLE rodado de fato pra quem já tem a tabela —
-- não deixar como comentário "pra rodar se precisar".

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
