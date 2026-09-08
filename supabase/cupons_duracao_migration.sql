-- Cond-Informa — cupom de desconto válido por N cobranças (não só a
-- primeira). Rode este arquivo INTEIRO, uma vez, no SQL Editor.
-- Pré-requisito: cupons_migration.sql (ou schema.sql) e assinantes.sql já
-- devem ter rodado antes.
--
-- duracao_cobrancas: quantas cobranças da assinatura recebem o desconto do
-- cupom. 1 (padrão) preserva o comportamento anterior — desconto só na
-- primeira cobrança, sem precisar de nenhum rastreamento extra. NULL =
-- desconto recorrente enquanto a assinatura existir (nunca "acaba"). Um
-- número N > 1 = desconto nas primeiras N cobranças; a partir da (N+1)ª a
-- assinatura volta sozinha ao valor cheio, porque a Asaas sempre gera a
-- cobrança no valor "template" da assinatura (nunca alterado) — não
-- precisamos "remover" nada, só parar de reaplicar o desconto.
alter table cupons add column if not exists duracao_cobrancas integer default 1
  check (duracao_cobrancas is null or duracao_cobrancas > 0);

-- Rastreia, por assinatura, um cupom com desconto em mais de uma cobrança.
-- Necessário porque a Asaas não tem um jeito nativo de "aplicar desconto só
-- nas primeiras N cobranças e depois parar sozinho" (o campo `discount`
-- nativo dela é condicional a pagamento antecipado e vale enquanto a
-- assinatura existir — não "expira" depois de N cobranças). Por isso o
-- desconto continua sendo aplicado manualmente, cobrança a cobrança, via
-- updatePaymentValue (ver supabase/functions/_shared/asaas.ts), e esta
-- tabela é quem diz ao webhook se ainda há desconto a aplicar na próxima
-- cobrança gerada.
--
-- tipo/valor são copiados da tabela cupons no momento da assinatura — se o
-- cupom for editado ou desativado depois, quem já assinou mantém as
-- condições que tinha quando assinou.
create table if not exists assinante_cupons (
  id                     uuid primary key default gen_random_uuid(),
  cupom_id               uuid not null references cupons(id) on delete cascade,
  asaas_subscription_id  text not null references assinantes(asaas_subscription_id) on delete cascade,
  account_id             uuid references auth.users(id) on delete set null,
  tipo                   text not null check (tipo in ('percentual', 'fixo')),
  valor                  numeric not null,
  primeiro_payment_id    text not null,
  cobrancas_restantes    integer, -- null = ilimitado (recorrente); decrementado a cada cobrança nova em que o desconto é aplicado
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (asaas_subscription_id)
);

create index if not exists assinante_cupons_cupom_id_idx on assinante_cupons(cupom_id);

-- Mesmo padrão de RLS de "assinantes" (ver assinantes.sql): RLS ligado, sem
-- policy de escrita pra ninguém além da service role (que ignora RLS,
-- usada só dentro das Edge Functions subscribe e asaas-webhook). Owner da
-- plataforma pode LER, pra ter visibilidade no painel administrativo de
-- quem está com desconto recorrente ativo.
alter table assinante_cupons enable row level security;

create policy "assinante_cupons_owner_select" on assinante_cupons
  for select
  to authenticated
  using (
    exists (
      select 1 from accounts a where a.id = auth.uid() and a.role = 'owner'
    )
  );
