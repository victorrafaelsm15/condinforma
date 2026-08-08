-- Cond-Informa — visão administrativa unificada de Usuários (accounts +
-- sub_usuarios) pra conta "owner" (dona da plataforma).
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor do seu projeto Supabase.
-- Pré-requisito: owner_role_migration.sql, sub_usuarios_migration.sql e
-- assinantes_owner_view_migration.sql já devem ter rodado antes.
--
-- O que ele faz: adiciona policies NOVAS (não substitui as existentes) pra
-- accounts.role = 'owner' enxergar/gerenciar TODAS as linhas de accounts e
-- sub_usuarios/sub_usuario_condominios — hoje essas tabelas só permitem cada
-- conta ver a si mesma / seus próprios sub-usuários. Segue o mesmo padrão já
-- usado em assinantes_owner_view_migration.sql. Nomeadas com sufixo
-- "_platform_owner" pra não colidir com as policies "_owner_*" já
-- existentes (que lá significam "a conta principal dona do registro", não
-- o owner da plataforma).
--
-- IMPORTANTE: "quem está logado é owner?" usa uma function SECURITY
-- DEFINER (is_platform_owner()), nunca uma subquery inline em "accounts" —
-- uma policy em accounts que consulta accounts de novo entra em "infinite
-- recursion detected in policy for relation accounts" (já aconteceu numa
-- versão anterior deste arquivo — ver usuarios_admin_migration_fix.sql).
-- A function, sendo SECURITY DEFINER, ignora RLS por dentro e rompe o ciclo.

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

drop policy if exists "sub_usuarios_platform_owner_select" on sub_usuarios;
create policy "sub_usuarios_platform_owner_select" on sub_usuarios
  for select to authenticated
  using (is_platform_owner());

drop policy if exists "sub_usuarios_platform_owner_delete" on sub_usuarios;
create policy "sub_usuarios_platform_owner_delete" on sub_usuarios
  for delete to authenticated
  using (is_platform_owner());

drop policy if exists "sub_usuario_condominios_platform_owner_all" on sub_usuario_condominios;
create policy "sub_usuario_condominios_platform_owner_all" on sub_usuario_condominios
  for all to authenticated
  using (is_platform_owner())
  with check (is_platform_owner());

-- NÃO dar ao owner uma policy de SELECT geral em "condominios": o resto do
-- app (ex. AdminDashboard.jsx) consulta condominios SEM filtro nenhum,
-- confiando 100% no RLS pra trazer só os da própria conta — uma policy
-- ampla aqui vazaria os condomínios de TODOS os clientes pro dashboard
-- comum do owner. Em vez disso, functions SECURITY DEFINER bem restritas:
-- só devolvem id/nome (nada de account_id ou outros dados), só pros ids
-- (ou pra conta) pedidos, e só se quem chama for owner de fato.
create or replace function get_condominio_names_for_owner(ids text[])
returns table (id text, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name
  from condominios c
  where c.id = any(ids) and is_platform_owner();
$$;

-- Pra montar o multi-select de edição de permissões na aba global de
-- Sub-usuários: todos os condomínios de UMA conta específica (não de
-- todas), só id/nome, só pra quem é owner.
create or replace function get_account_condominios_for_owner(target_account_id uuid)
returns table (id text, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name
  from condominios c
  where c.account_id = target_account_id and is_platform_owner();
$$;

drop policy if exists "assinantes_platform_owner_delete" on assinantes;
create policy "assinantes_platform_owner_delete" on assinantes
  for delete to authenticated
  using (is_platform_owner());
