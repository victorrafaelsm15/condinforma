-- Cond-Informa — visão de assinantes pra conta owner
-- Rode este arquivo INTEIRO, uma vez, no SQL Editor do seu projeto Supabase.
-- Pré-requisito: supabase/assinantes.sql e supabase/owner_role_migration.sql
-- já devem ter rodado antes (precisa de accounts.role).
--
-- O que ele faz:
--   1. Adiciona phone/cpf_cnpj em "assinantes" — já são coletados no
--      formulário de assinatura e enviados ao Asaas, mas não ficavam
--      salvos aqui; agora completam o registro local do assinante.
--   2. Política de SELECT: contas com role = 'owner' passam a enxergar
--      TODAS as linhas de "assinantes" (de qualquer cliente/conta) — é a
--      única tabela onde isso faz sentido, já que o dono da plataforma
--      precisa ver quem assinou, diferente do isolamento por account_id
--      usado no resto do app.

alter table assinantes add column if not exists phone text;
alter table assinantes add column if not exists cpf_cnpj text;

drop policy if exists "assinantes_owner_select" on assinantes;
create policy "assinantes_owner_select" on assinantes
  for select
  to authenticated
  using (
    exists (
      select 1 from accounts a where a.id = auth.uid() and a.role = 'owner'
    )
  );
