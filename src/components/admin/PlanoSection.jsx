import { useEffect, useState } from 'react';
import { Text, Group, Button, Loader } from '@mantine/core';
import { CreditCard } from 'lucide-react';
import { getSession } from '../../lib/authService';
import { accountsStore } from '../../lib/stores';
import { plans } from '../../data/landingContent';

export default function PlanoSection() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      const acc = await accountsStore.getById(session.user.id);
      setAccount(acc);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Group justify="center" py={16}><Loader size="sm" color="brand" /></Group>;
  if (!account || account.role === 'owner') return null;

  const currentPlan = plans.find((p) => p.name.toLowerCase() === account.plan_name?.toLowerCase());

  return (
    <div>
      <Group gap={8} mb={10}>
        <CreditCard size={16} color="var(--blue)" />
        <Text fw={700} size="sm">Plano</Text>
      </Group>

      <div className="surface-card" style={{ padding: 12, marginBottom: 10 }}>
        <Group justify="space-between" align="center">
          <div>
            <Text size="sm" fw={700}>{currentPlan ? currentPlan.name : 'Nenhum plano ativo'}</Text>
            {currentPlan && <Text size="xs" c="dimmed">R$ {currentPlan.price}/mês</Text>}
          </div>
          <Button size="xs" variant="light" onClick={() => setPickerOpen((v) => !v)}>
            Trocar de plano
          </Button>
        </Group>
      </div>

      {pickerOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {plans.map((p) => (
            <Button
              key={p.name}
              component="a"
              href={`${import.meta.env.BASE_URL}#/assinar?plano=${encodeURIComponent(p.name)}`}
              variant={p.name === currentPlan?.name ? 'light' : 'default'}
              disabled={p.name === currentPlan?.name}
              fullWidth
              justify="space-between"
              rightSection={<Text size="xs" c="dimmed">R$ {p.price}/mês</Text>}
            >
              {p.name}{p.name === currentPlan?.name ? ' (atual)' : ''}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
