-- Cond-Informa — unidade do morador em ocorrências + acesso público pra
-- listar/resolver ocorrências pendentes na tela de execução do
-- colaborador. Rode este arquivo INTEIRO, uma vez, no SQL Editor.

-- O formulário só tinha um campo combinado "Nome / Unidade" — a unidade
-- nunca teve coluna própria, então nunca teve como aparecer separada em
-- lugar nenhum. Agora vira coluna própria, preenchida pelo formulário.
alter table ocorrencias add column if not exists reporter_unidade text;

-- ocorrencias hoje só tem policy de INSERT pra "anon" (o público consegue
-- REGISTRAR uma ocorrência pelo QR Code, mas não tem como LER nem
-- ATUALIZAR nenhuma) — por isso o colaborador, que não faz login,
-- nunca conseguia ver as ocorrências pendentes do ambiente nem marcar
-- como resolvida ao vivo na tela de execução do checklist.
--
-- SELECT público: mesmo padrão já usado em ambientes/checklist_items/
-- execucoes (todas "for select to anon using (true)") — não tem dado
-- sensível aqui que já não estivesse exposto por essas outras tabelas.
create policy "ocorrencias_public_select" on ocorrencias
  for select to anon using (true);

-- UPDATE público, mas restrito: sem o trigger abaixo, "using (true) with
-- check (true)" deixaria qualquer visitante reescrever a descrição/foto
-- de QUALQUER ocorrência de QUALQUER conta, não só marcar como resolvida
-- a que ele está vendo. O trigger barra qualquer mudança que não seja
-- status -> 'resolvido' quando quem está editando é anônimo; contas
-- autenticadas (ocorrencias_owner_all/ocorrencias_subusuario_all)
-- continuam podendo editar tudo, como já podiam.
create policy "ocorrencias_public_update" on ocorrencias
  for update to anon using (true) with check (true);

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
    then
      raise exception 'Só é permitido marcar a ocorrência como resolvida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_ocorrencia_public_update on ocorrencias;
create trigger trg_protect_ocorrencia_public_update
  before update on ocorrencias
  for each row execute function protect_ocorrencia_public_update();
