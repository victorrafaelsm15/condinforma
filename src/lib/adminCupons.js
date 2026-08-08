import { supabase } from './supabaseClient';

// Só funciona pra accounts.role = 'owner' (RLS — ver
// supabase/cupons_admin_migration.sql). Cupom não tem "id" text tipo
// uid() de app (usa uuid do Postgres), então não passa pelo createStore
// genérico, igual sub_usuarios.

export async function listCupons() {
  const { data, error } = await supabase.from('cupons').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createCupom(payload) {
  const { data, error } = await supabase.from('cupons').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateCupom(id, payload) {
  const { data, error } = await supabase.from('cupons').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCupom(id) {
  const { error } = await supabase.from('cupons').delete().eq('id', id);
  if (error) throw error;
}
