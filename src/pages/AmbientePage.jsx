import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Text, Group, Breadcrumbs, Loader, TextInput, Textarea, Button, ActionIcon,
  Tabs, Badge, Modal, SimpleGrid, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Trash2, ClipboardList, QrCode, History, AlertTriangle, ArrowLeft, Pencil, ChevronRight, Clock, Plus, Archive,
} from 'lucide-react';
import { ambientesStore, checklistPeriodosStore, checklistItemsStore, execucoesStore, ocorrenciasStore, condominiosStore } from '../lib/stores';
import { getOrCreateActivePeriodo, closePeriodoAndStartNew } from '../lib/checklistPeriodos';
import AmbienteQrCards from '../components/admin/AmbienteQrCards';
import HistoryTab from '../components/admin/HistoryTab';
import { logAudit } from '../lib/auditLog';
import { getSession } from '../lib/authService';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import { AMBIENTE_ICON_OPTIONS, getAmbienteIcon } from '../lib/ambienteIcons';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import OcorrenciaCard from '../components/admin/OcorrenciaCard';

// Um checklist só por ambiente, organizado em "períodos de execução":
// sempre existe exatamente UM período ativo (getOrCreateActivePeriodo cria
// o primeiro sozinho, se ainda não existir nenhum). Cada item do período
// ativo leva pra sua própria página (ChecklistItemPage), onde de fato se
// edita/conclui/comenta. Fechar o período arquiva o estado atual como
// histórico read-only (cards abaixo, cada um levando pra
// ChecklistPeriodoPage) e copia os itens pro período novo, todos
// reiniciados como pendentes.
function ChecklistTab({ ambienteId, accountId }) {
  const [periodoAtivo, setPeriodoAtivo] = useState(null);
  const [items, setItems] = useState([]);
  const [periodosFechados, setPeriodosFechados] = useState([]);
  const [itemCountByPeriodo, setItemCountByPeriodo] = useState({});
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [adding, setAdding] = useState(false);

  const [newPeriodoOpen, setNewPeriodoOpen] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDataInicio, setNovaDataInicio] = useState('');
  const [novaDataFim, setNovaDataFim] = useState('');
  const [creatingPeriodo, setCreatingPeriodo] = useState(false);

  const [deletePeriodoOpen, setDeletePeriodoOpen] = useState(false);
  const [deletingPeriodo, setDeletingPeriodo] = useState(false);

  const load = async () => {
    setLoading(true);
    const session = await getSession();
    setUserEmail(session?.user?.email || '');
    const ativo = await getOrCreateActivePeriodo(ambienteId, accountId);
    setPeriodoAtivo(ativo);
    const [itemsAtivo, todosPeriodos, allItems] = await Promise.all([
      checklistItemsStore.list({ checklist_periodo_id: ativo.id }),
      checklistPeriodosStore.list({ ambiente_id: ambienteId }),
      checklistItemsStore.list({ ambiente_id: ambienteId }),
    ]);
    setItems(itemsAtivo.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    setPeriodosFechados(
      todosPeriodos
        .filter((p) => p.status === 'fechado')
        .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))
    );
    const counts = {};
    allItems.forEach((item) => { counts[item.checklist_periodo_id] = (counts[item.checklist_periodo_id] || 0) + 1; });
    setItemCountByPeriodo(counts);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ambienteId]);

  const openAdd = () => {
    setNewTask('');
    setNewDescricao('');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!newTask.trim()) return;
    setAdding(true);
    const created = await checklistItemsStore.create({
      ambiente_id: ambienteId,
      checklist_periodo_id: periodoAtivo.id,
      account_id: accountId,
      task: newTask.trim(),
      descricao: newDescricao.trim() || null,
      order_index: items.length,
      status: 'pendente',
      criado_por: userEmail || null,
    });
    logAudit({ action: 'checklist.item_criado', entityType: 'checklist_item', entityId: created.id, details: { task: created.task } });
    setAdding(false);
    setAddOpen(false);
    load();
  };

  const openNewPeriodo = () => {
    setNovoCodigo('');
    setNovaDataInicio(new Date().toISOString().slice(0, 10));
    setNovaDataFim('');
    setNewPeriodoOpen(true);
  };

  const handleCreateNewPeriodo = async () => {
    setCreatingPeriodo(true);
    try {
      await closePeriodoAndStartNew({
        ambienteId, periodoAtivo, items, accountId,
        novoCodigo, dataInicio: novaDataInicio, dataFimPrevista: novaDataFim || null,
      });
      logAudit({ action: 'checklist_periodo.fechado', entityType: 'checklist_periodo', entityId: periodoAtivo.id, details: { nome: periodoAtivo.nome, itens: items.length } });
      notifications.show({ color: 'green', message: 'Novo período iniciado.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível iniciar o novo período.' });
    } finally {
      setCreatingPeriodo(false);
      setNewPeriodoOpen(false);
      load();
    }
  };

  // Excluir (não fechar) só é permitido pra um período ativo sem nenhum
  // progresso real registrado — senão a exclusão apagaria histórico de
  // verdade. Com progresso, a saída correta é "Novo período" (que fecha
  // o atual como histórico em vez de descartá-lo).
  const handleOpenDeletePeriodo = async () => {
    const hasItemProgress = items.some((i) => i.status === 'concluido' || i.foto || i.resolvido_por);
    if (hasItemProgress) {
      notifications.show({
        color: 'yellow',
        message: 'Este período já tem itens concluídos ou com evidência registrada. Use "Novo período" para preservar o histórico, em vez de excluir.',
      });
      return;
    }
    const execs = await execucoesStore.list({ checklist_periodo_id: periodoAtivo.id });
    if (execs.length) {
      notifications.show({
        color: 'yellow',
        message: 'Este período já tem execuções registradas. Use "Novo período" para preservar o histórico, em vez de excluir.',
      });
      return;
    }
    setDeletePeriodoOpen(true);
  };

  const handleConfirmDeletePeriodo = async () => {
    setDeletingPeriodo(true);
    try {
      await checklistPeriodosStore.remove(periodoAtivo.id);
      logAudit({ action: 'checklist_periodo.excluido', entityType: 'checklist_periodo', entityId: periodoAtivo.id, details: { nome: periodoAtivo.nome } });
      notifications.show({ color: 'green', message: 'Período excluído.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir o período.' });
    } finally {
      setDeletingPeriodo(false);
      setDeletePeriodoOpen(false);
      load();
    }
  };

  if (loading || !periodoAtivo) return <Loader size="sm" color="brand" />;

  return (
    <div>
      <div className="surface-card" style={{ padding: 24, marginBottom: 26 }}>
        <Group justify="space-between" mb={20} wrap="wrap" gap={12}>
          <Group gap={12}>
            <span className="icon-tile" style={{ background: 'var(--green-light)', width: 42, height: 42, borderRadius: 12 }}>
              <ClipboardList size={20} color="var(--green)" />
            </span>
            <div>
              <Text fw={700} size="lg">{periodoAtivo.nome}</Text>
              <Text size="sm" c="dimmed">Iniciado em {new Date(periodoAtivo.started_at).toLocaleDateString('pt-BR')}</Text>
            </div>
          </Group>
          <Group gap={8} wrap="wrap">
            <Badge color="green" variant="light" size="lg">Ativo</Badge>
            <Button size="sm" variant="light" leftSection={<Plus size={15} />} onClick={openNewPeriodo}>Novo período</Button>
            <Button size="sm" variant="light" color="red" leftSection={<Trash2 size={15} />} onClick={handleOpenDeletePeriodo}>Excluir período</Button>
          </Group>
        </Group>

        {items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {items.map((item, i) => {
              const isConcluido = item.status === 'concluido';
              return (
                <Link
                  key={item.id}
                  to={`/admin/ambientes/${ambienteId}/checklist/itens/${item.id}`}
                  className="surface-card surface-card--hover"
                  style={{ display: 'block', padding: '16px 18px' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={12} wrap="nowrap" style={{ minWidth: 0 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0, fontSize: 13, fontWeight: 700,
                        background: isConcluido ? 'var(--green)' : 'var(--blue-light)', color: isConcluido ? '#fff' : 'var(--blue)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {i + 1}
                      </span>
                      <Text size="md" truncate style={{ opacity: isConcluido ? 0.7 : 1 }}>{item.task}</Text>
                    </Group>
                    <Group gap={10} wrap="nowrap">
                      <Badge size="sm" color={isConcluido ? 'green' : 'yellow'} variant="light">
                        {isConcluido ? 'Concluído' : 'Pendente'}
                      </Badge>
                      <ChevronRight size={18} color="var(--text-faint)" />
                    </Group>
                  </Group>
                </Link>
              );
            })}
          </div>
        ) : (
          <Text c="dimmed" size="sm" mb={20}>Nenhum item cadastrado neste período ainda.</Text>
        )}

        <Button variant="light" leftSection={<Plus size={15} />} onClick={openAdd}>Novo item</Button>
      </div>

      <Text fw={700} size="md" mb={12}>Histórico de períodos</Text>
      {periodosFechados.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {periodosFechados.map((p) => (
            <Link
              key={p.id}
              to={`/admin/ambientes/${ambienteId}/checklist/periodos/${p.id}`}
              className="surface-card surface-card--hover"
              style={{ display: 'block', padding: 20 }}
            >
              <Group justify="space-between">
                <Group gap={12}>
                  <span className="icon-tile" style={{ background: '#eef0f3', width: 40, height: 40, borderRadius: 11 }}>
                    <Archive size={18} color="#6b7280" />
                  </span>
                  <div>
                    <Text fw={700} size="md">{p.nome}</Text>
                    <Text size="sm" c="dimmed">{itemCountByPeriodo[p.id] || 0} item(ns)</Text>
                  </div>
                </Group>
                <ChevronRight size={18} color="var(--text-faint)" />
              </Group>
              <Group gap={8} mt={14} pt={12} style={{ borderTop: '1px solid var(--border)' }}>
                <Badge size="sm" color="gray" variant="light">Fechado</Badge>
                <Clock size={13} color="var(--text-muted)" />
                <Text size="sm" c="dimmed">{p.closed_at ? new Date(p.closed_at).toLocaleDateString('pt-BR') : ''}</Text>
              </Group>
            </Link>
          ))}
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm">Nenhum período fechado ainda.</Text>
      )}

      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Novo item do checklist">
        <TextInput
          label="Tarefa"
          placeholder="Ex: Varrer e passar pano no piso"
          value={newTask}
          onChange={(e) => setNewTask(e.currentTarget.value)}
          data-autofocus
          mb="sm"
        />
        <Textarea
          label="Descrição (opcional)"
          placeholder="Detalhes adicionais sobre a tarefa"
          value={newDescricao}
          onChange={(e) => setNewDescricao(e.currentTarget.value)}
          minRows={2}
          mb="md"
        />
        <Button fullWidth onClick={handleAdd} loading={adding}>Adicionar</Button>
      </Modal>

      <Modal opened={newPeriodoOpen} onClose={() => setNewPeriodoOpen(false)} title="Novo período">
        <TextInput
          label="Código do período"
          placeholder={`Ex: Período ${periodosFechados.length + 2}`}
          value={novoCodigo}
          onChange={(e) => setNovoCodigo(e.currentTarget.value)}
          data-autofocus
          mb="sm"
        />
        <TextInput
          label="Data início"
          type="date"
          value={novaDataInicio}
          onChange={(e) => setNovaDataInicio(e.currentTarget.value)}
          mb="sm"
        />
        <TextInput
          label="Data fim (opcional)"
          type="date"
          value={novaDataFim}
          onChange={(e) => setNovaDataFim(e.currentTarget.value)}
          mb="md"
        />
        <Text size="sm" c="dimmed" mb="lg">
          Os itens atuais do checklist entram automaticamente neste período, todos como pendentes.
        </Text>
        <Group gap={8} justify="flex-end">
          <Button variant="default" onClick={() => setNewPeriodoOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateNewPeriodo} loading={creatingPeriodo}>Iniciar período</Button>
        </Group>
      </Modal>

      <ConfirmDeleteModal
        opened={deletePeriodoOpen}
        onClose={() => setDeletePeriodoOpen(false)}
        onConfirm={handleConfirmDeletePeriodo}
        itemLabel={`o período "${periodoAtivo.nome}"`}
        loading={deletingPeriodo}
      />
    </div>
  );
}

// Cores de cada aba (mesmo padrão "pill preenchida" dos botões de navegação
// do topo): ativa usa a cor forte com texto branco, inativa usa uma versão
// clara/suave da mesma cor. QR Codes foge à regra por pedido — bicolor
// preto/branco dividido ao meio quando ativa (texto usa mix-blend-mode
// "difference" pra ficar legível automaticamente nas duas metades).
const TAB_COLORS = {
  checklist: { activeBg: 'var(--green)', activeText: '#fff', inactiveBg: 'var(--green-light)', inactiveText: 'var(--green)' },
  historico: { activeBg: '#6b7280', activeText: '#fff', inactiveBg: '#eef0f3', inactiveText: '#6b7280' },
  ocorrencias: { activeBg: 'var(--red)', activeText: '#fff', inactiveBg: 'var(--red-light)', inactiveText: 'var(--red)' },
};

function getTabStyle(value, isActive) {
  if (value === 'qrcode') {
    return isActive
      ? { background: 'linear-gradient(90deg, #10142c 50%, #fff 50%)', isolation: 'isolate', border: '1px solid var(--border)' }
      : { background: '#eef0f3', color: '#6b7280' };
  }
  const c = TAB_COLORS[value];
  return { background: isActive ? c.activeBg : c.inactiveBg, color: isActive ? c.activeText : c.inactiveText };
}

function QrCodeTab({ ambiente }) {
  return <AmbienteQrCards ambiente={ambiente} />;
}

function OccurrencesTab({ ambienteId, canDelete }) {
  const [list, setList] = useState([]);
  const [itemsById, setItemsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      ocorrenciasStore.list({ ambiente_id: ambienteId }),
      checklistItemsStore.list({ ambiente_id: ambienteId }),
    ]).then(([occs, checklistItems]) => {
      setList(occs);
      setItemsById(Object.fromEntries(checklistItems.map((i) => [i.id, i.task])));
      setLoading(false);
    });
  };

  useEffect(load, [ambienteId]);

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

  if (loading) return <Loader size="sm" color="brand" />;
  if (!list.length) return <Text c="dimmed" size="sm">Nenhuma ocorrência registrada.</Text>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((o) => (
        <OcorrenciaCard
          key={o.id}
          ocorrencia={o}
          relatedTask={o.related_checklist_item_id ? itemsById[o.related_checklist_item_id] : null}
          onResolve={o.status !== 'resolvido' ? () => handleResolve(o.id) : undefined}
          resolving={resolvingId === o.id}
          onDelete={canDelete ? () => setDeleting(o) : undefined}
        />
      ))}

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

