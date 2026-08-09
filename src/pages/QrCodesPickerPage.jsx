import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Text, Group, Loader, SimpleGrid } from '@mantine/core';
import { Building2, ChevronRight, QrCode as QrCodeIcon } from 'lucide-react';
import { condominiosStore } from '../lib/stores';

// Tela intermediária: QR Codes hoje são vistos por condomínio (ver
// QrCodesCondominioPage.jsx), não existe uma visão global — o jeito mais
// simples de dar um item de sidebar pra isso é pedir pra escolher o
// condomínio primeiro, reaproveitando a mesma lista (já filtrada por RLS,
// igual o AdminDashboard) e mandando pra rota que já existe.
export default function QrCodesPickerPage() {
  const [loading, setLoading] = useState(true);
  const [condominios, setCondominios] = useState([]);

  useEffect(() => {
    condominiosStore.list().then((list) => {
      setCondominios(list);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Text fw={800} size="1.6rem" className="font-display">QR Codes</Text>
        <Text size="md" c="dimmed" mt={2}>Selecione um condomínio para ver e imprimir os QR Codes dos ambientes.</Text>
      </div>

      {loading ? (
        <Group justify="center" py={60}><Loader color="brand" /></Group>
      ) : condominios.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {condominios.map((c) => (
            <Link key={c.id} to={`/admin/condominios/${c.id}/qrcodes`} className="surface-card surface-card--hover" style={{ display: 'block', padding: 22 }}>
              <Group justify="space-between">
                <Group gap={12}>
                  <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
                    <Building2 size={19} color="var(--blue)" />
                  </span>
                  <Text fw={700} size="md">{c.name}</Text>
                </Group>
                <ChevronRight size={18} color="var(--text-faint)" />
              </Group>
              <Text size="sm" c="dimmed" mt={12}>Ver QR Codes dos ambientes</Text>
            </Link>
          ))}
        </SimpleGrid>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px' }}>
            <QrCodeIcon size={24} color="var(--blue)" />
          </span>
          <Text c="dimmed">Nenhum condomínio cadastrado ainda.</Text>
        </div>
      )}
    </div>
  );
}
