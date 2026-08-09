import { openDB } from 'idb';
import { supabase } from './supabaseClient';

// Fila local (IndexedDB) pra execuções de checklist e ocorrências
// confirmadas sem sinal (elevador, subsolo, garagem). O createStore.js
// genérico NÃO serve pra isso: ele cai silenciosamente pro localStorage do
// aparelho em qualquer erro de rede e devolve um "sucesso" fake — o
// registro nunca chega no painel do gestor e ninguém percebe. Aqui o envio
// é feito com insert cru no Supabase, onde uma falha de rede continua
// sendo um erro de verdade, e o item some da fila só depois da confirmação
// real do servidor.
const DB_NAME = 'cond-informa-offline';
const DB_VERSION = 1;
const STORE = 'queue';
const SYNC_TAG = 'cond-informa-sync-queue';

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'queueId' });
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });
}

// Mesmo esquema de id usado pelo createStore.js (uid() local, não uuid do
// Postgres) — os registros de execucoes/ocorrencias têm "id text primary
// key" sem default, então o app sempre gerou o id no cliente.
export function generateRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const listeners = new Set();
export function subscribeQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

// type: 'execucao' | 'ocorrencia'. record precisa já vir com "id" e
// "created_at" definidos (mesmo formato que createStore.create() geraria),
// pra que reenviar o mesmo item nunca crie duplicata no servidor.
export async function enqueue(type, record) {
  const db = await getDb();
  const entry = {
    queueId: `q-${record.id}`,
    recordId: record.id,
    type,
    payload: record,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  await db.put(STORE, entry);
  notify();
  requestBackgroundSync();
  return entry;
}

export async function listQueue() {
  const db = await getDb();
  return db.getAllFromIndex(STORE, 'createdAt');
}

export async function isPending(recordId) {
  const all = await listQueue();
  return all.some((e) => e.recordId === recordId);
}

async function removeFromQueue(queueId) {
  const db = await getDb();
  await db.delete(STORE, queueId);
}

async function markAttempt(queueId, error) {
  const db = await getDb();
  const entry = await db.get(STORE, queueId);
  if (!entry) return;
  entry.attempts += 1;
  entry.lastError = error ? String(error.message || error) : null;
  await db.put(STORE, entry);
}

const TABLE_BY_TYPE = { execucao: 'execucoes', ocorrencia: 'ocorrencias' };

// Dispara a notificação push pro dono do condomínio (e sub-usuários com
// acesso) depois que a ocorrência realmente chegou no servidor — nunca
// antes. Fire-and-forget de propósito: se a notificação falhar, a
// ocorrência já foi salva com sucesso, isso não pode travar a fila nem
// reaparecer como erro pro colaborador/morador.
function notifyOcorrenciaCreated(ocorrenciaId) {
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-ocorrencia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ ocorrenciaId }),
  }).catch(() => {});
}

async function sendToServer(entry) {
  const table = TABLE_BY_TYPE[entry.type];
  const { error } = await supabase.from(table).insert(entry.payload);
  // 23505 = chave duplicada: o insert já tinha ido pro servidor numa
  // tentativa anterior (ex.: a resposta caiu da rede depois de gravar) —
  // trata como sucesso, senão o item ficaria preso reenviando pra sempre.
  if (error && error.code !== '23505') throw error;
  if (entry.type === 'ocorrencia' && (!error || error.code === '23505')) {
    notifyOcorrenciaCreated(entry.payload.id);
  }
}

let syncing = false;

export async function syncQueue() {
  if (syncing || !navigator.onLine) {
    return { synced: 0, remaining: (await listQueue()).length };
  }
  syncing = true;
  let synced = 0;
  try {
    const items = await listQueue();
    for (const entry of items) {
      try {
        await sendToServer(entry);
        await removeFromQueue(entry.queueId);
        synced += 1;
        notify();
      } catch (err) {
        await markAttempt(entry.queueId, err);
        notify();
        // Para na primeira falha pra preservar a ordem de criação — se a
        // causa for falta de conexão, tentar os próximos não adianta; se
        // for outra coisa, evita martelar o servidor com a fila inteira.
        break;
      }
    }
  } finally {
    syncing = false;
  }
  const remaining = (await listQueue()).length;
  return { synced, remaining };
}

export function requestBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg) => reg.sync.register(SYNC_TAG))
      .catch(() => {
        // Background Sync indisponível/negado nesse navegador — sem
        // problema, o fallback (evento "online" + intervalo periódico +
        // sync ao abrir o app, ver initAutoSync()) cobre o mesmo caso.
      });
  }
}

let initialized = false;
export function initAutoSync() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('online', () => syncQueue());
  setInterval(() => syncQueue(), 60_000);
  syncQueue();
}
