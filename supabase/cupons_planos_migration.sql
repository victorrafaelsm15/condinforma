-- Cupom vinculado a plano(s) específico(s) — ex.: um cupom de boas-vindas
-- que só vale pro plano Start, ou uma promoção só pra Pro/Business.
-- null ou array vazio = vale pra qualquer plano (comportamento atual,
-- sem quebrar os cupons já cadastrados).
alter table cupons add column if not exists planos text[];
