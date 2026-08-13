import { useEffect, useState } from 'react';
import { Text, Group, Loader } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { ocorrenciasStore, ambientesStore, condominiosStore } from '../lib/stores';
import OcorrenciaRow from '../components/admin/OcorrenciaRow';

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

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
      <Group justify="space-between" mb="xl" wrap="wrap">
        <Group gap={12}>
          <span className="icon-tile" style={{ background: 'var(--red-light)', width: 40, height: 40, borderRadius: 12 }}>
            <AlertTriangle size={19} color="var(--red)" />
          </span>
          <div>
            <Text fw={800} size="1.6rem">Ocorrências</Text>
            <Text size="md" c="dimmed" mt={2}>Problemas registrados em todos os condomínios</Text>
          </div>
        </Group>
        <Text size="sm" c="dimmed">Toque para ver detalhes</Text>
      </Group>
      {list.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((o) => (
            <OcorrenciaRow
              key={o.id}
              ocorrencia={o}
              locationLabel={`${o.condominioName}, ${o.ambienteName}`}
              to={`/admin/ambientes/${o.ambiente_id}/ocorrencias/${o.id}`}
            />
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
