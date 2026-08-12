import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Text, Group, Breadcrumbs, Loader, TextInput, Textarea, Button, ActionIcon, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Trash2, ArrowLeft, Check, RotateCcw, AlertTriangle, MessageSquare, Send } from 'lucide-react';
import {
  ambientesStore, condominiosStore, checklistItemsStore, checklistPeriodosStore, checklistItemComentariosStore, ocorrenciasStore,
} from '../lib/stores';
import { logAudit } from '../lib/auditLog';
import { getSession } from '../lib/authService';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';

export default function ChecklistItemPage() {
  const { ambienteId, itemId } = useParams();
  const navigate = useNavigate();
  const [ambiente, setAmbiente] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [item, setItem] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingTask, setEditingTask] = useState(false);
  const [taskValue, setTaskValue] = useState('');
  const [descricaoValue, setDescricaoValue] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [novoComentario, setNovoComentario] = useState('');
  const [sendingComentario, setSendingComentario] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    const session = await getSession();
    setUserEmail(session?.user?.email || '');
    const i = await checklistItemsStore.getById(itemId);
    setItem(i);
    if (i) {
      const [amb, per, occs, coms] = await Promise.all([
        ambientesStore.getById(i.ambiente_id),
        checklistPeriodosStore.getById(i.checklist_periodo_id),
        ocorrenciasStore.list({ ambiente_id: i.ambiente_id }),
        checklistItemComentariosStore.list({ checklist_item_id: i.id }),
      ]);
      setAmbiente(amb);
      if (amb) setCondominio(await condominiosStore.getById(amb.condominio_id));
      setPeriodo(per);
      setOcorrencias(occs.filter((o) => o.related_checklist_item_id === i.id));
      setComentarios(coms);
      setTaskValue(i.task);
      setDescricaoValue(i.descricao || '');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [itemId]);

  const isAtivo = periodo?.status === 'ativo';

  const handleSaveTask = async () => {
    if (!taskValue.trim()) return;
    setSavingTask(true);
    const before = item.task;
    await checklistItemsStore.update(item.id, { task: taskValue.trim(), descricao: descricaoValue.trim() || null });
    logAudit({ action: 'checklist.item_editado', entityType: 'checklist_item', entityId: item.id, details: { antes: before, depois: taskValue.trim() } });
    setSavingTask(false);
    setEditingTask(false);
    load();
  };

  const handleToggleStatus = async () => {
    setTogglingStatus(true);
    const novoStatus = item.status === 'concluido' ? 'pendente' : 'concluido';
    const payload = novoStatus === 'concluido'
      ? { status: novoStatus, resolvido_por: userEmail || null, resolvido_em: new Date().toISOString() }
      : { status: novoStatus, resolvido_por: null, resolvido_em: null };
    await checklistItemsStore.update(item.id, payload);
    logAudit({ action: 'checklist.item_status_alterado', entityType: 'checklist_item', entityId: item.id, details: { task: item.task, status: novoStatus } });
    setTogglingStatus(false);
    load();
  };

  const handleDelete = async () => {
    setRemoving(true);
    try {
      await checklistItemsStore.remove(item.id);
      logAudit({ action: 'checklist.item_excluido', entityType: 'checklist_item', entityId: item.id, details: { task: item.task } });
      notifications.show({ color: 'green', message: 'Item excluído.' });
      navigate(`/admin/ambientes/${ambienteId}`);
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir esse item.' });
      setRemoving(false);
      setDeleteOpen(false);
    }
  };

  const handleSendComentario = async () => {
    if (!novoComentario.trim()) return;
    setSendingComentario(true);
    await checklistItemComentariosStore.create({
      checklist_item_id: item.id,
      ambiente_id: item.ambiente_id,
      account_id: item.account_id,
      autor: userEmail || 'Gestor',
      texto: novoComentario.trim(),
    });
    setNovoComentario('');
    setSendingComentario(false);
    load();
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;
  if (!item || !ambiente) return <Text>Item não encontrado.</Text>;

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to={`/admin/ambientes/${ambienteId}`} variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar para o ambiente">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Link to={`/admin/condominios/${ambiente.condominio_id}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{condominio?.name || 'Condomínio'}</Link>
          <Link to={`/admin/ambientes/${ambienteId}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{ambiente.name}</Link>
          <Text size="md" fw={600}>{item.task}</Text>
        </Breadcrumbs>
      </Group>

      <div className="surface-card" style={{ padding: 22, marginBottom: 18 }}>
        <Group justify="space-between" mb={12} wrap="wrap" gap={8}>
          <Badge color={item.status === 'concluido' ? 'green' : 'yellow'} variant="light" size="lg">
            {item.status === 'concluido' ? 'Concluído' : 'Pendente'}
          </Badge>
          {!isAtivo && <Badge color="gray" variant="light">Período fechado — somente leitura</Badge>}
        </Group>

        {editingTask ? (
          <>
            <TextInput label="Tarefa" value={taskValue} onChange={(e) => setTaskValue(e.currentTarget.value)} mb="sm" data-autofocus />
            <Textarea label="Descrição (opcional)" value={descricaoValue} onChange={(e) => setDescricaoValue(e.currentTarget.value)} minRows={2} mb="md" />
            <Group gap={8}>
              <Button size="sm" onClick={handleSaveTask} loading={savingTask}>Salvar</Button>
              <Button size="sm" variant="light" color="gray" onClick={() => { setEditingTask(false); setTaskValue(item.task); setDescricaoValue(item.descricao || ''); }}>
                Cancelar
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text fw={800} size="1.4rem" className="font-display" mb={6}>{item.task}</Text>
            {item.descricao && <Text size="sm" c="dimmed" mb={10}>{item.descricao}</Text>}
            {isAtivo && (
              <Button size="xs" variant="subtle" onClick={() => setEditingTask(true)} mb={10} p={0}>Editar tarefa</Button>
            )}
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {item.criado_por && <Text size="xs" c="dimmed">Criado por {item.criado_por} em {new Date(item.created_at).toLocaleString('pt-BR')}</Text>}
          {item.resolvido_por && <Text size="xs" c="dimmed">Concluído por {item.resolvido_por} em {new Date(item.resolvido_em).toLocaleString('pt-BR')}</Text>}
        </div>

        {isAtivo && (
          <Group gap={8} mt="lg">
            <Button
              leftSection={item.status === 'concluido' ? <RotateCcw size={15} /> : <Check size={15} />}
              color={item.status === 'concluido' ? 'gray' : 'green'}
              onClick={handleToggleStatus}
              loading={togglingStatus}
            >
              {item.status === 'concluido' ? 'Reabrir como pendente' : 'Marcar como concluído'}
            </Button>
            <ActionIcon variant="light" color="red" radius="xl" size="lg" onClick={() => setDeleteOpen(true)} aria-label="Excluir item">
              <Trash2 size={17} />
            </ActionIcon>
          </Group>
        )}
      </div>

      {!!ocorrencias.length && (
        <div className="surface-card" style={{ padding: 20, marginBottom: 18, borderColor: 'rgba(239,68,68,0.25)' }}>
          <Group gap={8} mb={12}>
            <AlertTriangle size={16} color="var(--red)" />
            <Text fw={700} size="sm">Ocorrências vinculadas a este item</Text>
          </Group>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ocorrencias.map((o) => (
              <div key={o.id} style={{ padding: 10, borderRadius: 8, background: 'var(--red-light)' }}>
                <Group gap={8} mb={4}>
                  <Badge size="xs" color={o.status === 'resolvido' ? 'green' : 'red'} variant="light">
                    {o.status === 'resolvido' ? 'Resolvida' : 'Pendente'}
                  </Badge>
                  {o.code && <Text size="xs" c="dimmed">{o.code}</Text>}
                </Group>
                <Text size="sm">{o.description}</Text>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="surface-card" style={{ padding: 20 }}>
        <Group gap={8} mb={14}>
          <MessageSquare size={16} color="var(--blue)" />
          <Text fw={700} size="sm">Comentários</Text>
        </Group>
        {comentarios.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {comentarios.map((c) => (
              <div key={c.id} style={{ padding: 10, borderRadius: 8, background: '#f5f6fc' }}>
                <Text size="xs" fw={700} c="dimmed">{c.autor || 'Gestor'} — {new Date(c.created_at).toLocaleString('pt-BR')}</Text>
                <Text size="sm" mt={2}>{c.texto}</Text>
              </div>
            ))}
          </div>
        ) : (
          <Text size="sm" c="dimmed" mb={14}>Nenhum comentário ainda.</Text>
        )}
        <Group gap={8} align="flex-end">
          <TextInput
            placeholder="Escreva um comentário"
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendComentario()}
            style={{ flex: 1 }}
          />
          <Button leftSection={<Send size={15} />} onClick={handleSendComentario} loading={sendingComentario}>Enviar</Button>
        </Group>
      </div>

      <ConfirmDeleteModal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        itemLabel={`o item "${item.task}"`}
        loading={removing}
      />
    </div>
  );
}
