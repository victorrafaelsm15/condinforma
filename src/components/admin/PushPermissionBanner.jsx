import { useState } from 'react';
import { Text, Button, Group, ActionIcon } from '@mantine/core';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '../../lib/usePushNotifications';

const DISMISS_KEY = 'push-banner-dismissed';

// Mostrado depois do primeiro login bem-sucedido no painel (aparece em
// qualquer página dentro do AdminLayout), não na primeira tela que a
// pessoa vê ao abrir o site — só quando o navegador ainda não tem uma
// resposta ("default") pra permissão de notificação.
export default function PushPermissionBanner() {
  const { supported, permission, loading, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [enabling, setEnabling] = useState(false);

  if (!supported || loading || permission !== 'default' || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleEnable = async () => {
    setEnabling(true);
    await enable();
    setEnabling(false);
    dismiss();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
      background: 'var(--blue-light)', borderBottom: '1px solid rgba(51,85,232,0.2)', flexWrap: 'wrap',
    }}>
      <Bell size={16} color="var(--blue)" style={{ flexShrink: 0 }} />
      <Text size="sm" fw={600} style={{ flex: 1, minWidth: 220, color: 'var(--blue-dark)' }}>
        Ative notificações para saber na hora de novas ocorrências.
      </Text>
      <Group gap={8} wrap="nowrap">
        <Button size="xs" onClick={handleEnable} loading={enabling}>Ativar notificações</Button>
        <ActionIcon variant="subtle" color="gray" radius="xl" onClick={dismiss} aria-label="Dispensar aviso">
          <X size={15} />
        </ActionIcon>
      </Group>
    </div>
  );
}
