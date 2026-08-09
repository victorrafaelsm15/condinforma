import { useCallback, useEffect, useState } from 'react';
import { getSession } from './authService';
import { isPushSupported, getExistingSubscription, subscribeToPush, unsubscribeFromPush } from './pushSubscriptions';

// Hook central de notificações push — usado tanto pelo banner de permissão
// (AdminLayout) quanto pelo toggle em Configurações, pra manter os dois
// sempre em sincronia com o estado real do navegador (Notification.
// permission não é algo que a gente controla, só reflete).
export function usePushNotifications() {
  const supported = isPushSupported();
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supported) { setLoading(false); return; }
    setPermission(Notification.permission);
    const sub = await getExistingSubscription();
    setSubscribed(!!sub);
    setLoading(false);
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    if (!supported) return false;
    const session = await getSession();
    if (!session) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') return false;
    try {
      await subscribeToPush(session.user.id);
      setSubscribed(true);
      return true;
    } catch {
      return false;
    }
  }, [supported]);

  const disable = useCallback(async () => {
    await unsubscribeFromPush();
    setSubscribed(false);
  }, []);

  return { supported, permission, subscribed, loading, enable, disable };
}
