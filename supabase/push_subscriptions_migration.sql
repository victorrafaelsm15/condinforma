-- Cond-Informa — inscrições de notificação push (Web Push API nativa).
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor.
--
-- account_id aqui é sempre quem de fato se inscreveu no PRÓPRIO navegador
-- (pode ser o auth.uid() da conta principal OU de um sub-usuário — cada
-- pessoa tem seu próprio aparelho/inscrição) — diferente de audit_log, que
-- normaliza tudo pra conta principal. É por isso que notify-ocorrencia
-- precisa consultar tanto o account_id do dono do condomínio quanto os
-- auth_user_id dos sub-usuários autorizados nele, separadamente.
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_account_id_idx on push_subscriptions(account_id);

alter table push_subscriptions enable row level security;

-- Cada pessoa só enxerga/gerencia a própria inscrição — RLS é a única
-- barreira de segurança aqui (mesmo princípio do resto do projeto). Não
-- precisa de uma Edge Function própria pra salvar: o insert já é seguro
-- via RLS (account_id = auth.uid()), então o front grava direto.
create policy "push_subscriptions_owner_all" on push_subscriptions
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
