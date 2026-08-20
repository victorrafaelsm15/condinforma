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
 * Multi-tenant: quem decide o que cada sessão pode ler/escrever é o RLS no
 * Supabase — não um filtro de account_id aqui no app. Isso é proposital:
 * dono da conta e sub-usuários autorizados usam o MESMO auth.uid() só que
 * dono de contas diferentes (o dono vê pelo próprio account_id; o
 * sub-usuário vê pelos condomínios liberados pra ele via sub_usuarios/
 * sub_usuario_condominios) — filtrar aqui por "account_id = quem está
 * logado" quebraria o acesso de sub-usuário, já que o account_id dos
 * registros é sempre o da conta PRINCIPAL, nunca o do sub-usuário. Ver
 * supabase/sub_usuarios_migration.sql.
 */
export function createStore(table, { orderBy = 'created_at', ascending = false, columns = '*', limit = null } = {}) {
  const localKey = `condinforma_${table}_v1`;

  return {
    // columns: por padrão '*', mas tabelas com coluna pesada (ex.:
    // ocorrencias.photo/execucoes.photo, base64 direto na coluna) devem
    // passar uma lista explícita sem essa coluna aqui — telas de lista não
    // precisam da foto, só a de detalhe (via getById, que sempre traz '*').
    // limit: corta a listagem nos N mais recentes (por orderBy) — evita
    // baixar o histórico inteiro em telas que só mostram os últimos
    // registros.
    async list(filters = {}, { columns: columnsOverride } = {}) {
      if (isSupabaseConfigured) {
        try {
          let query = supabase.from(table).select(columnsOverride || columns).order(orderBy, { ascending });
          Object.entries(filters).forEach(([k, v]) => { query = query.eq(k, v); });
          if (limit) query = query.limit(limit);
          const { data, error } = await query;
          if (error) throw error;
          return data;
        } catch {
          // cai para localStorage
        }
      }
      let list = readLocal(localKey);
      Object.entries(filters).forEach(([k, v]) => {
        list = list.filter((item) => item[k] === v);
      });
      list = list.sort((a, b) => {
        const av = a[orderBy] ?? '';
        const bv = b[orderBy] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') {
          return ascending ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv));
        return ascending ? cmp : -cmp;
      });
      return limit ? list.slice(0, limit) : list;
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
      // Se o chamador já passou account_id (ex.: ambiente/checklist_item
      // criado por um sub-usuário, copiando o account_id do pai — ou
      // execução/ocorrência pública, copiando do ambiente), respeita esse
      // valor. Só busca da sessão logada quando não veio explícito, o que
      // só faz sentido pra criação de nível raiz (condominios), onde quem
      // cria É o dono.
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
          // condomínios/sub-usuários do plano), não um erro de
          // infraestrutura — não cai pro localStorage, senão criaria um
          // registro fantasma que violaria a própria regra que acabou de
          // bloquear a escrita.
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
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
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
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from(table).delete().eq('id', id);
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
