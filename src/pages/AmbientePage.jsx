import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Text, Group, Breadcrumbs, Loader, TextInput, Button, ActionIcon,
  Tabs, Badge, Image as MantineImage, Modal,
} from '@mantine/core';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Trash2, ClipboardList, QrCode, History, AlertTriangle, Download, ListChecks, ArrowLeft, Pencil, Check, X } from 'lucide-react';
import { ambientesStore, checklistItemsStore, execucoesStore, ocorrenciasStore } from '../lib/stores';

function ChecklistTab({ ambienteId }) {
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
    await checklistItemsStore.create({ ambiente_id: ambienteId, task: newTask.trim(), order_index: items.length });
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
                      <ActionIcon color="green" variant="subtle" radius="md" onClick={saveEdit} aria-label="Salvar tarefa">
                        <Check size={15} />
                      </ActionIcon>
                      <ActionIcon color="gray" variant="subtle" radius="md" onClick={cancelEdit} aria-label="Cancelar edição">
                        <X size={15} />
                      </ActionIcon>
                    </>
                  ) : (
                    <>
                      <ActionIcon color="gray" variant="subtle" radius="md" onClick={() => startEdit(item)} aria-label="Editar tarefa">
                        <Pencil size={15} />
                      </ActionIcon>
                      <ActionIcon color="red" variant="subtle" radius="md" onClick={() => handleRemove(item.id)} aria-label="Remover tarefa">
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

function QrCodeTab({ ambiente }) {
  // HashRouter (necessário no GitHub Pages, que não suporta fallback de SPA):
  // as rotas ficam depois do "#", então o link precisa incluir o BASE_URL + "#/...".
  const baseUrl = window.location.origin + import.meta.env.BASE_URL;
  const execUrl = `${baseUrl}#/ambiente/${ambiente.id}/executar`;
  const statusUrl = `${baseUrl}#/ambiente/${ambiente.id}/status`;

  const downloadQr = (elId, filename) => {
    const svg = document.getElementById(elId);
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const img = new window.Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename;
      a.click();
    };
    img.src = url;
  };

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      {[
        { id: 'qr-exec', title: 'QR Code — Execução do checklist', desc: 'Para o colaborador escanear no local', value: execUrl, file: `checklist-${ambiente.name}.png`, tint: 'var(--blue-light)', color: 'var(--blue)' },
        { id: 'qr-status', title: 'QR Code — Status público', desc: 'Para o morador consultar (sem login)', value: statusUrl, file: `status-${ambiente.name}.png`, tint: 'var(--green-light)', color: 'var(--green)' },
      ].map((qr) => (
        <div key={qr.id} className="surface-card" style={{ padding: 26, textAlign: 'center', width: 240 }}>
          <Text fw={700} size="sm" mb={4}>{qr.title}</Text>
          <Text size="xs" c="dimmed" mb="md">{qr.desc}</Text>
          <div style={{ padding: 16, background: qr.tint, borderRadius: 16, display: 'inline-block' }}>
            <div style={{ background: '#fff', padding: 12, borderRadius: 10 }}>
              <QRCodeSVG id={qr.id} value={qr.value} size={150} fgColor="#10142c" />
            </div>
          </div>
          <Button mt="md" size="xs" variant="light" color={qr.color === 'var(--green)' ? 'green' : 'brand'} leftSection={<Download size={14} />} onClick={() => downloadQr(qr.id, qr.file)}>
            Baixar QR Code
          </Button>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ ambienteId }) {
  const [execs, setExecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    execucoesStore.list({ ambiente_id: ambienteId }).then((data) => {
      setExecs(data);
      setLoading(false);
    });
  }, [ambienteId]);

  if (loading) return <Loader size="sm" color="brand" />;
  if (!execs.length) return <Text c="dimmed" size="sm">Nenhuma execução registrada ainda.</Text>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {execs.map((e) => (
        <div key={e.id} className="surface-card" style={{ padding: 16 }}>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="sm" fw={600}>{e.executed_by || 'Colaborador'}</Text>
              <Text size="xs" c="dimmed">{new Date(e.created_at).toLocaleString('pt-BR')}</Text>
            </div>
            <Badge color="green" variant="light">{e.completed_count}/{e.total_count} tarefas</Badge>
          </Group>
          {e.photo && <MantineImage src={e.photo} radius="md" mt="sm" h={140} w={140} fit="cover" />}
        </div>
      ))}
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
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => ambientesStore.getById(id).then((data) => { setAmbiente(data); setLoading(false); });

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
        <Group gap={12}>
          <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
            <ListChecks size={19} color="var(--blue)" />
          </span>
          <Text fw={800} size="1.6rem">{ambiente.name}</Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" radius="xl" size="lg" onClick={openEdit} aria-label="Editar ambiente">
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
        defaultValue="checklist"
        styles={{
          tab: { fontWeight: 600, fontSize: 14 },
          list: { borderBottom: '1px solid var(--border)' },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="checklist" leftSection={<ClipboardList size={15} />}>Checklist</Tabs.Tab>
          <Tabs.Tab value="qrcode" leftSection={<QrCode size={15} />}>QR Codes</Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<History size={15} />}>Histórico</Tabs.Tab>
          <Tabs.Tab value="ocorrencias" leftSection={<AlertTriangle size={15} />}>Ocorrências</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="checklist" pt="lg"><ChecklistTab ambienteId={id} /></Tabs.Panel>
        <Tabs.Panel value="qrcode" pt="lg"><QrCodeTab ambiente={ambiente} /></Tabs.Panel>
        <Tabs.Panel value="historico" pt="lg"><HistoryTab ambienteId={id} /></Tabs.Panel>
        <Tabs.Panel value="ocorrencias" pt="lg"><OccurrencesTab ambienteId={id} /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
