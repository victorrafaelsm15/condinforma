import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// A applicationServerKey do PushManager precisa de Uint8Array, não da
// string base64url que o VAPID gera.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && Boolean(VAPID_PUBLIC_KEY);
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// account_id salvo aqui é sempre o auth.uid() de QUEM está se inscrevendo
// nesse navegador (conta principal ou sub-usuário) — nunca resolvido pra
// conta principal, porque cada pessoa recebe push no próprio aparelho (ver
// push_subscriptions_migration.sql).
export async function subscribeToPush(subscriberId) {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { account_id: subscriberId, endpoint: json.endpoint, keys: json.keys },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
  return subscription;
}

export async function unsubscribeFromPush() {
  const sub = await getExistingSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  await sub.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
