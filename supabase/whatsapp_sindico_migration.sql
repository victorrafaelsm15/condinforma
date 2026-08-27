-- Botão "Falar diretamente com o síndico" nas páginas públicas de QR Code
-- (ExecutarChecklistPage.jsx / StatusPublicoPage.jsx) — precisa do WhatsApp
-- do síndico, informado no cadastro (AdminSignup.jsx) e editável depois em
-- Segurança (SegurancaPage.jsx).
alter table accounts add column if not exists whatsapp_phone text;

-- handle_new_user_account() (schema.sql) só conhecia id/email/status/
-- condominio_limit — passa a gravar também o whatsapp_phone informado no
-- cadastro, vindo do user_metadata do Supabase Auth (não é coluna nativa de
-- auth.users, então só chega via raw_user_meta_data; ver signUp() em
-- authService.js, que agora envia options.data.whatsapp_phone).
create or replace function handle_new_user_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts (id, email, status, condominio_limit, whatsapp_phone)
  values (new.id, new.email, 'trial', 0, new.raw_user_meta_data ->> 'whatsapp_phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- accounts não tem (nem deveria ter) select público — só o dono enxerga a
-- própria linha (accounts_select_own). Visitante anônimo do QR Code (sem
-- login) precisa só do WhatsApp, nunca do resto da conta (plano, e-mail,
-- customer id da Asaas etc.) — função security definer que devolve só esse
-- um campo, dado o ambiente, é o jeito de expor o mínimo necessário sem
-- abrir uma policy de leitura pública na tabela inteira.
create or replace function get_sindico_whatsapp(p_ambiente_id text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select a.whatsapp_phone
  from ambientes amb
  join accounts a on a.id = amb.account_id
  where amb.id = p_ambiente_id;
$$;

grant execute on function get_sindico_whatsapp(text) to anon, authenticated;
