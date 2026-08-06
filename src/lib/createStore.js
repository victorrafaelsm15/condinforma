import { supabase, isSupabaseConfigured } from './supabaseClient';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

// getSession() lê do cache local do client (rápido, sem round-trip de rede
// na maioria das vezes) — usado em leituras (list/update/remove), onde um
// pequeno atraso na detecção de sessão não é crítico.
async function getSessionAccountId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// getUser() valida a sessão com o servidor — usado só na escrita (create),
// onde queremos ter certeza do dono antes de gravar o registro.
async function getFreshAccountId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Cria um serviço de dados para uma "tabela" — tenta Supabase primeiro,
 * cai automaticamente para localStorage se não configurado ou se houver erro
 * (ex.: tabela ainda não criada no banco). Isso garante que o app funcione
 * de ponta a ponta mesmo antes de configurar o Supabase.
 *
 * Multi-tenant: toda escrita grava o account_id do usuário logado (dono do
 * registro), e toda leitura via list() filtra implicitamente por esse mesmo
 * account_id — a não ser que a própria chamada avise que é uma consulta
 * pública (skipAccountFilter: true), usada nas páginas sem login (execução
 * de checklist via QR Code, status público). getById() nunca filtra por
 * conta — é usado tanto pelo painel quanto pelas páginas públicas, e quem
 * garante o isolamento real dos dados nos dois casos é o RLS no Supabase,
 * não este filtro de conveniência no app.
 */
export function createStore(table, { orderBy = 'created_at', ascending = false } = {}) {
  const localKey = `condinforma_${table}_v1`;

  return {
    async list(filters = {}, { skipAccountFilter = false } = {}) {
      const accountId = skipAccountFilter ? null : await getSessionAccountId();

      if (isSupabaseConfigured) {
        try {
          let query = supabase.from(table).select('*').order(orderBy, { ascending });
          if (accountId) query = query.eq('account_id', accountId);
          Object.entries(filters).forEach(([k, v]) => { query = query.eq(k, v); });
          const { data, error } = await query;
          if (error) throw error;
          return data;
        } catch {
          // cai para localStorage
        }
      }
      let list = readLocal(localKey);
      if (accountId) list = list.filter((item) => item.account_id === accountId);
      Object.entries(filters).forEach(([k, v]) => {
        list = list.filter((item) => item[k] === v);
      });
      return list.sort((a, b) => {
        const av = a[orderBy] ?? '';
        const bv = b[orderBy] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') {
          return ascending ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv));
        return ascending ? cmp : -cmp;
      });
    },

    async getById(id) {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
          if (error) throw error;
          return data;
        } catch {
          // cai para localStorage
        }
      }
      return readLocal(localKey).find((item) => item.id === id) || null;
    },

    async create(payload) {
      // Se o chamador já passou account_id (ex.: execução/ocorrência pública,
      // copiando o account_id do ambiente), respeita esse valor — só busca
      // da sessão logada quando não veio explícito no payload.
      const accountId = payload.account_id ?? await getFreshAccountId();
      const record = {
        id: uid(),
        created_at: new Date().toISOString(),
        ...payload,
        ...(accountId ? { account_id: accountId } : {}),
      };
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from(table).insert(record).select().single();
          if (error) throw error;
          return data;
        } catch (err) {
          // CI001 é uma regra de negócio do banco (ex.: limite de
          // condomínios do plano), não um erro de infraestrutura — não cai
          // pro localStorage, senão criaria um registro fantasma que
          // violaria a própria regra que acabou de bloquear a escrita.
          if (err?.code === 'CI001') {
            const planError = new Error(err.message);
            planError.code = 'CI001';
            throw planError;
          }
          // qualquer outro erro (rede, tabela ausente, Supabase mal
          // configurado) cai para localStorage, mantendo o app utilizável
        }
      }
      const list = readLocal(localKey);
      list.push(record);
      writeLocal(localKey, list);
      return record;
    },

    async update(id, payload) {
      const accountId = await getSessionAccountId();
      if (isSupabaseConfigured) {
        try {
          let query = supabase.from(table).update(payload).eq('id', id);
          if (accountId) query = query.eq('account_id', accountId);
          const { data, error } = await query.select().single();
          if (error) throw error;
          return data;
        } catch {
          // cai para localStorage
        }
      }
      const list = readLocal(localKey);
      const idx = list.findIndex((item) => item.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload };
        writeLocal(localKey, list);
        return list[idx];
      }
      return null;
    },

    async remove(id) {
      const accountId = await getSessionAccountId();
      if (isSupabaseConfigured) {
        try {
          let query = supabase.from(table).delete().eq('id', id);
          if (accountId) query = query.eq('account_id', accountId);
          const { error } = await query;
          if (error) throw error;
          return true;
        } catch {
          // cai para localStorage
        }
      }
      writeLocal(localKey, readLocal(localKey).filter((item) => item.id !== id));
      return true;
    },
  };
}
