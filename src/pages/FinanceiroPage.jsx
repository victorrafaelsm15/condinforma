import { useEffect, useState } from 'react';
import { Text, Group, Loader, Badge, Button } from '@mantine/core';
import { Wallet, Calendar, CreditCard, Receipt } from 'lucide-react';
import { getSession } from '../lib/authService';
import { accountsStore } from '../lib/stores';

const BILLING_TYPE_LABEL = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', UNDEFINED: 'A definir' };
const PAYMENT_STATUS_LABEL = {
  PENDING: 'Pendente', CONFIRMED: 'Confirmado', RECEIVED: 'Recebido', OVERDUE: 'Vencido',
  REFUNDED: 'Estornado', REFUND_REQUESTED: 'Estorno solicitado', AWAITING_RISK_ANALYSIS: 'Em análise',
};
const PAYMENT_STATUS_COLOR = {
  PENDING: 'yellow', CONFIRMED: 'green', RECEIVED: 'green', OVERDUE: 'red',
  REFUNDED: 'gray', REFUND_REQUESTED: 'gray', AWAITING_RISK_ANALYSIS: 'yellow',
};

function InfoRow({ label, value }) {
  return (
    <Group justify="space-between" py={8} style={{ borderBottom: '1px solid var(--border)' }}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text component="div" size="sm" fw={700}>{value}</Text>
    </Group>
  );
}

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { setLoading(false); return; }

      const account = await accountsStore.getById(session.user.id);
      if (account?.role === 'owner') {
        setIsPlatformOwner(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financeiro`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Não foi possível carregar os dados financeiros.');
        setData(json);
      } catch (err) {
        setError(err.message || 'Não foi possível carregar os dados financeiros agora.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  if (isPlatformOwner) {
    return (
      <div>
        <Text fw={800} size="1.6rem">Financeiro</Text>
        <div className="surface-card" style={{ padding: 24, marginTop: 20 }}>
          <Text c="dimmed">Esta conta administra a plataforma e não tem plano ou cobrança própria.</Text>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Text fw={800} size="1.6rem">Financeiro</Text>
        <div className="surface-card" style={{ padding: 24, marginTop: 20 }}>
          <Text c="red">{error || 'Não foi possível carregar os dados financeiros agora.'}</Text>
        </div>
      </div>
    );
  }

  const hasPlan = !!data.planName;

  return (
    <div>
      <Group gap={12} mb="xl">
        <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
          <Wallet size={19} color="var(--blue)" />
        </span>
        <div>
          <Text fw={800} size="1.6rem">Financeiro</Text>
          <Text size="md" c="dimmed" mt={2}>Plano, cobrança e forma de pagamento da sua conta</Text>
        </div>
      </Group>

      {!hasPlan ? (
        <div className="surface-card" style={{ padding: 24 }}>
          <Text c="dimmed" mb="md">Você ainda não tem um plano ativo.</Text>
          <Button component="a" href={`${import.meta.env.BASE_URL}#/?scrollTo=planos`}>Ver planos</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
          <div className="surface-card" style={{ padding: 24 }}>
            <Group gap={8} mb={14}>
              <CreditCard size={16} color="var(--blue)" />
              <Text fw={700} size="sm">Plano atual</Text>
            </Group>
            <InfoRow label="Plano" value={data.planName} />
            <InfoRow label="Valor mensal" value={data.price != null ? `R$ ${data.price.toFixed(2)}` : '—'} />
            <InfoRow label="Limite de condomínios" value={data.condominioLimit} />
            <InfoRow label="Limite de sub-usuários" value={data.subUsuarioLimit} />
            <InfoRow
              label="Status da conta"
              value={<Badge color={data.accountStatus === 'ativo' ? 'green' : 'red'} variant="light">{data.accountStatus === 'ativo' ? 'Ativa' : 'Inativa'}</Badge>}
            />
          </div>

          <div className="surface-card" style={{ padding: 24 }}>
            <Group gap={8} mb={14}>
              <Calendar size={16} color="var(--blue)" />
              <Text fw={700} size="sm">Próxima cobrança</Text>
            </Group>
            <InfoRow
              label="Forma de pagamento"
              value={BILLING_TYPE_LABEL[data.billingType] || '—'}
            />
            <InfoRow
              label="Vencimento"
              value={data.nextDueDate ? new Date(`${data.nextDueDate}T00:00:00`).toLocaleDateString('pt-BR') : '—'}
            />
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['PIX', 'BOLETO', 'CREDIT_CARD'].map((bt) => (
                <Button
                  key={bt}
                  component="a"
                  href={`${import.meta.env.BASE_URL}#/assinar?plano=${encodeURIComponent(data.planName)}`}
                  size="xs"
                  variant={data.billingType === bt ? 'light' : 'default'}
                  disabled={data.billingType === bt}
                >
                  {data.billingType === bt ? `${BILLING_TYPE_LABEL[bt]} (atual)` : `Trocar para ${BILLING_TYPE_LABEL[bt]}`}
                </Button>
              ))}
            </div>
            <Text size="xs" c="dimmed" mt={10}>
              Trocar a forma de pagamento cria uma nova cobrança para o plano atual — a anterior é cancelada automaticamente quando a nova for confirmada.
            </Text>
          </div>

          <div className="surface-card" style={{ padding: 24 }}>
            <Group gap={8} mb={14}>
              <Receipt size={16} color="var(--blue)" />
              <Text fw={700} size="sm">Última cobrança</Text>
            </Group>
            {data.lastPayment ? (
              <>
                <InfoRow
                  label="Status"
                  value={<Badge color={PAYMENT_STATUS_COLOR[data.lastPayment.status] || 'gray'} variant="light">{PAYMENT_STATUS_LABEL[data.lastPayment.status] || data.lastPayment.status}</Badge>}
                />
                <InfoRow label="Valor" value={`R$ ${Number(data.lastPayment.value).toFixed(2)}`} />
                <InfoRow label="Vencimento" value={new Date(`${data.lastPayment.dueDate}T00:00:00`).toLocaleDateString('pt-BR')} />
              </>
            ) : (
              <Text size="sm" c="dimmed">Nenhuma cobrança encontrada ainda.</Text>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