export default function AmbientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ambiente, setAmbiente] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('checklist');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isSubUsuario, setIsSubUsuario] = useState(false);

  const load = async () => {
    const session = await getSession();
    if (session) {
      const subInfo = await getSubUsuarioInfo(session.user.id);
      setIsSubUsuario(!!subInfo);
    }
    const data = await ambientesStore.getById(id);
    setAmbiente(data);
    if (data) {
      const c = await condominiosStore.getById(data.condominio_id);
      setCondominio(c);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const openEdit = () => {
    setEditName(ambiente.name);
    setEditIcon(ambiente.icon || 'DoorOpen');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    const oldName = ambiente.name;
    // "DoorOpen" (o genérico) grava como null — mais simples que carregar
    // "sem ícone" vs. "ícone genérico escolhido" como dois estados
    // diferentes no banco, já que visualmente é a mesma coisa.
    await ambientesStore.update(id, { name: editName.trim(), icon: editIcon === 'DoorOpen' ? null : editIcon });
    logAudit({ action: 'ambiente.editado', entityType: 'ambiente', entityId: id, details: { antes: oldName, depois: editName.trim() } });
    setSavingEdit(false);
    setEditOpen(false);
    load();
  };

  const handleDelete = async () => {
    setRemoving(true);
    try {
      // Checklists, execuções e ocorrências desse ambiente já saem junto:
      // "on delete cascade" no banco (ver schema.sql).
      await ambientesStore.remove(id);
      logAudit({ action: 'ambiente.excluido', entityType: 'ambiente', entityId: id, details: { name: ambiente.name } });
      notifications.show({ color: 'green', message: `${ambiente.name} excluído.` });
      navigate(`/admin/condominios/${ambiente.condominio_id}`);
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir o ambiente.' });
      setRemoving(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;
  if (!ambiente) return <Text>Ambiente não encontrado.</Text>;

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to={`/admin/condominios/${ambiente.condominio_id}`} variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar para ambientes">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Link to={`/admin/condominios/${ambiente.condominio_id}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Ambientes</Link>
          <Text size="md" fw={600}>{ambiente.name}</Text>
        </Breadcrumbs>
      </Group>

      <Group gap={12} mb="lg" justify="space-between">
        <Group gap={10} style={{ background: 'var(--blue)', borderRadius: 999, padding: '8px 20px 8px 10px' }}>
          <span style={{
            width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {(() => { const AmbienteIcon = getAmbienteIcon(ambiente.icon); return <AmbienteIcon size={17} color="#fff" />; })()}
          </span>
          <div>
            <Text fw={800} size="1.6rem" className="font-display" c="#fff" lh={1.2}>{ambiente.name}</Text>
            {ambiente.checklist_code && (
              <Text size="xs" fw={600} c="rgba(255,255,255,0.72)">{ambiente.checklist_code}</Text>
            )}
          </div>
        </Group>
        <Group gap={8}>
          <ActionIcon variant="light" color="gray" radius="xl" size="lg" onClick={openEdit} aria-label="Editar ambiente">
            <Pencil size={17} />
          </ActionIcon>
          <ActionIcon variant="light" color="red" radius="xl" size="lg" onClick={() => setDeleteOpen(true)} aria-label="Excluir ambiente">
            <Trash2 size={17} />
          </ActionIcon>
        </Group>
      </Group>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Editar ambiente">
        <TextInput
          label="Nome do ambiente"
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          data-autofocus
          mb="md"
        />
        <Text size="sm" fw={600} mb={8}>Ícone</Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {AMBIENTE_ICON_OPTIONS.map(({ value, label, Icon }) => {
            const selected = editIcon === value;
            return (
              <Tooltip key={value} label={label} withArrow>
                <ActionIcon
                  variant={selected ? 'filled' : 'light'}
                  color={selected ? 'brand' : 'gray'}
                  size="xl"
                  radius="md"
                  onClick={() => setEditIcon(value)}
                  aria-label={label}
                  aria-pressed={selected}
                >
                  <Icon size={19} />
                </ActionIcon>
              </Tooltip>
            );
          })}
        </div>
        <Button fullWidth mt="lg" onClick={handleSaveEdit} loading={savingEdit}>Salvar</Button>
      </Modal>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          tab: { fontWeight: 600, fontSize: 14, borderRadius: 999, border: 'none', padding: '9px 18px', transition: 'all 0.2s var(--ease)' },
          list: { border: 'none', gap: 8, flexWrap: 'wrap' },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="qrcode" style={getTabStyle('qrcode', activeTab === 'qrcode')}>
            <Group gap={6} wrap="nowrap" style={activeTab === 'qrcode' ? { color: '#fff', mixBlendMode: 'difference' } : undefined}>
              <QrCode size={15} /> QR Codes
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value="checklist" leftSection={<ClipboardList size={15} />} style={getTabStyle('checklist', activeTab === 'checklist')}>
            Checklist
          </Tabs.Tab>
          <Tabs.Tab value="ocorrencias" leftSection={<AlertTriangle size={15} />} style={getTabStyle('ocorrencias', activeTab === 'ocorrencias')}>
            Ocorrências
          </Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<History size={15} />} style={getTabStyle('historico', activeTab === 'historico')}>
            Histórico
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="qrcode" pt="lg"><QrCodeTab ambiente={ambiente} /></Tabs.Panel>
        <Tabs.Panel value="checklist" pt="lg">
          <ChecklistTab ambienteId={id} accountId={ambiente.account_id} />
        </Tabs.Panel>
        <Tabs.Panel value="ocorrencias" pt="lg"><OccurrencesTab ambienteId={id} canDelete={!isSubUsuario} /></Tabs.Panel>
        <Tabs.Panel value="historico" pt="lg"><HistoryTab ambienteId={id} ambienteName={ambiente.name} condominioName={condominio?.name} /></Tabs.Panel>
      </Tabs>

      <ConfirmDeleteModal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        itemLabel={ambiente.name}
        loading={removing}
      />
    </div>
  );
}
