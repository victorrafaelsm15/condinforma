-- Corrige um bug de deploy encontrado ao investigar o erro genérico de
-- assinatura com cupom: supabase/assinantes.sql sempre teve account_id
-- na definição de "create table if not exists" (linha 16), mas como a
-- tabela assinantes já existia de uma instalação anterior, esse create
-- não tinha efeito — e a linha que de fato adicionaria a coluna numa
-- tabela já existente ficou COMENTADA (pra "copiar e rodar manualmente
-- se precisar"), e nunca foi executada de verdade.
--
-- Resultado: subscribe/index.ts sempre tentou gravar account_id no
-- upsert de "assinantes", e como a coluna não existia, TODO upsert
-- falhava silenciosamente (o código só loga o erro e segue o fluxo do
-- cliente de propósito, pra não travar o pagamento por causa disso — ver
-- comentário "Não bloqueia o fluxo do cliente por causa disso"). A
-- tabela assinantes está com 0 linhas em produção agora, confirmando que
-- isso nunca funcionou desde que esse campo foi adicionado ao payload.

alter table assinantes add column if not exists account_id uuid references auth.users(id) on delete set null;
create index if not exists assinantes_account_id_idx on assinantes(account_id);
