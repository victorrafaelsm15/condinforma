-- Cupons de desconto aplicáveis no fluxo de assinatura (ver
-- supabase/functions/subscribe/index.ts). A validação e o desconto são
-- calculados inteiramente no servidor (Edge Function, service role) — nunca
-- confiar em valor/percentual vindos do cliente.
--
-- Sem policy de RLS nenhuma proposital: nem anon nem authenticated devem
-- conseguir listar/ler cupons direto pelo client (evita enumerar códigos
-- válidos). Só a service role (que ignora RLS) consegue consultar — e é
-- exatamente o que a Edge Function usa.
--
-- Cadastro de cupom é manual por enquanto (direto no banco), por exemplo:
--   insert into cupons (codigo, tipo, valor, validade, limite_usos)
--   values ('BEMVINDO20', 'percentual', 20, '2026-12-31', 100);

create table if not exists cupons (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  tipo         text not null check (tipo in ('percentual', 'fixo')),
  valor        numeric not null check (valor > 0),
  validade     date,
  limite_usos  integer check (limite_usos is null or limite_usos > 0),
  usos         integer not null default 0,
  ativo        boolean not null default true,
  -- Planos em que o cupom pode ser usado (ex.: {Start,Pro}) — null ou
  -- array vazio vale pra qualquer plano. Ver cupons_planos_migration.sql.
  planos       text[],
  created_at   timestamptz not null default now()
);
create unique index if not exists cupons_codigo_upper_idx on cupons (upper(codigo));

alter table cupons enable row level security;
