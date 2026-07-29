-- Cond-Informa — schema do Supabase
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e rode uma vez.
--
-- Observação sobre segurança: o app usa a "anon key" (pública, fica no bundle do
-- navegador) e um login local simples (não é Supabase Auth) — por isso o RLS
-- (Row Level Security) é mantido DESLIGADO aqui, senão nada funcionaria. Isso
-- significa que qualquer pessoa com a anon key consegue ler/gravar essas tabelas
-- diretamente pela API do Supabase. Para uma operação real (não só demonstração),
-- o ideal é depois migrar o login para Supabase Auth e adicionar políticas de RLS.

create table if not exists condominios (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists ambientes (
  id             text primary key,
  condominio_id  text not null references condominios(id) on delete cascade,
  name           text not null,
  created_at     timestamptz not null default now()
);
create index if not exists ambientes_condominio_id_idx on ambientes(condominio_id);

create table if not exists checklist_items (
  id           text primary key,
  ambiente_id  text not null references ambientes(id) on delete cascade,
  task         text not null,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists checklist_items_ambiente_id_idx on checklist_items(ambiente_id);

create table if not exists execucoes (
  id               text primary key,
  ambiente_id      text not null references ambientes(id) on delete cascade,
  executed_by      text,
  completed_count  integer not null default 0,
  total_count      integer not null default 0,
  items            jsonb,
  photo            text,
  created_at       timestamptz not null default now()
);
create index if not exists execucoes_ambiente_id_idx on execucoes(ambiente_id);

create table if not exists ocorrencias (
  id           text primary key,
  ambiente_id  text not null references ambientes(id) on delete cascade,
  description  text not null,
  photo        text,
  status       text not null default 'pendente',
  created_at   timestamptz not null default now()
);
create index if not exists ocorrencias_ambiente_id_idx on ocorrencias(ambiente_id);

-- RLS desligado de propósito (veja observação no topo do arquivo).
alter table condominios      disable row level security;
alter table ambientes        disable row level security;
alter table checklist_items  disable row level security;
alter table execucoes        disable row level security;
alter table ocorrencias      disable row level security;
