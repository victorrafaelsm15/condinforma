import { supabase } from './supabaseClient';

// Todas as consultas de Relatórios passam por functions do banco
// (security invoker — RLS de quem chama se aplica normalmente) em vez
// de trazer linhas cruas pro cliente agregar — ver
// supabase/relatorios_migration.sql. Isso é essencial pra contas com
// vários condomínios grandes não pesarem o navegador nem a rede.
async function callRpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data || [];
}

function toParams({ condominioId, dateFrom, dateTo, bucket, limit }) {
  const params = {
    p_condominio_id: condominioId || null,
    p_date_from: dateFrom ? dateFrom.toISOString() : null,
    p_date_to: dateTo ? dateTo.toISOString() : null,
  };
  if (bucket) params.p_bucket = bucket;
  if (limit) params.p_limit = limit;
  return params;
}

export async function getExecucoesIndicators(filters) {
  const rows = await callRpc('report_execucoes_indicators', toParams(filters));
  return rows[0] || { total_execucoes: 0, completed_sum: 0, total_sum: 0 };
}

export async function getOcorrenciasIndicators(filters) {
  const rows = await callRpc('report_ocorrencias_indicators', toParams(filters));
  return rows[0] || { abertas: 0, resolvidas: 0, tempo_medio_resolucao_horas: null };
}

export async function getChecklistItemsIndicators(filters) {
  const rows = await callRpc('report_checklist_items_indicators', toParams(filters));
  return rows[0] || { total_itens: 0, concluidos: 0 };
}

export async function getExecucoesSeries(filters) {
  return callRpc('report_execucoes_series', toParams(filters));
}

export async function getOcorrenciasRankingAmbiente(filters) {
  return callRpc('report_ocorrencias_ranking_ambiente', toParams(filters));
}

export async function getChecklistItemRanking(filters) {
  return callRpc('report_checklist_item_ranking', toParams(filters));
}
