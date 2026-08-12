-- Reformulação incremental do checklist (v2): período ganha código
-- digitado pelo gestor (reaproveita a coluna "nome" já existente, sem
-- migração de dado) + data de fim prevista opcional; item ganha foto da
-- execução e atribuição de quem está encarregado de resolver naquele
-- período (separado de quem de fato concluiu — resolvido_por).

alter table checklist_periodos add column if not exists data_fim_prevista date;

alter table checklist_items add column if not exists foto text;
alter table checklist_items add column if not exists atribuido_a text;
