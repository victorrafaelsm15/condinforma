import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Text, Group, Breadcrumbs, Loader, TextInput, Button, ActionIcon,
  Tabs, Badge, Modal, SimpleGrid, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Trash2, ClipboardList, QrCode, History, AlertTriangle, ArrowLeft, Pencil, ChevronRight, Clock, FolderPlus,
} from 'lucide-react';
import { ambientesStore, checklistGruposStore, checklistItemsStore, execucoesStore, ocorrenciasStore, condominiosStore } from '../lib/stores';
import AmbienteQrCards from '../components/admin/AmbienteQrCards';
import HistoryTab from '../components/admin/HistoryTab';
import { logAudit } from '../lib/auditLog';
import { getSession } from '../lib/authService';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import { AMBIENTE_ICON_OPTIONS, getAmbienteIcon } from '../lib/ambienteIcons';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import OcorrenciaCard from '../components/admin/OcorrenciaCard';

// Listagem de grupos de checklist do ambiente — cada card leva pra
// página própria do grupo (GrupoChecklistPage), onde de fato se
// gerencia itens/status/histórico. Mesmo padrão visual já usado na
// listagem de condomínios → ambientes (ícone, nome, chevron, resumo
// embaixo com separador).
function ChecklistTab({ ambienteId, accountId }) {
  const [grupos, setGrupos] = useState([]);
  const [itemCountByGrupo, setItemCountByGrupo] = useState({});
  const [lastExecByGrupo, setLastExecByGrupo] = useState({});
  const [loading, setLoading] = useState(true);
  const [novoGrupoOpen, setNovoGrupoOpen] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [savingGrupo, setSavingGrupo] = useState(false);

  const load = async () => {
    setLoading(true);
    const [gruposList, itemsList, execs] = await Promise.all([
      checklistGruposStore.list({ ambiente_id: ambienteId }),
      checklistItemsStore.list({ ambiente_id: ambienteId }),
      execucoesStore.list({ ambiente_id: ambienteId }),
    ]);
    setGrupos(gruposList);
    const counts = {};
    itemsList.forEach((item) => { counts[item.checklist_grupo_id] = (counts[item.checklist_grupo_id] || 0) + 1; });
    setItemCountByGrupo(counts);
    // execs já vem ordenado por created_at desc (ver stores.js) — a
    // primeira ocorrência de cada grupo é a execução mais recente dele.
    const lastByGrupo = {};
    execs.forEach((e) => {
      if (e.checklist_grupo_id && !lastByGrupo[e.checklist_grupo_id]) lastByGrupo[e.checklist_grupo_id] = e;
    });
    setLastExecByGrupo(lastByGrupo);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ambienteId]);

  const openNovoGrupo = () => {
    setNovoGrupoNome('');
    setNovoGrupoOpen(true);
  };

  const handleCreateGrupo = async () => {
    if (!novoGrupoNome.trim()) return;
    setSavingGrupo(true);
    const created = await checklistGruposStore.create({ ambiente_id: ambienteId, nome: novoGrupoNome.trim(), status: 'ativo', account_id: accountId });
    logAudit({ action: 'checklist_grupo.criado', entityType: 'checklist_grupo', entityId: created.id, details: { nome: created.nome } });
    setSavingGrupo(false);
    setNovoGrupoOpen(false);
    load();
  };

  if (loading) return <Loader size="sm" color="brand" />;

  return (
    <div>
      {grupos.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="lg">
          {grupos.map((g) => {
            const exec = lastExecByGrupo[g.id];
            const isAtivo = g.status === 'ativo';
            return (
              <Link
                key={g.id}
                to={`/admin/ambientes/${ambienteId}/grupos/${g.id}`}
                className="surface-card surface-card--hover"
                style={{ display: 'block', padding: 20 }}
              >
                <Group justify="space-between">
                  <Group gap={12}>
                    <span className="icon-tile" style={{ background: isAtivo ? 'var(--green-light)' : '#eef0f3', width: 40, height: 40, borderRadius: 12 }}>
                      <ClipboardList size={19} color={isAtivo ? 'var(--green)' : '#6b7280'} />
                    </span>
                    <div>
                      <Text fw={700} size="md">{g.nome}</Text>
                      <Text size="xs" c="dimmed">{itemCountByGrupo[g.id] || 0} item(ns)</Text>
                    </div>
                  </Group>
                  <ChevronRight size={18} color="var(--text-faint)" />
                </Group>
                <Group gap={6} mt={14} pt={12} style={{ borderTop: '1px solid var(--border)' }}>
                  <Badge size="xs" color={isAtivo ? 'green' : 'gray'} variant="light">{isAtivo ? 'Ativo' : 'Inativo'}</Badge>
                  <Clock size={13} color="var(--text-muted)" />
                  {exec ? (
                    <Badge size="xs" color="gray" variant="light">Última execução: {new Date(exec.created_at).toLocaleString('pt-BR')}</Badge>
                  ) : (
                    <Badge size="xs" color="yellow" variant="light">Nunca executado</Badge>
                  )}
                </Group>
              </Link>
            );
          })}
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm" mb="lg">Nenhum grupo de checklist cadastrado ainda. Crie um pra começar (ex: "Rotina Diária").</Text>
      )}

      <Button variant="light" leftSection={<FolderPlus size={16} />} onClick={openNovoGrupo}>Novo grupo de checklist</Button>

      <Modal opened={novoGrupoOpen} onClose={() => setNovoGrupoOpen(false)} title="Novo grupo de checklist">
        <TextInput
          label="Nome do grupo"
          placeholder="Ex: Rotina Diária, Faxina Semanal"
          value={novoGrupoNome}
          onChange={(e) => setNovoGrupoNome(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateGrupo()}
          data-autofocus
        />
        <Text size="xs" c="dimmed" mt={8}>
          O grupo nasce ativo e aparece pro colaborador na hora. Mais de um grupo pode ficar ativo ao mesmo tempo.
        </Text>
        <Button fullWidth mt="lg" onClick={handleCreateGrupo} loading={savingGrupo}>Criar grupo</Button>
      </Modal>
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
