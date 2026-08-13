import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Text, Group, Breadcrumbs, Loader, Button, ActionIcon, Badge, SimpleGrid, Image as MantineImage, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AlertTriangle, ArrowLeft, Trash2, Check } from 'lucide-react';
import { ambientesStore, condominiosStore, ocorrenciasStore, checklistItemsStore } from '../lib/stores';
import { logAudit } from '../lib/auditLog';
import { getSession } from '../lib/authService';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import InitialsAvatar from '../components/common/InitialsAvatar';

function reportedByFullLabel(o) {
  if (o.reported_by_role === 'morador') {
    const name = o.reporter_name?.trim() || 'Morador';
    return o.reporter_unidade?.trim() ? `${name} (Unidade ${o.reporter_unidade.trim()})` : name;
  }
  if (o.reported_by_role === 'colaborador') {
    return o.reporter_name?.trim() || 'Colaborador';
  }
  return 'Não informado';
}

// Moradores não têm login nem inscrição push própria (cada inscrição em
// push_subscriptions é do auth.uid() de quem está logado — ver
// pushSubscriptions.js) — o fluxo de reportar ocorrência é 100% anônimo.
// Por isso este campo só reflete a DECISÃO que o gestor tomou ao
// resolver, não confirma nenhuma entrega de fato pro morador específico.
function notificacaoCondominoLabel(o) {
  if (o.status !== 'resolvido') return 'Ainda não resolvida';
  if (o.reported_by_role !== 'morador') return 'Não aplicável (reportado por colaborador)';
  if (o.notificar_morador === true) {
    return o.morador_avisado_em
      ? `Morador avisado da solução em ${new Date(o.morador_avisado_em).toLocaleString('pt-BR')}`
      : 'Morador avisado da solução';
  }
  if (o.notificar_morador === false) return 'Morador não foi avisado (decisão do gestor)';
  return 'Não informado';
}

