import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button, TextInput, Text, Group, Modal, Loader, SimpleGrid, Breadcrumbs, Badge, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, DoorOpen, ChevronRight, Clock, LayoutGrid, ArrowLeft, Pencil, Trash2, LayoutDashboard } from 'lucide-react';
import { condominiosStore, ambientesStore, execucoesStore } from '../lib/stores';
import { getSession } from '../lib/authService';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import { logAudit } from '../lib/auditLog';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';

export default function CondominioPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [condominio, setCondominio] = useState(null);
  const [ambientes, setAmbientes] = useState([]);
  const [lastExec, setLastExec] = useState({});
  const [isSubUsuario, setIsSubUsuario] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const [editCondoOpen, setEditCondoOpen] = useState(false);
  const [editCondoName, setEditCondoName] = useState('');
  const [savingCondoEdit, setSavingCondoEdit] = useState(false);

  const [deleteCondoOpen, setDeleteCondoOpen] = useState(false);
  const [removingCondo, setRemovingCondo] = useState(false);

  const load = async () => {
    setLoading(true);
    const session = await getSession();
    if (session) {
      const subInfo = await getSubUsuarioInfo(session.user.id);
      setIsSubUsuario(!!subInfo);
    }
    const c = await condominiosStore.getById(id);
    setCondominio(c);
    const list = await ambientesStore.list({ condominio_id: id });
    setAmbientes(list);

    const execEntries = await Promise.all(
      list.map(async (a) => {
        const execs = await execucoesStore.list({ ambiente_id: a.id });
        return [a.id, execs[0] || null];
      })
    );
    setLastExec(Object.fromEntries(execEntries));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    // account_id copiado explicitamente do condomínio (não da sessão): quem
    // está criando pode ser um sub-usuário, cujo próprio account_id não é
    // o dono real do condomínio.
    const created = await ambientesStore.create({ condominio_id: id, name: newName.trim(), account_id: condominio.account_id });
    logAudit({ action: 'ambiente.criado', entityType: 'ambiente', entityId: created.id, details: { name: created.name, condominio: condominio.name } });
    setNewName('');
    setModalOpen(false);
    setSaving(false);
    load();
  };

  const openEditCondo = () => {
    setEditCondoName(condominio.name);
    setEditCondoOpen(true);
  };

  const handleSaveCondoEdit = async () => {
    if (!editCondoName.trim()) return;
    setSavingCondoEdit(true);
    const oldName = condominio.name;
    await condominiosStore.update(id, { name: editCondoName.trim() });
    logAudit({ action: 'condominio.editado', entityType: 'condominio', entityId: id, details: { antes: oldName, depois: editCondoName.trim() } });
    setSavingCondoEdit(false);
    setEditCondoOpen(false);
    load();
  };

  const handleDeleteCondo = async () => {
    setRemovingCondo(true);
    try {
      // Ambientes, checklists, execuções e ocorrências desse condomínio já
      // saem junto — são "on delete cascade" no banco (ver schema.sql).
      await condominiosStore.remove(id);
      logAudit({ action: 'condominio.excluido', entityType: 'condominio', entityId: id, details: { name: condominio.name } });
      notifications.show({ color: 'green', message: `${condominio.name} excluído.` });
      navigate('/admin');
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir o condomínio.' });
      setRemovingCondo(false);
      setDeleteCondoOpen(false);
    }
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to="/admin" variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar para condomínios">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Text size="md" fw={600}>{condominio?.name}</Text>
        </Breadcrumbs>
      </Group>

      <Group justify="space-between" mb="xl" align="flex-start">
        <Group gap={8} align="flex-start">
          <div>
            <Text fw={800} size="1.6rem" className="font-display">{condominio?.name}</Text>
            <Text size="md" c="dimmed" mt={2}>Ambientes cadastrados e status da última execução.</Text>
          </div>
          {/* Sub-usuário só tem SELECT em condominios via RLS — esconde o
              lápis pra não deixar cair no fallback silencioso de
              localStorage do createStore quando o update for recusado. */}
          {!isSubUsuario && (
            <>
              <ActionIcon variant="light" color="gray" radius="xl" size="lg" mt={4} onClick={openEditCondo} aria-label="Editar condomínio">
                <Pencil size={16} />
              </ActionIcon>
              <ActionIcon variant="light" color="red" radius="xl" size="lg" mt={4} onClick={() => setDeleteCondoOpen(true)} aria-label="Excluir condomínio">
                <Trash2 size={16} />
              </ActionIcon>
            </>
          )}
        </Group>
        <Group gap={8}>
          <Button component={Link} to={`/admin/condominios/${id}/dashboard`} variant="default" leftSection={<LayoutDashboard size={16} />}>
            Visão geral
          </Button>
          <Button leftSection={<Plus size={16} />} onClick={() => setModalOpen(true)} className="btn-glow" style={{ boxShadow: 'var(--shadow-brand)' }}>
            Novo ambiente
          </Button>
        </Group>
      </Group>

      {ambientes.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {ambientes.map((a) => {
            const exec = lastExec[a.id];
            return (
              <Link key={a.id} to={`/admin/ambientes/${a.id}`} className="surface-card surface-card--hover" style={{ display: 'block', padding: 22, position: 'relative' }}>
                <Group justify="space-between">
                  <Group gap={12}>
                    <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
                      <DoorOpen size={19} color="var(--blue)" />
                    </span>
                    <div>
                      <Text fw={700} size="md">{a.name}</Text>
                      {a.checklist_code && <Text size="xs" c="dimmed">{a.checklist_code}</Text>}
                    </div>
                  </Group>
                  <ChevronRight size={18} color="var(--text-faint)" />
                </Group>
                <Group gap={6} mt={14} pt={12} style={{ borderTop: '1px solid var(--border)' }}>
                  <Clock size={13} color="var(--text-muted)" />
                  {exec ? (
                    <Badge size="xs" color="gray" variant="light">
                      Última execução: {new Date(exec.created_at).toLocaleString('pt-BR')}
                    </Badge>
                  ) : (
                    <Badge size="xs" color="yellow" variant="light">Nunca executado</Badge>
                  )}
                </Group>
              </Link>
            );
          })}
        </SimpleGrid>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px' }}>
            <LayoutGrid size={24} color="var(--blue)" />
          </span>
          <Text c="dimmed">Nenhum ambiente cadastrado. Clique em &quot;Novo ambiente&quot; para começar.</Text>
        </div>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Novo ambiente">
        <TextInput
          label="Nome do ambiente"
          placeholder="Ex: Hall Social, Torre A"
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          data-autofocus
        />
        <Button fullWidth mt="lg" onClick={handleCreate} loading={saving}>Criar</Button>
      </Modal>

      <Modal opened={editCondoOpen} onClose={() => setEditCondoOpen(false)} title="Editar condomínio">
        <TextInput
          label="Nome do condomínio"
          value={editCondoName}
          onChange={(e) => setEditCondoName(e.currentTarget.value)}
          data-autofocus
        />
        <Button fullWidth mt="lg" onClick={handleSaveCondoEdit} loading={savingCondoEdit}>Salvar</Button>
      </Modal>

      <ConfirmDeleteModal
        opened={deleteCondoOpen}
        onClose={() => setDeleteCondoOpen(false)}
        onConfirm={handleDeleteCondo}
        itemLabel={condominio?.name}
        loading={removingCondo}
      />
    </div>
  );
}
