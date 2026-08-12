import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Text, Group, Breadcrumbs, Loader, TextInput, Textarea, Button, ActionIcon, Badge,
  Select, FileButton, Image as MantineImage, SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Trash2, ArrowLeft, Check, RotateCcw, AlertTriangle, MessageSquare, Send, Pencil, Camera, X, Search } from 'lucide-react';
import {
  ambientesStore, condominiosStore, checklistItemsStore, checklistPeriodosStore, checklistItemComentariosStore, ocorrenciasStore,
} from '../lib/stores';
import { logAudit } from '../lib/auditLog';
import { getSession } from '../lib/authService';
import { listSubUsuarios } from '../lib/subUsuario';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import InitialsAvatar from '../components/common/InitialsAvatar';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChecklistItemPage() {
  const { ambienteId, itemId } = useParams();
  const navigate = useNavigate();
  const [ambiente, setAmbiente] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [item, setItem] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [allOcorrencias, setAllOcorrencias] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingTask, setEditingTask] = useState(false);
  const [taskValue, setTaskValue] = useState('');
  const [descricaoValue, setDescricaoValue] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [novoComentario, setNovoComentario] = useState('');
  const [sendingComentario, setSendingComentario] = useState(false);

  const [searchOcorrencia, setSearchOcorrencia] = useState('');
  const [linkingId, setLinkingId] = useState(null);
  const [unlinkingId, setUnlinkingId] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    const [session, i] = await Promise.all([getSession(), checklistItemsStore.getById(itemId)]);
    setUserEmail(session?.user?.email || '');
    setItem(i);
    if (i) {
      const [amb, per, occs, coms] = await Promise.all([
        ambientesStore.getById(i.ambiente_id),
        checklistPeriodosStore.getById(i.checklist_periodo_id),
        ocorrenciasStore.list({ ambiente_id: i.ambiente_id }),
        checklistItemComentariosStore.list({ checklist_item_id: i.id }),
      ]);
      setAmbiente(amb);
      setPeriodo(per);
      setAllOcorrencias(occs);
      setComentarios(coms);
      setTaskValue(i.task);
      setDescricaoValue(i.descricao || '');
      if (amb) {
        const [cond, subs] = await Promise.all([
          condominiosStore.getById(amb.condominio_id),
          listSubUsuarios(i.account_id),
        ]);
        setCondominio(cond);
        const relevantSubs = subs.filter((s) => s.condominioIds.includes(amb.condominio_id));
        const opts = relevantSubs.map((s) => ({ value: s.nome, label: s.nome }));
        if (session?.user?.email) opts.unshift({ value: session.user.email, label: `Eu (${session.user.email})` });
        setAssigneeOptions(opts);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [itemId]);

  const isAtivo = periodo?.status === 'ativo';
  const linkedOcorrencias = allOcorrencias.filter((o) => o.related_checklist_item_id === item?.id);
  const searchQuery = searchOcorrencia.trim().toLowerCase();
  const matchingOcorrencias = searchQuery
    ? allOcorrencias
      .filter((o) => o.related_checklist_item_id !== item?.id)
      .filter((o) => o.code?.toLowerCase().includes(searchQuery) || o.description.toLowerCase().includes(searchQuery))
      .slice(0, 5)
    : [];

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

  const handleAssign = async (value) => {
    await checklistItemsStore.update(item.id, { atribuido_a: value || null });
    logAudit({ action: 'checklist.item_atribuido', entityType: 'checklist_item', entityId: item.id, details: { task: item.task, atribuido_a: value } });
    load();
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    const base64 = await fileToBase64(file);
    await checklistItemsStore.update(item.id, { foto: base64 });
    setUploadingPhoto(false);
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

  const handleLinkOcorrencia = async (ocorrenciaId) => {
    setLinkingId(ocorrenciaId);
    try {
      await ocorrenciasStore.update(ocorrenciaId, { related_checklist_item_id: item.id });
      logAudit({ action: 'ocorrencia.vinculada_item', entityType: 'ocorrencia', entityId: ocorrenciaId, details: { item: item.task } });
      setSearchOcorrencia('');
    } finally {
      setLinkingId(null);
      load();
    }
  };

  const handleUnlinkOcorrencia = async (ocorrenciaId) => {
    setUnlinkingId(ocorrenciaId);
    try {
      await ocorrenciasStore.update(ocorrenciaId, { related_checklist_item_id: null });
      logAudit({ action: 'ocorrencia.desvinculada_item', entityType: 'ocorrencia', entityId: ocorrenciaId, details: { item: item.task } });
    } finally {
      setUnlinkingId(null);
      load();
    }
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

      <div className="surface-card" style={{ padding: 26, marginBottom: 20 }}>
        <Group justify="space-between" mb={18} wrap="wrap" gap={10}>
          <Badge color={item.status === 'concluido' ? 'green' : 'yellow'} variant="light" size="lg">
            {item.status === 'concluido' ? 'Concluído' : 'Pendente'}
          </Badge>
          <Group gap={8} wrap="wrap">
            <Badge color="blue" variant="light" size="lg">{periodo?.nome}</Badge>
            {!isAtivo && <Badge color="gray" variant="light" size="lg">Somente leitura</Badge>}
          </Group>
        </Group>

        <Group justify="space-between" align="flex-start" gap={12} mb={20}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingTask ? (
              <>
                <TextInput label="Tarefa" value={taskValue} onChange={(e) => setTaskValue(e.currentTarget.value)} mb="sm" size="md" data-autofocus />
                <Textarea label="Descrição (opcional)" value={descricaoValue} onChange={(e) => setDescricaoValue(e.currentTarget.value)} minRows={3} mb="md" size="md" />
                <Group gap={8}>
                  <Button onClick={handleSaveTask} loading={savingTask}>Salvar</Button>
                  <Button variant="light" color="gray" onClick={() => { setEditingTask(false); setTaskValue(item.task); setDescricaoValue(item.descricao || ''); }}>
                    Cancelar
                  </Button>
                </Group>
              </>
            ) : (
              <>
                <Text fw={800} size="1.6rem" className="font-display" mb={8}>{item.task}</Text>
                {item.descricao ? (
                  <Text size="md" c="dimmed">{item.descricao}</Text>
                ) : (
                  <Text size="md" c="dimmed" fs="italic">Sem descrição detalhada.</Text>
                )}
              </>
            )}
          </div>
          {isAtivo && !editingTask && (
            <Group gap={8}>
              <ActionIcon variant="light" color="gray" radius="xl" size="lg" onClick={() => setEditingTask(true)} aria-label="Editar item">
                <Pencil size={17} />
              </ActionIcon>
              <ActionIcon variant="light" color="red" radius="xl" size="lg" onClick={() => setDeleteOpen(true)} aria-label="Excluir item">
                <Trash2 size={17} />
              </ActionIcon>
            </Group>
          )}
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mb={isAtivo ? 22 : 0} style={{ paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Criado por</Text>
            <Group gap={10}>
              <InitialsAvatar name={item.criado_por} size={32} />
              <Text size="md">{item.criado_por || 'Desconhecido'}</Text>
            </Group>
          </div>
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Criado em</Text>
            <Text size="md">{new Date(item.created_at).toLocaleString('pt-BR')}</Text>
          </div>
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Resolvendo (neste período)</Text>
            {isAtivo ? (
              <Select
                placeholder="Ninguém atribuído"
                data={assigneeOptions}
                value={item.atribuido_a || null}
                onChange={handleAssign}
                clearable
                searchable
                size="md"
              />
            ) : (
              <Group gap={10}>
                {item.atribuido_a && <InitialsAvatar name={item.atribuido_a} size={32} />}
                <Text size="md">{item.atribuido_a || 'Ninguém atribuído'}</Text>
              </Group>
            )}
          </div>
          <div>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>Resolvido em</Text>
            <Text size="md">{item.resolvido_em ? new Date(item.resolvido_em).toLocaleString('pt-BR') : 'Ainda não resolvido'}</Text>
          </div>
        </SimpleGrid>

        {isAtivo && (
          <Button
            leftSection={item.status === 'concluido' ? <RotateCcw size={16} /> : <Check size={16} />}
            color={item.status === 'concluido' ? 'gray' : 'green'}
            onClick={handleToggleStatus}
            loading={togglingStatus}
            size="md"
          >
            {item.status === 'concluido' ? 'Reabrir como pendente' : 'Marcar como concluído'}
          </Button>
        )}
      </div>

      <div className="surface-card" style={{ padding: 24, marginBottom: 20 }}>
        <Text fw={700} size="md" mb={14}>Foto da execução</Text>
        {item.foto ? (
          <MantineImage src={item.foto} radius="md" h={180} w={180} fit="cover" mb={isAtivo ? 14 : 0} />
        ) : (
          <Text size="sm" c="dimmed" mb={isAtivo ? 14 : 0}>Nenhuma foto anexada ainda.</Text>
        )}
        {isAtivo && (
          <FileButton onChange={handlePhoto} accept="image/*">
            {(props) => (
              <Button {...props} variant="light" leftSection={<Camera size={16} />} loading={uploadingPhoto}>
                {item.foto ? 'Trocar foto' : 'Anexar foto'}
              </Button>
            )}
          </FileButton>
        )}
      </div>

      <div className="surface-card" style={{ padding: 24, marginBottom: 20 }}>
        <Group gap={8} mb={16}>
          <AlertTriangle size={18} color="var(--red)" />
          <Text fw={700} size="md">Ocorrências vinculadas</Text>
        </Group>

        {linkedOcorrencias.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: isAtivo ? 18 : 0 }}>
            {linkedOcorrencias.map((o) => (
              <div key={o.id} style={{ padding: 14, borderRadius: 10, background: 'var(--red-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <Group gap={8} mb={4}>
                    <Badge size="sm" color={o.status === 'resolvido' ? 'green' : 'red'} variant="light">
                      {o.status === 'resolvido' ? 'Resolvida' : 'Pendente'}
                    </Badge>
                    {o.code && <Text size="sm" fw={700} c="dimmed">{o.code}</Text>}
                  </Group>
                  <Text size="md">{o.description}</Text>
                </div>
                {isAtivo && (
                  <ActionIcon variant="subtle" color="red" onClick={() => handleUnlinkOcorrencia(o.id)} loading={unlinkingId === o.id} aria-label="Desvincular ocorrência">
                    <X size={17} />
                  </ActionIcon>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Text size="sm" c="dimmed" mb={isAtivo ? 18 : 0}>Nenhuma ocorrência vinculada.</Text>
        )}

        {isAtivo && (
          <>
            <TextInput
              placeholder="Buscar ocorrência para vincular (código ou descrição)"
              leftSection={<Search size={15} />}
              value={searchOcorrencia}
              onChange={(e) => setSearchOcorrencia(e.currentTarget.value)}
              size="md"
            />
            {searchQuery && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {matchingOcorrencias.length ? matchingOcorrencias.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => handleLinkOcorrencia(o.id)}
                    disabled={linkingId === o.id}
                    className="surface-card surface-card--hover"
                    style={{ textAlign: 'left', padding: 12, border: 'none', cursor: 'pointer', background: 'transparent' }}
                  >
                    <Text size="sm" fw={700} c="dimmed">{o.code || 'Sem código'}</Text>
                    <Text size="md">{o.description}</Text>
                  </button>
                )) : <Text size="sm" c="dimmed">Nenhuma ocorrência encontrada.</Text>}
              </div>
            )}
          </>
        )}
      </div>

      <div className="surface-card" style={{ padding: 24 }}>
        <Group gap={8} mb={18}>
          <MessageSquare size={18} color="var(--blue)" />
          <Text fw={700} size="md">Observações e comentários</Text>
        </Group>
        {comentarios.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: isAtivo ? 20 : 0 }}>
            {comentarios.map((c) => (
              <Group key={c.id} align="flex-start" gap={12} wrap="nowrap">
                <InitialsAvatar name={c.autor} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={10} wrap="wrap">
                    <Text size="md" fw={700}>{c.autor || 'Gestor'}</Text>
                    <Text size="sm" c="dimmed">{new Date(c.created_at).toLocaleString('pt-BR')}</Text>
                  </Group>
                  <Text size="md" mt={2}>{c.texto}</Text>
                </div>
              </Group>
            ))}
          </div>
        ) : (
          <Text size="sm" c="dimmed" mb={isAtivo ? 20 : 0}>Nenhum comentário ainda.</Text>
        )}
        {isAtivo && (
          <Group gap={8} align="flex-end">
            <TextInput
              placeholder="Escreva um comentário"
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendComentario()}
              style={{ flex: 1 }}
              size="md"
            />
            <Button leftSection={<Send size={16} />} onClick={handleSendComentario} loading={sendingComentario}>Enviar</Button>
          </Group>
        )}
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
