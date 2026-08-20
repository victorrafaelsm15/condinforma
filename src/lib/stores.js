import { createStore } from './createStore';

export const condominiosStore = createStore('condominios', { orderBy: 'created_at', ascending: true });
export const ambientesStore = createStore('ambientes', { orderBy: 'created_at', ascending: true });
export const checklistPeriodosStore = createStore('checklist_periodos', { orderBy: 'started_at', ascending: false });
export const checklistItemsStore = createStore('checklist_items', { orderBy: 'order_index', ascending: true });
export const checklistItemComentariosStore = createStore('checklist_item_comentarios', { orderBy: 'created_at', ascending: true });
export const execucoesStore = createStore('execucoes', { orderBy: 'created_at', ascending: false });
// columns exclui "photo" (base64 salvo direto na coluna, pode ter
// centenas de KB por registro) — telas de lista não usam a foto, só
// OcorrenciaDetailPage (via getById, que sempre traz '*' incluindo photo).
// limit corta em 50 mais recentes: cobre tanto a listagem agregada
// (OcorrenciasPage) quanto a aba por ambiente, evitando baixar o
// histórico inteiro em toda tela.
export const ocorrenciasStore = createStore('ocorrencias', {
  orderBy: 'created_at',
  ascending: false,
  columns: 'id, ambiente_id, account_id, description, status, code, reported_by_role, reporter_name, reporter_unidade, related_checklist_item_id, notificar_morador, morador_avisado_em, resolvido_em, created_at',
  limit: 50,
});
export const accountsStore = createStore('accounts');
