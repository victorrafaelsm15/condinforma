-- Cond-Informa — gerenciamento de cupons pela conta "owner" (aba Cupons em
-- Usuários). Rode este arquivo INTEIRO, uma vez, no SQL Editor.
-- Pré-requisito: cupons_migration.sql (ou schema.sql já com a tabela
-- cupons) e usuarios_admin_migration.sql (ou o fix, que cria
-- is_platform_owner()) já devem ter rodado antes.
--
-- Hoje "cupons" não tem NENHUMA policy (só a service role, dentro da Edge
-- Function subscribe, consegue ler/validar cupons — de propósito, pra não
-- vazar códigos válidos por consulta direta do client). Isso também
-- bloqueia o próprio owner de gerenciar cupons pelo painel. Adiciona uma
-- policy só pra quem é owner de verdade, via is_platform_owner() (mesma
-- function seguraque já existe, sem repetir a subquery em accounts).

create policy "cupons_platform_owner_all" on cupons
  for all to authenticated
  using (is_platform_owner())
  with check (is_platform_owner());
