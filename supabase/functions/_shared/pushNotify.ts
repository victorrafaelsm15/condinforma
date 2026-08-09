// Envio de notificação push (Web Push API nativa — sem serviço externo
// pago). Roda só no servidor: a chave privada VAPID nunca pode existir em
// código que roda no navegador.
import webpush from 'npm:web-push@3';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@condinforma.com',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
);

type SupabaseAdminClient = { from: (table: string) => any };

export type PushPayload = { title: string; body: string; url?: string };

// Manda pra todas as inscrições vinculadas à lista de account_id dada —
// cada account_id pode ser a conta principal OU o auth_user_id de um
// sub-usuário (ver push_subscriptions_migration.sql: cada pessoa se
// inscreve com o próprio auth.uid(), não o da conta principal). Nunca
// lança exceção: notificação é um efeito colateral, uma falha aqui não
// pode derrubar o fluxo que chamou (ex.: criação de ocorrência).
export async function sendPushToAccounts(
  supabaseAdmin: SupabaseAdminClient,
  accountIds: (string | null | undefined)[],
  payload: PushPayload,
) {
  const uniqueIds = [...new Set(accountIds.filter((id): id is string => Boolean(id)))];
  if (!uniqueIds.length) return;

  try {
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('account_id', uniqueIds);
    if (error || !subs?.length) return;

    await Promise.all(subs.map(async (sub: { id: string; endpoint: string; keys: { p256dh: string; auth: string } }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Inscrição expirada/revogada no navegador (usuário desinstalou,
          // limpou dados, etc.) — não adianta reenviar, remove do banco.
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('Erro ao enviar push:', err instanceof Error ? err.message : err);
        }
      }
    }));
  } catch (err) {
    console.error('Erro ao buscar inscrições push:', err instanceof Error ? err.message : err);
  }
}
