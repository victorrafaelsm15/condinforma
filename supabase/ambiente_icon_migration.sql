-- Cond-Informa — campo de ícone escolhível por ambiente (ver seletor em
-- AmbientePage.jsx). Rode este arquivo INTEIRO, uma vez, no SQL Editor.
--
-- Guarda o NOME do ícone lucide-react (ex: "Bath", "Dumbbell"), não um
-- valor traduzido — o front-end mapeia esse nome pro componente real via
-- src/lib/ambienteIcons.js. Nullable: sem ícone escolhido, a UI usa o
-- ícone genérico (DoorOpen) como fallback, sem precisar de nenhum
-- backfill aqui.
alter table ambientes add column if not exists icon text;
