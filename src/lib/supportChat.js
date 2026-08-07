import { supabase } from './supabaseClient';

// Chama a Edge Function support-chat, que repassa o histórico pra API da
// Anthropic com o system prompt fixo do bot — ver supabase/functions/support-chat.
export async function sendSupportMessage(messages) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível responder agora.');
  return data.reply;
}
