import { useEffect, useState } from 'react';
import { Text, Group, Loader, Badge } from '@mantine/core';
import { Users, Mail, Phone, IdCard } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getSession } from '../lib/authService';
import { accountsStore } from '../lib/stores';

const STATUS_STYLES = {
  ativo: { color: 'green', label: 'Ativo' },
  pendente: { color: 'yellow', label: 'Pendente' },
  inativo: { color: 'red', label: 'Inativo' },
};

function formatCpfCnpj(v) {
  if (!v) return '—';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

function formatPhone(v) {
  if (!v) return '—';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v;
}

// Página visível só pra conta "owner" (dono da plataforma) — quem paga um
// plano é registrado em "assinantes" pela Edge Function subscribe/webhook;
// essa tabela não segue o isolamento por account_id do resto do app: o RLS
// dá visibilidade GLOBAL só pra quem tem role = 'owner' (ver
// supabase/assinantes_owner_view_migration.sql).
export default function AssinantesPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [list, setList] = useState([]);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      const account = await accountsStore.getById(session.user.id);
      if (account?.role !== 'owner') { setLoading(false); return; }
      setAuthorized(true);
      const { data } = await supabase.from('assinantes').select('*').order('created_at', { ascending: false });
      setList(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  if (!authorized) {
    return (
      <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
        <Text c="dimmed">Acesso restrito à conta administradora da plataforma.</Text>
      </div>
    );
  }

  return (
    <div>
      <Group gap={12} mb="xl">
        <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
          <Users size={19} color="var(--blue)" />
        </span>
        <div>
          <Text fw={800} size="1.6rem" className="font-display">Assinantes</Text>
          <Text size="md" c="dimmed" mt={2}>Clientes que assinaram um plano do Cond-Informa.</Text>
        </div>
      </Group>

      {list.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((s) => {
            const statusInfo = STATUS_STYLES[s.status] || { color: 'gray', label: s.status || '—' };
            return (
              <div key={s.asaas_subscription_id} className="surface-card" style={{ padding: 18 }}>
                <Group justify="space-between" align="flex-start" wrap="wrap" gap={10}>
                  <div>
                    <Group gap={8}>
                      <Text fw={700} size="md">{s.name || 'Sem nome'}</Text>
                      <Badge color={statusInfo.color} variant="light">{statusInfo.label}</Badge>
                      {s.plan_name && <Badge color="brand" variant="light">{s.plan_name}</Badge>}
                    </Group>
                    <Group gap={16} mt={8} wrap="wrap">
                      <Group gap={5}>
                        <Mail size={13} color="var(--text-muted)" />
                        <Text size="xs" c="dimmed">{s.email || '—'}</Text>
                      </Group>
                      <Group gap={5}>
                        <Phone size={13} color="var(--text-muted)" />
                        <Text size="xs" c="dimmed">{formatPhone(s.phone)}</Text>
                      </Group>
                      <Group gap={5}>
                        <IdCard size={13} color="var(--text-muted)" />
                        <Text size="xs" c="dimmed">{formatCpfCnpj(s.cpf_cnpj)}</Text>
                      </Group>
                    </Group>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">Assinou em {new Date(s.created_at).toLocaleString('pt-BR')}</Text>
                    <Text size="xs" c="dimmed">Última atualização: {new Date(s.updated_at).toLocaleString('pt-BR')}</Text>
                    {s.last_event && <Text size="xs" c="dimmed">Último evento: {s.last_event}</Text>}
                  </div>
                </Group>
                <Group gap={16} mt={10} pt={10} style={{ borderTop: '1px solid var(--border)' }} wrap="wrap">
                  <Text size="xs" c="dimmed" ff="monospace">Cliente Asaas: {s.asaas_customer_id}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">Assinatura: {s.asaas_subscription_id}</Text>
                </Group>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <Text c="dimmed">Nenhum assinante ainda.</Text>
        </div>
      )}
    </div>
  );
}
