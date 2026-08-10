import { useEffect, useState } from 'react';
import { Text, Group, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AlertTriangle } from 'lucide-react';
import { ocorrenciasStore, ambientesStore, condominiosStore, checklistItemsStore } from '../lib/stores';
import { getSession } from '../lib/authService';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import { logAudit } from '../lib/auditLog';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import OcorrenciaCard from '../components/admin/OcorrenciaCard';

export default function OcorrenciasPage() {
  const [list, setList] = useState([]);
  const [itemsById, setItemsById] = useState({});
  const [isSubUsuario, setIsSubUsuario] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    setLoading(true);
    const session = await getSession();
    if (session) {
      const subInfo = await getSubUsuarioInfo(session.user.id);
      setIsSubUsuario(!!subInfo);
    }
    const [occs, ambientes, condominios, checklistItems] = await Promise.all([
      ocorrenciasStore.list(),
      ambientesStore.list(),
      condominiosStore.list(),
      checklistItemsStore.list(),
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
    setItemsById(Object.fromEntries(checklistItems.map((i) => [i.id, i.task])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleResolve = async (id) => {
    setResolvingId(id);
    try {
      await ocorrenciasStore.update(id, { status: 'resolvido' });
      load();
    } finally {
      setResolvingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await ocorrenciasStore.remove(deleting.id);
      logAudit({ action: 'ocorrencia.excluida', entityType: 'ocorrencia', entityId: deleting.id, details: { description: deleting.description } });
      notifications.show({ color: 'green', message: 'Ocorrência excluída.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir a ocorrência.' });
    } finally {
      setRemoving(false);
      setDeleting(null);
      load();
    }
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
            <OcorrenciaCard
              key={o.id}
              ocorrencia={o}
              locationLabel={`${o.condominioName}, ${o.ambienteName}`}
              relatedTask={o.related_checklist_item_id ? itemsById[o.related_checklist_item_id] : null}
              onResolve={o.status !== 'resolvido' ? () => handleResolve(o.id) : undefined}
              resolving={resolvingId === o.id}
              onDelete={!isSubUsuario ? () => setDeleting(o) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <Text c="dimmed">Nenhuma ocorrência registrada em nenhum condomínio.</Text>
        </div>
      )}

      <ConfirmDeleteModal
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        itemLabel="esta ocorrência"
        loading={removing}
      />
    </div>
  );
}
