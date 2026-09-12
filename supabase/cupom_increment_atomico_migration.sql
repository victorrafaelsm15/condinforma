-- Cond-Informa — incremento atômico de cupons.usos. Rode uma vez no SQL
-- Editor.
--
-- incrementCouponUsage() (cupons.ts) fazia "select usos" e depois "update
-- usos = lido + 1" em duas chamadas separadas — duas assinaturas com o
-- mesmo cupom, quase ao mesmo tempo, liam o mesmo valor e as duas
-- gravavam "+1" a partir dele: o contador subia só 1, não 2, furando
-- limite_usos silenciosamente. Um "update ... set usos = usos + 1" feito
-- num único statement é atômico no Postgres (a linha fica bloqueada até o
-- update terminar), sem precisar de nenhum lock explícito.
create or replace function increment_cupom_usos(p_cupom_id uuid)
returns void
language sql security definer set search_path = public as $$
  update cupons set usos = usos + 1 where id = p_cupom_id;
$$;
