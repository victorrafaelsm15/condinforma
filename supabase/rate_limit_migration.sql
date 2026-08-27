-- Rate limit centralizado pras Edge Functions públicas mais expostas
-- (subscribe, support-chat, create-sub-usuario, notify-ocorrencia — ver
-- supabase/functions/_shared/rateLimit.ts). Edge Functions são stateless,
-- então o contador precisa morar em algum lugar compartilhado — aqui, uma
-- janela fixa (fixed window) por chave, guardada nesta tabela e incrementada
-- de forma atômica por uma função de banco (evita race condition de duas
-- requisições simultâneas lendo a mesma contagem antes de gravar).
create table if not exists rate_limit_buckets (
  bucket_key   text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

-- Só as Edge Functions (via SUPABASE_SERVICE_ROLE_KEY, que já ignora RLS)
-- mexem nessa tabela — RLS habilitada e sem nenhuma policy é o padrão já
-- usado neste projeto pra tabela "só backend" (ver audit_log em schema.sql).
alter table rate_limit_buckets enable row level security;

-- Upsert atômico: uma única instrução, o UPDATE do ON CONFLICT roda sob o
-- lock de linha do Postgres, então duas requisições concorrentes pra mesma
-- chave nunca contam a mesma janela duas vezes. Se a janela já expirou,
-- reinicia (count = 1); senão, incrementa. Devolve true (permitido) quando
-- a contagem resultante ainda está dentro do limite.
create or replace function check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into rate_limit_buckets (bucket_key, window_start, count)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update set
    count = case
      when rate_limit_buckets.window_start < now() - make_interval(secs => p_window_seconds)
        then 1
      else rate_limit_buckets.count + 1
    end,
    window_start = case
      when rate_limit_buckets.window_start < now() - make_interval(secs => p_window_seconds)
        then now()
      else rate_limit_buckets.window_start
    end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

-- Limpeza: sem isso a tabela cresce pra sempre (1 linha por IP/conta que já
-- bateu numa rota limitada). Reaproveita o cron diário que já existe pra
-- outras faxinas de retenção (ver data-retention-sweep) — chamado de lá
-- via RPC, não precisa de agendamento próprio.
create or replace function cleanup_rate_limit_buckets()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rate_limit_buckets where window_start < now() - interval '1 day';
$$;
