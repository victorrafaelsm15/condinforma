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

/**
 * Cria um serviço de dados para uma "tabela" — tenta Supabase primeiro,
 * cai automaticamente para localStorage se não configurado ou se houver erro
 * (ex.: tabela ainda não criada no banco). Isso garante que o app funcione
 * de ponta a ponta mesmo antes de configurar o Supabase.
 */
export function createStore(table, { orderBy = 'created_at', ascending = false } = {}) {
  const localKey = `condinforma_${table}_v1`;

  return {
    async list(filters = {}) {
      if (isSupabaseConfigured) {
        try {
          let query = supabase.from(table).select('*').order(orderBy, { ascending });
          Object.entries(filters).forEach(([k, v]) => { query = query.eq(k, v); });
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
      const record = { id: uid(), created_at: new Date().toISOString(), ...payload };
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.from(table).insert(record).select().single();
          if (error) throw error;
          return data;
        } catch {
          // cai para localStorage
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
