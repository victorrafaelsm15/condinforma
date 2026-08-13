-- Reformulação da área de Ocorrências: código legível (ocorrencias.code)
-- já existe desde ids_and_checklist_status_migration.sql — esta migration
-- só adiciona o registro da decisão "avisar o morador?" tomada pelo
-- gestor ao marcar uma ocorrência como resolvida.
--
-- Importante: moradores não têm login nem inscrição push própria (ver
-- push_subscriptions — cada inscrição é do auth.uid() de quem está
-- logado, e o fluxo do morador é 100% anônimo). Não existe hoje nenhum
-- canal direto de entrega pra um morador específico, então estes campos
-- só registram a DECISÃO do gestor (avisar ou não), não confirmam uma
-- entrega de fato — ver comentário em OcorrenciaDetailPage.jsx.

alter table ocorrencias add column if not exists notificar_morador boolean;
alter table ocorrencias add column if not exists morador_avisado_em timestamptz;

-- Redefine protect_ocorrencia_public_update (ver
-- ocorrencias_reporter_migration.sql e ids_and_checklist_status_migration.sql)
-- pra também proteger essas 2 colunas novas — só o gestor autenticado
-- pode setá-las; sem isso, o visitante anônimo que marca a ocorrência
-- como resolvida também conseguiria reescrevê-las na mesma requisição.
create or replace function protect_ocorrencia_public_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'anon' then
    if new.status is distinct from 'resolvido'
      or new.description is distinct from old.description
      or new.photo is distinct from old.photo
      or new.account_id is distinct from old.account_id
      or new.ambiente_id is distinct from old.ambiente_id
      or new.reported_by_role is distinct from old.reported_by_role
      or new.reporter_name is distinct from old.reporter_name
      or new.reporter_unidade is distinct from old.reporter_unidade
      or new.created_at is distinct from old.created_at
      or new.code is distinct from old.code
      or new.related_checklist_item_id is distinct from old.related_checklist_item_id
      or new.notificar_morador is distinct from old.notificar_morador
      or new.morador_avisado_em is distinct from old.morador_avisado_em
    then
      raise exception 'Só é permitido marcar a ocorrência como resolvida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
