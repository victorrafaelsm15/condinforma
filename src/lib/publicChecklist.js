import { supabase } from './supabaseClient';

// Acesso público (sem login) a ambientes/checklist/ocorrências/execuções,
// usado só por ExecutarChecklistPage.jsx, StatusPublicoPage.jsx e
// offlineQueue.js (colaborador e morador chegam aqui via QR Code, nunca
// autenticados). Antes essas telas liam as tabelas direto
// (ambientesStore, checklistPeriodosStore, etc.) sob policies de RLS
// "to anon using (true)" — que na prática expunham a tabela INTEIRA (todos
// os clientes) pra qualquer um com a anon key, não só o registro do ID da
// URL. A correção (ver supabase/tenant_isolation_hardening_migration.sql)
// dropou essas policies e moveu o acesso público pra funções SECURITY
// DEFINER parametrizadas por ID — só elas devolvem dado público agora,
// por isso este módulo existe separado dos stores autenticados normais.
//
// Todas retornam um valor "vazio" (null/[]) em erro, igual ao
// comportamento de fallback que createStore.js já tinha — as páginas que
// chamam isso tratam "não encontrado" como um estado normal da UI.

export async function getAmbientePublico(ambienteId) {
  const { data, error } = await supabase.rpc('get_ambiente_publico', { p_ambiente_id: ambienteId });
  if (error) return null;
  return data?.[0] || null;
}

export async function getPeriodoAtivoPublico(ambienteId) {
  const { data, error } = await supabase.rpc('get_checklist_periodo_ativo_publico', { p_ambiente_id: ambienteId });
  if (error) return null;
  return data?.[0] || null;
}

export async function listChecklistItemsPublico(checklistPeriodoId) {
  const { data, error } = await supabase.rpc('list_checklist_items_publico', { p_checklist_periodo_id: checklistPeriodoId });
  if (error) return [];
  return data || [];
}

export async function listOcorrenciasPendentesPublico(ambienteId) {
  const { data, error } = await supabase.rpc('list_ocorrencias_pendentes_publico', { p_ambiente_id: ambienteId });
  if (error) return [];
  return data || [];
}

export async function getUltimaExecucaoPublica(ambienteId) {
  const { data, error } = await supabase.rpc('get_ultima_execucao_publica', { p_ambiente_id: ambienteId });
  if (error) return null;
  return data?.[0] || null;
}

export async function resolveOcorrenciaPublica(ocorrenciaId, ambienteId) {
  const { error } = await supabase.rpc('resolve_ocorrencia_publica', { p_ocorrencia_id: ocorrenciaId, p_ambiente_id: ambienteId });
  if (error) throw error;
}

// Usadas só por offlineQueue.js (sendToServer) — os dois únicos INSERTs
// anônimos do app. account_id nunca é aceito do cliente: a função no
// banco deriva do próprio ambiente, sempre.
// As duas funções abaixo devolvem { new_id, was_inserted } — nomes que não
// colidem com a coluna "id" das próprias tabelas (colisão real que quebrou
// a função no banco: RETURNS TABLE em PL/pgSQL cria parâmetros OUT com
// esses nomes, e "id" ambíguo com execucoes.id/ocorrencias.id fazia toda
// chamada falhar com "column reference id is ambiguous").
export async function insertExecucaoPublica(payload) {
  const { data, error } = await supabase.rpc('insert_execucao_publica', {
    p_id: payload.id,
    p_ambiente_id: payload.ambiente_id,
    p_checklist_periodo_id: payload.checklist_periodo_id,
    p_executed_by: payload.executed_by,
    p_completed_count: payload.completed_count,
    p_total_count: payload.total_count,
    p_items: payload.items,
    p_photo: payload.photo,
    p_free_text_note: payload.free_text_note,
    p_created_at: payload.created_at,
  });
  if (error) throw error;
  return data?.[0] ? { id: data[0].new_id, inserted: data[0].was_inserted } : null;
}

export async function insertOcorrenciaPublica(payload) {
  const { data, error } = await supabase.rpc('insert_ocorrencia_publica', {
    p_id: payload.id,
    p_ambiente_id: payload.ambiente_id,
    p_description: payload.description,
    p_photo: payload.photo,
    p_reported_by_role: payload.reported_by_role,
    p_reporter_name: payload.reporter_name,
    p_reporter_unidade: payload.reporter_unidade,
    p_related_checklist_item_id: payload.related_checklist_item_id,
    p_created_at: payload.created_at,
  });
  if (error) throw error;
  return data?.[0] ? { id: data[0].new_id, inserted: data[0].was_inserted } : null;
}
