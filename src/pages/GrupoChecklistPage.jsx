import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Text, Group, Breadcrumbs, Loader, TextInput, Button, ActionIcon, Tabs, Badge, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Trash2, ClipboardList, History, ArrowLeft, Check, X, Pencil, Plus, FolderKanban } from 'lucide-react';
import { ambientesStore, condominiosStore, checklistGruposStore, checklistItemsStore, ocorrenciasStore } from '../lib/stores';
import { logAudit } from '../lib/auditLog';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import HistoryTab from '../components/admin/HistoryTab';

export default function GrupoChecklistPage() {
  const { ambienteId, grupoId } = useParams();
  const navigate = useNavigate();
  const [ambiente, setAmbiente] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [grupo, setGrupo] = useState(null);
  const [items, setItems] = useState([]);
  const [pendingCountByItem, setPendingCountByItem] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('itens');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [newTask, setNewTask] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const load = async () => {
    const g = await checklistGruposStore.getById(grupoId);
    setGrupo(g);
    if (g) {
      const [amb, itemsList, pendentes] = await Promise.all([
        ambientesStore.getById(g.ambiente_id),
        checklistItemsStore.list({ checklist_grupo_id: grupoId }),
        ocorrenciasStore.list({ ambiente_id: g.ambiente_id, status: 'pendente' }),
      ]);
      setAmbiente(amb);
      if (amb) setCondominio(await condominiosStore.getById(amb.condominio_id));
      setItems(itemsList.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      const counts = {};
      pendentes.forEach((o) => {
        if (o.related_checklist_item_id) counts[o.related_checklist_item_id] = (counts[o.related_checklist_item_id] || 0) + 1;
      });
      setPendingCountByItem(counts);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [grupoId]);

  const handleToggleStatus = async () => {
    const novoStatus = grupo.status === 'ativo' ? 'inativo' : 'ativo';
    await checklistGruposStore.update(grupo.id, { status: novoStatus });
    logAudit({ action: 'checklist_grupo.status_alterado', entityType: 'checklist_grupo', entityId: grupo.id, details: { nome: grupo.nome, status: novoStatus } });
    load();
  };

  const handleDelete = async () => {
    setRemoving(true);
    try {
      // Itens desse grupo saem junto (on delete cascade); execuções
      // antigas ficam preservadas, só perdem a referência ao grupo
      // (on delete set null — ver schema.sql).
      await checklistGruposStore.remove(grupo.id);
      logAudit({ action: 'checklist_grupo.excluido', entityType: 'checklist_grupo', entityId: grupo.id, details: { nome: grupo.nome } });
      notifications.show({ color: 'green', message: `Grupo "${grupo.nome}" excluído.` });
      navigate(`/admin/ambientes/${ambienteId}`);
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir esse grupo.' });
      setRemoving(false);
      setDeleteOpen(false);
    }
  };

  const handleAdd = async () => {
    if (!newTask.trim()) return;
    setAdding(true);
    // account_id copiado do ambiente (não da sessão) — quem cria pode ser
    // um sub-usuário, cujo próprio account_id não é o dono real do ambiente.
    const created = await checklistItemsStore.create({
      ambiente_id: grupo.ambiente_id, checklist_grupo_id: grupo.id, task: newTask.trim(), order_index: items.length, account_id: grupo.account_id,
    });
    logAudit({ action: 'checklist.item_criado', entityType: 'checklist_item', entityId: created.id, details: { task: created.task, grupo: grupo.nome } });
    setNewTask('');
    setAdding(false);
    load();
  };

  const handleRemove = async (id, task) => {
    await checklistItemsStore.remove(id);
    logAudit({ action: 'checklist.item_excluido', entityType: 'checklist_item', entityId: id, details: { task, grupo: grupo.nome } });
    load();
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.task);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editValue.trim()) return;
    const before = items.find((i) => i.id === editingId);
    await checklistItemsStore.update(editingId, { task: editValue.trim() });
    logAudit({ action: 'checklist.item_editado', entityType: 'checklist_item', entityId: editingId, details: { antes: before?.task, depois: editValue.trim(), grupo: grupo.nome } });
    setEditingId(null);
    setEditValue('');
    load();
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;
  if (!grupo || !ambiente) return <Text>Grupo não encontrado.</Text>;

  const isAtivo = grupo.status === 'ativo';

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to={`/admin/ambientes/${ambienteId}`} variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar para o ambiente">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Link to={`/admin/condominios/${ambiente.condominio_id}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{condominio?.name || 'Condomínio'}</Link>
          <Link to={`/admin/condominios/${ambiente.condominio_id}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Ambientes</Link>
          <Link to={`/admin/ambientes/${ambienteId}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{ambiente.name}</Link>
          <Text size="md" fw={600}>{grupo.nome}</Text>
        </Breadcrumbs>
      </Group>

      <Group gap={12} mb="lg" justify="space-between" wrap="wrap">
        <Group gap={10} style={{ background: 'var(--blue)', borderRadius: 999, padding: '8px 20px 8px 10px' }}>
          <span style={{
            width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <FolderKanban size={17} color="#fff" />
          </span>
          <Text fw={800} size="1.6rem" className="font-display" c="#fff" lh={1.2}>{grupo.nome}</Text>
        </Group>
        <Group gap={12}>
          <Badge color={isAtivo ? 'green' : 'gray'} variant="light" size="lg">{isAtivo ? 'Ativo' : 'Inativo'}</Badge>
          <Switch
            checked={isAtivo}
            onChange={handleToggleStatus}
            color="green"
            aria-label={`Ativar ou desativar o grupo ${grupo.nome}`}
          />
          <ActionIcon variant="light" color="red" radius="xl" size="lg" onClick={() => setDeleteOpen(true)} aria-label="Excluir grupo">
            <Trash2 size={17} />
          </ActionIcon>
        </Group>
      </Group>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          tab: { fontWeight: 600, fontSize: 14, borderRadius: 999, border: 'none', padding: '9px 18px', transition: 'all 0.2s var(--ease)' },
          list: { border: 'none', gap: 8, flexWrap: 'wrap' },
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="itens"
            leftSection={<ClipboardList size={15} />}
            style={{ background: activeTab === 'itens' ? 'var(--green)' : 'var(--green-light)', color: activeTab === 'itens' ? '#fff' : 'var(--green)' }}
          >
            Itens
          </Tabs.Tab>
          <Tabs.Tab
            value="historico"
            leftSection={<History size={15} />}
            style={{ background: activeTab === 'historico' ? '#6b7280' : '#eef0f3', color: activeTab === 'historico' ? '#fff' : '#6b7280' }}
          >
            Histórico
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="itens" pt="lg">
          <Text size="xs" c="dimmed" mb="md">
            Edite os itens aqui só para corrigir este grupo. Pra mudar a rotina de verdade, crie um novo grupo — assim o histórico de execuções antigas continua íntegro.
          </Text>

          {items.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {items.map((item, i) => {
                const isEditing = editingId === item.id;
                const pendingCount = pendingCountByItem[item.id] || 0;
                return (
                  <div key={item.id} className="surface-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Group gap={12} style={{ flex: 1 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 8, background: 'var(--blue-light)', color: 'var(--blue)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      {isEditing ? (
                        <TextInput
                          value={editValue}
                          onChange={(e) => setEditValue(e.currentTarget.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                          style={{ flex: 1 }}
                          size="sm"
                          autoFocus
                        />
                      ) : (
                        <Text size="md">{item.task}</Text>
                      )}
                      {!isEditing && pendingCount > 0 && (
                        <Badge size="xs" color="red" variant="light" title="Ocorrências pendentes vinculadas a este item">
                          {pendingCount} {pendingCount === 1 ? 'ocorrência' : 'ocorrências'}
                        </Badge>
                      )}
                    </Group>
                    <Group gap={4}>
                      {isEditing ? (
                        <>
                          <ActionIcon color="green" variant="light" radius="md" onClick={saveEdit} aria-label="Salvar tarefa">
                            <Check size={15} />
                          </ActionIcon>
                          <ActionIcon color="gray" variant="light" radius="md" onClick={cancelEdit} aria-label="Cancelar edição">
                            <X size={15} />
                          </ActionIcon>
                        </>
                      ) : (
                        <>
                          <ActionIcon color="gray" variant="light" radius="md" onClick={() => startEdit(item)} aria-label="Editar tarefa">
                            <Pencil size={15} />
                          </ActionIcon>
                          <ActionIcon color="red" variant="light" radius="md" onClick={() => handleRemove(item.id, item.task)} aria-label="Remover tarefa">
                            <Trash2 size={15} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </div>
                );
              })}
            </div>
          ) : (
            <Text c="dimmed" size="sm" mb="md">Nenhuma tarefa cadastrada neste grupo ainda.</Text>
          )}

          <Group>
            <TextInput
              placeholder="Nova tarefa (ex: Varrer e passar pano no piso)"
              value={newTask}
              onChange={(e) => setNewTask(e.currentTarget.value)}
              style={{ flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button leftSection={<Plus size={15} />} onClick={handleAdd} loading={adding}>Adicionar</Button>
          </Group>
        </Tabs.Panel>

        <Tabs.Panel value="historico" pt="lg">
          <HistoryTab ambienteId={grupo.ambiente_id} ambienteName={`${ambiente.name} — ${grupo.nome}`} condominioName={condominio?.name} grupoId={grupo.id} />
        </Tabs.Panel>
      </Tabs>

      <ConfirmDeleteModal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        itemLabel={`o grupo "${grupo.nome}" e seus itens`}
        loading={removing}
      />
    </div>
  );
}
