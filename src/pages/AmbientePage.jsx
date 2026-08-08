import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Text, Group, Breadcrumbs, Loader, TextInput, Button, ActionIcon,
  Tabs, Badge, Image as MantineImage, Modal, Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Plus, Trash2, ClipboardList, QrCode, History, AlertTriangle, ListChecks, ArrowLeft, Pencil, Check, X,
  FileDown, Download, Share2, Calendar,
} from 'lucide-react';
import { ambientesStore, checklistItemsStore, execucoesStore, ocorrenciasStore, condominiosStore } from '../lib/stores';
import AmbienteQrCards from '../components/admin/AmbienteQrCards';
import { generateComunicadoPdf, downloadPdf, sharePdf } from '../lib/comunicado';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';

function ChecklistTab({ ambienteId, accountId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const load = async () => {
    setLoading(true);
    const list = await checklistItemsStore.list({ ambiente_id: ambienteId });
    setItems(list.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ambienteId]);

  const handleAdd = async () => {
    if (!newTask.trim()) return;
    // account_id copiado do ambiente (não da sessão) — quem cria pode ser
    // um sub-usuário, cujo próprio account_id não é o dono real do ambiente.
    await checklistItemsStore.create({ ambiente_id: ambienteId, task: newTask.trim(), order_index: items.length, account_id: accountId });
    setNewTask('');
    load();
  };

  const handleRemove = async (id) => {
    await checklistItemsStore.remove(id);
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
    await checklistItemsStore.update(editingId, { task: editValue.trim() });
    setEditingId(null);
    setEditValue('');
    load();
  };

  if (loading) return <Loader size="sm" color="brand" />;

  return (
    <div>
      {items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {items.map((item, i) => {
            const isEditing = editingId === item.id;
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
                      <ActionIcon color="red" variant="light" radius="md" onClick={() => handleRemove(item.id)} aria-label="Remover tarefa">
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
        <Text c="dimmed" size="sm" mb="md">Nenhuma tarefa cadastrada ainda.</Text>
      )}

      <Group>
        <TextInput
          placeholder="Nova tarefa (ex: Varrer e passar pano no piso)"
          value={newTask}
          onChange={(e) => setNewTask(e.currentTarget.value)}
          style={{ flex: 1 }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button leftSection={<Plus size={15} />} onClick={handleAdd}>Adicionar</Button>
      </Group>
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

function ComunicadoMenu({ label, icon, onPick, loading, disabled }) {
  return (
    <Menu shadow="md" width={210} position="bottom-end" withinPortal disabled={disabled}>
      <Menu.Target>
        <Button size="xs" variant="light" leftSection={icon} loading={loading} disabled={disabled} onClick={(e) => e.stopPropagation()}>
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item leftSection={<Download size={14} />} onClick={() => onPick('download')}>Baixar PDF</Menu.Item>
        <Menu.Item leftSection={<Share2 size={14} />} onClick={() => onPick('share')}>Compartilhar (WhatsApp)</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function HistoryTab({ ambienteId, ambienteName, condominioName }) {
  const [execs, setExecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [generatingId, setGeneratingId] = useState(null);
  const [generatingPeriod, setGeneratingPeriod] = useState(false);
  const [generatingSelection, setGeneratingSelection] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    setSelectedIds(new Set());
    execucoesStore.list({ ambiente_id: ambienteId }).then((data) => {
      setExecs(data);
      setLoading(false);
    });
  };

  useEffect(load, [ambienteId]);

  const handleDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await execucoesStore.remove(deleting.id);
      notifications.show({ color: 'green', message: 'Execução excluída.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir a execução.' });
    } finally {
      setRemoving(false);
      setDeleting(null);
      load();
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(execs.map((e) => e.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const runComunicado = async (execucoes, filename, action, setBusy, key) => {
    if (!execucoes.length) {
      notifications.show({ color: 'red', message: 'Nenhuma execução selecionada pra gerar comunicado.' });
      return;
    }
    setBusy(key);
    try {
      const doc = generateComunicadoPdf({ condominioName, ambienteName, execucoes });
      if (action === 'share') {
        const result = await sharePdf(doc, filename);
        if (result === 'downloaded') {
          notifications.show({ color: 'blue', message: 'Seu navegador não suporta compartilhar arquivos — o PDF foi baixado.' });
        }
      } else {
        downloadPdf(doc, filename);
      }
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível gerar o PDF. Tente novamente.' });
    } finally {
      setBusy(null);
    }
  };

  const handleExecucaoComunicado = (exec, action) => {
    const dataStr = new Date(exec.created_at).toLocaleDateString('pt-BR').replaceAll('/', '-');
    runComunicado([exec], `comunicado-${ambienteName}-${dataStr}.pdf`, action, setGeneratingId, exec.id);
  };

  const handlePeriodoComunicado = (days, action) => {
    const cutoff = days ? Date.now() - days * 24 * 3_600_000 : null;
    const filtered = cutoff ? execs.filter((e) => new Date(e.created_at).getTime() >= cutoff) : execs;
    const label = days ? `ultimos-${days}-dias` : 'todas';
    runComunicado(filtered, `comunicado-${ambienteName}-${label}.pdf`, action, setGeneratingPeriod, true);
  };

  const handleSelectionComunicado = (action) => {
    // .filter preserva a ordem em que aparecem em "execs" (mais recente primeiro)
    const selectedExecs = execs.filter((e) => selectedIds.has(e.id));
    runComunicado(selectedExecs, `comunicado-${ambienteName}-selecionados.pdf`, action, setGeneratingSelection, true);
  };

  if (loading) return <Loader size="sm" color="brand" />;

  return (
    <div>
      {!!execs.length && (
        <Group justify="space-between" mb="md" wrap="wrap" gap={10}>
          <Group gap={8}>
            <Button size="xs" variant="light" onClick={selectAll}>Selecionar todos</Button>
            <Button size="xs" variant="light" color="gray" onClick={deselectAll}>Desmarcar todos</Button>
          </Group>
          <Group gap={8}>
            <ComunicadoMenu
              label={selectedIds.size ? `Gerar comunicado (${selectedIds.size})` : 'Gerar comunicado'}
              icon={<FileDown size={14} />}
              loading={!!generatingSelection}
              disabled={!selectedIds.size}
              onPick={handleSelectionComunicado}
            />
            <Menu shadow="md" width={230} position="bottom-end" withinPortal>
              <Menu.Target>
                <Button size="xs" variant="default" leftSection={<Calendar size={14} />} loading={!!generatingPeriod}>
                  Por período
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Baixar PDF</Menu.Label>
                <Menu.Item onClick={() => handlePeriodoComunicado(7, 'download')}>Últimos 7 dias</Menu.Item>
                <Menu.Item onClick={() => handlePeriodoComunicado(30, 'download')}>Últimos 30 dias</Menu.Item>
                <Menu.Item onClick={() => handlePeriodoComunicado(null, 'download')}>Todo o histórico</Menu.Item>
                <Menu.Divider />
                <Menu.Label>Compartilhar (WhatsApp)</Menu.Label>
                <Menu.Item onClick={() => handlePeriodoComunicado(7, 'share')}>Últimos 7 dias</Menu.Item>
                <Menu.Item onClick={() => handlePeriodoComunicado(30, 'share')}>Últimos 30 dias</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      )}

      {!execs.length ? (
        <Text c="dimmed" size="sm">Nenhuma execução registrada ainda.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {execs.map((e) => {
            const isSelected = selectedIds.has(e.id);
            return (
              <div key={e.id} className="surface-card" style={{ padding: 16 }}>
                <Group justify="space-between" align="flex-start" wrap="wrap" gap={10}>
                  <Group gap={10} align="flex-start" wrap="nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSelect(e.id)}
                      aria-label={isSelected ? 'Desmarcar execução' : 'Marcar execução'}
                      aria-pressed={isSelected}
                      style={{
                        width: 22, height: 22, marginTop: 2, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
                        border: isSelected ? 'none' : '2px solid var(--border)',
                        background: isSelected ? 'var(--blue)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s var(--ease)',
                      }}
                    >
                      {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                    </button>
                    <div>
                      <Text size="sm" fw={600}>{e.executed_by || 'Colaborador'}</Text>
                      <Text size="xs" c="dimmed">{new Date(e.created_at).toLocaleString('pt-BR')}</Text>
                    </div>
                  </Group>
                  <Group gap={8}>
                    <Badge color="green" variant="light">{e.completed_count}/{e.total_count} tarefas</Badge>
                    <ComunicadoMenu
                      label="Gerar comunicado"
                      icon={<FileDown size={14} />}
                      loading={generatingId === e.id}
                      onPick={(action) => handleExecucaoComunicado(e, action)}
                    />
                    <ActionIcon variant="light" color="red" radius="md" onClick={() => setDeleting(e)} aria-label="Excluir execução">
                      <Trash2 size={15} />
                    </ActionIcon>
                  </Group>
                </Group>
                {e.free_text_note && (
                  <Text size="sm" mt={8} ml={32} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    &quot;{e.free_text_note}&quot;
                  </Text>
                )}
                {e.photo && <MantineImage src={e.photo} radius="md" mt="sm" ml={32} h={140} w={140} fit="cover" />}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        itemLabel="esta execução"
        loading={removing}
      />
    </div>
  );
}

function OccurrencesTab({ ambienteId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    ocorrenciasStore.list({ ambiente_id: ambienteId }).then((data) => { setList(data); setLoading(false); });
  };

  useEffect(load, [ambienteId]);

  const handleResolve = async (id) => {
    await ocorrenciasStore.update(id, { status: 'resolvido' });
    load();
  };

  if (loading) return <Loader size="sm" color="brand" />;
  if (!list.length) return <Text c="dimmed" size="sm">Nenhuma ocorrência registrada.</Text>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((o) => (
        <div key={o.id} className="surface-card" style={{ padding: 16 }}>
          <Group justify="space-between" align="flex-start">
            <div style={{ flex: 1 }}>
              <Text size="sm">{o.description}</Text>
              <Text size="xs" c="dimmed" mt={4}>{new Date(o.created_at).toLocaleString('pt-BR')}</Text>
            </div>
            <Badge color={o.status === 'resolvido' ? 'green' : 'red'} variant="light">{o.status}</Badge>
          </Group>
          {o.photo && <MantineImage src={o.photo} radius="md" mt="sm" h={140} w={140} fit="cover" />}
          {o.status !== 'resolvido' && (
            <Button size="xs" variant="light" color="green" mt="sm" onClick={() => handleResolve(o.id)}>
              Marcar como resolvido
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AmbientePage() {
  const { id } = useParams();
  const [ambiente, setAmbiente] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('checklist');

  const load = async () => {
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
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    await ambientesStore.update(id, { name: editName.trim() });
    setSavingEdit(false);
    setEditOpen(false);
    load();
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
            <ListChecks size={17} color="#fff" />
          </span>
          <Text fw={800} size="1.6rem" className="font-display" c="#fff">{ambiente.name}</Text>
        </Group>
        <ActionIcon variant="light" color="gray" radius="xl" size="lg" onClick={openEdit} aria-label="Editar ambiente">
          <Pencil size={17} />
        </ActionIcon>
      </Group>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Editar ambiente">
        <TextInput
          label="Nome do ambiente"
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          data-autofocus
        />
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
          <Tabs.Tab value="checklist" leftSection={<ClipboardList size={15} />} style={getTabStyle('checklist', activeTab === 'checklist')}>
            Checklist
          </Tabs.Tab>
          <Tabs.Tab value="qrcode" style={getTabStyle('qrcode', activeTab === 'qrcode')}>
            <Group gap={6} wrap="nowrap" style={activeTab === 'qrcode' ? { color: '#fff', mixBlendMode: 'difference' } : undefined}>
              <QrCode size={15} /> QR Codes
            </Group>
          </Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<History size={15} />} style={getTabStyle('historico', activeTab === 'historico')}>
            Histórico
          </Tabs.Tab>
          <Tabs.Tab value="ocorrencias" leftSection={<AlertTriangle size={15} />} style={getTabStyle('ocorrencias', activeTab === 'ocorrencias')}>
            Ocorrências
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="checklist" pt="lg"><ChecklistTab ambienteId={id} accountId={ambiente.account_id} /></Tabs.Panel>
        <Tabs.Panel value="qrcode" pt="lg"><QrCodeTab ambiente={ambiente} /></Tabs.Panel>
        <Tabs.Panel value="historico" pt="lg"><HistoryTab ambienteId={id} ambienteName={ambiente.name} condominioName={condominio?.name} /></Tabs.Panel>
        <Tabs.Panel value="ocorrencias" pt="lg"><OccurrencesTab ambienteId={id} /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
