import { createStore } from './createStore';

export const condominiosStore = createStore('condominios', { orderBy: 'created_at', ascending: true });
export const ambientesStore = createStore('ambientes', { orderBy: 'created_at', ascending: true });
export const checklistItemsStore = createStore('checklist_items', { orderBy: 'order_index', ascending: true });
export const execucoesStore = createStore('execucoes', { orderBy: 'created_at', ascending: false });
export const ocorrenciasStore = createStore('ocorrencias', { orderBy: 'created_at', ascending: false });
