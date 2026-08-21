-- Migração de Pix (cobrança avulsa mensal) para Pix Automático (autorização
-- de débito recorrente) nas assinaturas via Pix. Ver subscribe/index.ts,
-- asaas-webhook/index.ts e a nova função pix-automatic-billing.
--
-- LIÇÃO já registrada em supabase/assinantes.sql: coluna nova só dentro do
-- "create table if not exists" NÃO chega em quem já tem a tabela — por
-- isso as colunas abaixo vêm como ALTER TABLE de verdade, pra rodar contra
-- o banco já existente (não só documentado como comentário).

alter table assinantes add column if not exists pix_automatic_authorization_id text;
alter table assinantes add column if not exists pix_automatic_status text; -- CREATED | ACTIVE | CANCELLED | EXPIRED | REFUSED
alter table assinantes add column if not exists next_pix_charge_due_date date;

create index if not exists assinantes_pix_automatic_authorization_id_idx
  on assinantes(pix_automatic_authorization_id);

-- Cobranças do mês 2 em diante não são criadas pela Asaas sozinha
-- (paymentCreationMode: 'MANUAL' na autorização, ver createPixAutomaticAuthorization
-- em _shared/asaas.ts) — é a função pix-automatic-billing, agendada abaixo,
-- que cria cada uma na janela de 2 a 10 dias úteis antes do vencimento
-- exigida pela Asaas. Roda 1x por dia, junto com as outras rotinas
-- agendadas do projeto (ver retention_migration.sql).
--
-- Troque a URL do projeto e o CRON_SECRET abaixo pelos valores reais antes
-- de rodar (mesmo secret já configurado nas outras funções agendadas).
select cron.schedule(
  'cond-informa-pix-automatic-billing',
  '27 6 * * *', -- todo dia às 06:27 UTC (~03:27 horário de Brasília)
  $$
  select net.http_post(
    url := 'https://vhpljzykqheinydvfntd.supabase.co/functions/v1/pix-automatic-billing',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'COLOQUE_AQUI_O_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