export default function OcorrenciaDetailPage() {
  const { ambienteId, ocorrenciaId } = useParams();
  const navigate = useNavigate();
  const [ambiente, setAmbiente] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [ocorrencia, setOcorrencia] = useState(null);
  const [relatedTask, setRelatedTask] = useState(null);
  const [isSubUsuario, setIsSubUsuario] = useState(false);
  const [loading, setLoading] = useState(true);

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    const [session, o] = await Promise.all([getSession(), ocorrenciasStore.getById(ocorrenciaId)]);
    if (session) {
      const subInfo = await getSubUsuarioInfo(session.user.id);
      setIsSubUsuario(!!subInfo);
    }
    setOcorrencia(o);
    if (o) {
      const [amb, item] = await Promise.all([
        ambientesStore.getById(o.ambiente_id),
        o.related_checklist_item_id ? checklistItemsStore.getById(o.related_checklist_item_id) : null,
      ]);
      setAmbiente(amb);
      setRelatedTask(item);
      if (amb) setCondominio(await condominiosStore.getById(amb.condominio_id));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ocorrenciaId]);

  const openResolveFlow = () => {
    if (ocorrencia.reported_by_role === 'morador') {
      setResolveModalOpen(true);
    } else {
      handleResolve(null);
    }
  };

  const handleResolve = async (notificarMorador) => {
    setResolving(true);
    try {
      await ocorrenciasStore.update(ocorrencia.id, {
        status: 'resolvido',
        notificar_morador: notificarMorador,
        morador_avisado_em: notificarMorador ? new Date().toISOString() : null,
      });
      logAudit({
        action: 'ocorrencia.resolvida',
        entityType: 'ocorrencia',
        entityId: ocorrencia.id,
        details: { code: ocorrencia.code, notificar_morador: notificarMorador },
      });
      notifications.show({ color: 'green', message: 'Ocorrência marcada como resolvida.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível resolver a ocorrência.' });
    } finally {
      setResolving(false);
      setResolveModalOpen(false);
      load();
    }
  };

  const handleDelete = async () => {
    setRemoving(true);
    try {
      await ocorrenciasStore.remove(ocorrencia.id);
      logAudit({ action: 'ocorrencia.excluida', entityType: 'ocorrencia', entityId: ocorrencia.id, details: { description: ocorrencia.description } });
      notifications.show({ color: 'green', message: 'Ocorrência excluída.' });
      navigate(`/admin/ambientes/${ambienteId}`);
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir a ocorrência.' });
      setRemoving(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;
  if (!ocorrencia || !ambiente) return <Text>Ocorrência não encontrada.</Text>;

  const isPendente = ocorrencia.status !== 'resolvido';

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to={`/admin/ambientes/${ambienteId}`} variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar para o ambiente">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Link to={`/admin/condominios/${ambiente.condominio_id}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Ambientes</Link>
          <Link to={`/admin/ambientes/${ambienteId}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{ambiente.name}</Link>
          <Link to={`/admin/ambientes/${ambienteId}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Ocorrências</Link>
          <Text size="md" fw={600}>{ocorrencia.code}</Text>
        </Breadcrumbs>
      </Group>

      <Group gap={12} mb="lg" justify="space-between" wrap="wrap">
        <Group gap={12} style={{ background: isPendente ? 'var(--red)' : 'var(--green)', borderRadius: 999, padding: '10px 24px 10px 12px' }}>
          <span style={{
            width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <AlertTriangle size={19} color="#fff" />
          </span>
          <div>
            <Text fw={800} size="1.5rem" className="font-display" c="#fff" lh={1.2}>{ocorrencia.code}</Text>
            <Text size="sm" fw={600} c="rgba(255,255,255,0.85)">{isPendente ? 'Pendente' : 'Resolvido'}</Text>
          </div>
        </Group>
        {!isSubUsuario && (
          <ActionIcon variant="light" color="red" radius="xl" size="lg" onClick={() => setDeleteOpen(true)} aria-label="Excluir ocorrência">
            <Trash2 size={17} />
          </ActionIcon>
        )}
      </Group>

      <div className="surface-card" style={{ padding: 24, marginBottom: 20 }}>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={10} style={{ letterSpacing: '0.05em' }}>Descrição</Text>
        <Text size="lg" fw={600}>{ocorrencia.description}</Text>
      </div>

      <div className="surface-card" style={{ padding: 24, marginBottom: 20 }}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Data e hora</Text>
            <Text size="md">{new Date(ocorrencia.created_at).toLocaleString('pt-BR')}</Text>
          </div>
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Reportado por</Text>
            <Group gap={10}>
              <InitialsAvatar name={ocorrencia.reporter_name || ocorrencia.reported_by_role} size={32} />
              <Text size="md">{reportedByFullLabel(ocorrencia)}</Text>
            </Group>
          </div>
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Relacionado ao checklist</Text>
            {relatedTask ? (
              <Text size="md">{relatedTask.task}</Text>
            ) : (
              <Text size="md" c="dimmed" fs="italic">Nenhum item vinculado — esta ocorrência ainda não foi associada a um item do checklist.</Text>
            )}
          </div>
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Notificação ao condômino</Text>
            <Text size="md">{notificacaoCondominoLabel(ocorrencia)}</Text>
          </div>
        </SimpleGrid>
      </div>

      <div className="surface-card" style={{ padding: 24, marginBottom: 20 }}>
        <Text fw={700} size="md" mb={14}>Foto anexada</Text>
        {ocorrencia.photo ? (
          <MantineImage src={ocorrencia.photo} alt={`Foto anexada à ocorrência ${ocorrencia.code}`} radius="md" h={220} w={220} fit="cover" />
        ) : (
          <Text size="sm" c="dimmed">Nenhuma foto anexada a esta ocorrência.</Text>
        )}
      </div>

      {isPendente && (
        <div className="surface-card" style={{ padding: 24 }}>
          <Text size="sm" c="dimmed" mb={14}>Ao resolver, você decide se o morador é avisado da solução.</Text>
          <Button fullWidth color="green" size="md" leftSection={<Check size={18} />} onClick={openResolveFlow} loading={resolving}>
            Marcar como resolvido
          </Button>
        </div>
      )}

      <Modal opened={resolveModalOpen} onClose={() => setResolveModalOpen(false)} title="Avisar o morador?">
        <Text size="sm" c="dimmed" mb="lg">
          Esta ocorrência foi reportada por um morador. Isso registra sua decisão — o morador não tem cadastro no app, então ainda não existe um canal automático de aviso direto pra ele.
        </Text>
        <Group gap={8} justify="flex-end">
          <Button variant="default" onClick={() => handleResolve(false)} loading={resolving}>Não avisar</Button>
          <Button color="green" onClick={() => handleResolve(true)} loading={resolving}>Sim, avisar</Button>
        </Group>
      </Modal>

      <ConfirmDeleteModal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        itemLabel={`a ocorrência "${ocorrencia.code}"`}
        loading={removing}
      />
    </div>
  );
}
