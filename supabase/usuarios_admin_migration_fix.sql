-- Cond-Informa — CORREÇÃO da usuarios_admin_migration.sql
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor, DEPOIS de já ter
-- rodado usuarios_admin_migration.sql.
--
-- Bug: "accounts_platform_owner_select" e "accounts_platform_owner_update"
-- tinham, dentro da própria policy da tabela "accounts", uma subquery que
-- consulta "accounts" de novo — pra decidir se PODE mostrar uma linha, o
-- Postgres precisa primeiro avaliar essa subquery, que por sua vez também
-- está sujeita à RLS de "accounts" (incluindo a MESMA policy que está
-- sendo avaliada) → "infinite recursion detected in policy for relation
-- accounts", e a tabela accounts inteira parava de responder pra todo
-- mundo, inclusive a própria conta owner.
--
-- Correção: uma function SECURITY DEFINER (que ignora RLS por dentro,
-- rompendo o ciclo) decide "quem está logado é owner?" uma única vez, e as
-- policies passam a chamar essa function em vez de repetir a subquery.
-- Mesma técnica já usada em get_condominio_names_for_owner.

create or replace function is_platform_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = auth.uid() and role = 'owner');
$$;

drop policy if exists "accounts_platform_owner_select" on accounts;
create policy "accounts_platform_owner_select" on accounts
  for select to authenticated
  using (is_platform_owner());

drop policy if exists "accounts_platform_owner_update" on accounts;
create policy "accounts_platform_owner_update" on accounts
  for update to authenticated
  using (is_platform_owner())
  with check (is_platform_owner());

-- As de baixo não causavam recursão (são policies em OUTRAS tabelas, não em
-- "accounts"), mas trocadas pela function também, por consistência e pra
-- não repetir a mesma subquery em cinco lugares.
drop policy if exists "sub_usuarios_platform_owner_select" on sub_usuarios;
create policy "sub_usuarios_platform_owner_select" on sub_usuarios
  for select to authenticated using (is_platform_owner());

drop policy if exists "sub_usuarios_platform_owner_delete" on sub_usuarios;
create policy "sub_usuarios_platform_owner_delete" on sub_usuarios
  for delete to authenticated using (is_platform_owner());

drop policy if exists "sub_usuario_condominios_platform_owner_all" on sub_usuario_condominios;
create policy "sub_usuario_condominios_platform_owner_all" on sub_usuario_condominios
  for all to authenticated using (is_platform_owner()) with check (is_platform_owner());

drop policy if exists "assinantes_platform_owner_delete" on assinantes;
create policy "assinantes_platform_owner_delete" on assinantes
  for delete to authenticated using (is_platform_owner());
