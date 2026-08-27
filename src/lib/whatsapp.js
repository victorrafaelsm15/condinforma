import { supabase } from './supabaseClient';

// accounts não tem select público — get_sindico_whatsapp() é uma function
// security definer que devolve só o telefone, dado o ambiente (ver
// whatsapp_sindico_migration.sql), pra não abrir o resto da conta pro
// visitante anônimo do QR Code.
export async function fetchSindicoWhatsapp(ambienteId) {
  const { data, error } = await supabase.rpc('get_sindico_whatsapp', { p_ambiente_id: ambienteId });
  if (error) return null;
  return data || null;
}

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

// Número gravado sem código do país (só DDD + número, como a pessoa digita)
// — wa.me exige o código do país na frente; assume Brasil (55), único
// mercado do produto.
export function buildWhatsAppLink(phone) {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}
