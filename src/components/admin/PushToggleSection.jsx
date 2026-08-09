import { useState } from 'react';
import { Text, Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Bell } from 'lucide-react';
import { usePushNotifications } from '../../lib/usePushNotifications';

// Reflete o estado REAL da permissão do navegador — não um preferência
// isolada nossa. Se a pessoa bloqueou notificações no navegador, o toggle
// fica travado desligado (não tem como reativar sem mexer nas
// configurações do próprio navegador, então não faz sentido fingir que dá).
export default function PushToggleSection() {
  const { supported, permission, subscribed, loading, enable, disable } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  if (!supported) return null;

  const checked = subscribed && permission === 'granted';
  const blocked = permission === 'denied';

  const handleChange = async (e) => {
    const wantsOn = e.currentTarget.checked;
    setBusy(true);
    if (wantsOn) {
      const ok = await enable();
      if (!ok) {
        notifications.show({
          color: 'red',
          message: Notification.permission === 'denied'
            ? 'Notificações bloqueadas no navegador. Ative manualmente nas configurações do site para usar.'
            : 'Não foi possível ativar as notificações agora.',
        });
      }
    } else {
      await disable();
    }
    setBusy(false);
  };

  return (
    <Group justify="space-between" mb="lg" align="flex-start">
      <Group gap={8}>
        <Bell size={16} color="var(--blue)" />
        <div>
          <Text fw={700} size="sm">Notificações push</Text>
          {blocked && <Text size="xs" c="dimmed">Bloqueadas nas configurações do navegador.</Text>}
        </div>
      </Group>
      <Switch checked={checked} onChange={handleChange} disabled={loading || busy || blocked} aria-label="Ativar notificações push" />
    </Group>
  );
}
