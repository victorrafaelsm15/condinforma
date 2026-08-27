-- Reversão do Pix Automático: volta pro Pix normal (cobrança avulsa mensal
-- via assinatura clássica da Asaas, mesmo padrão de Boleto/Cartão) — ver
-- supabase/functions/subscribe/index.ts. O Pix Automático (ver
-- pix_automatico_migration.sql) nunca chegou a funcionar em produção: a
-- criação da autorização falhava sempre (startDate = hoje, rejeitado pela
-- Asaas — corrigido depois, mas a decisão de produto foi voltar pro Pix
-- normal de qualquer forma), e nenhum assinante chegou a ter uma
-- autorização ACTIVATED (confirmado por query em produção antes desta
-- reversão: zero linhas em assinantes com pix_automatic_authorization_id
-- preenchido) — não havia ninguém pra migrar.
--
-- Desagenda o cron que criava as cobranças recorrentes (mês 2+) do Pix
-- Automático — a função pix-automatic-billing foi removida do projeto
-- (supabase/functions/pix-automatic-billing/) e undeployed da Supabase.
select cron.unschedule('cond-informa-pix-automatic-billing');

-- Colunas pix_automatic_authorization_id / pix_automatic_status /
-- next_pix_charge_due_date (assinantes) foram deixadas na tabela — ficam
-- nulas e inofensivas pra sempre, e um DROP COLUMN não traz benefício real
-- nenhum pra uma feature que nunca teve uso, então não vale o risco.
