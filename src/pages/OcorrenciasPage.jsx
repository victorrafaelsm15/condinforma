import { useEffect, useState } from 'react';
import { Text, Group, Loader, Badge, Button, Image as MantineImage } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { ocorrenciasStore, ambientesStore, condominiosStore } from '../lib/stores';
import { reporterLabel } from '../lib/ocorrenciaDisplay';

export default function OcorrenciasPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [occs, ambientes, condominios] = await Promise.all([
      ocorrenciasStore.list(),
      ambientesStore.list(),
      condominiosStore.list(),
    ]);
    const ambienteMap = Object.fromEntries(ambientes.map((a) => [a.id, a]));
    const condMap = Object.fromEntries(condominios.map((c) => [c.id, c]));
    const enriched = occs.map((o) => {
      const amb = ambienteMap[o.ambiente_id];
      return {
        ...o,
        ambienteName: amb?.name || 'Ambiente removido',
        condominioName: amb ? condMap[amb.condominio_id]?.name : '',
      };
    });
    setList(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleResolve = async (id) => {
    await ocorrenciasStore.update(id, { status: 'resolvido' });
    load();
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
      <Group gap={12} mb="xl">
        <span className="icon-tile" style={{ background: 'var(--red-light)', width: 40, height: 40, borderRadius: 12 }}>
          <AlertTriangle size={19} color="var(--red)" />
        </span>
        <div>
          <Text fw={800} size="1.6rem">Ocorrências</Text>
          <Text size="md" c="dimmed" mt={2}>Problemas registrados em todos os condomínios</Text>
        </div>
      </Group>
      {list.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((o) => (
            <div key={o.id} className="surface-card" style={{ padding: 18 }}>
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Text size="sm" c="dimmed" fw={600}>{o.condominioName}, {o.ambienteName}</Text>
                  <Text size="md" mt={4}>{o.description}</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    {new Date(o.created_at).toLocaleString('pt-BR')}
                    {reporterLabel(o) && ` · ${reporterLabel(o)}`}
                  </Text>
                </div>
                <Badge color={o.status === 'resolvido' ? 'green' : 'red'} variant="light">{o.status}</Badge>
              </Group>
              {o.photo && <MantineImage src={o.photo} radius="md" mt="sm" h={160} w={160} fit="cover" />}
              {o.status !== 'resolvido' && (
                <Button size="xs" variant="light" color="green" mt="sm" onClick={() => handleResolve(o.id)}>
                  Marcar como resolvido
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <Text c="dimmed">Nenhuma ocorrência registrada em nenhum condomínio.</Text>
        </div>
      )}
    </div>
  );
}
