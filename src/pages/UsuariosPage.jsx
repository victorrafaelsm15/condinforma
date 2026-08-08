import { useEffect, useState } from 'react';
import {
  Text, Group, Loader, Badge, Tabs, ActionIcon, Modal, Select, NumberInput, Button, MultiSelect,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Users, CreditCard, UserCog, Mail, Phone, IdCard, Pencil, Trash2 } from 'lucide-react';
import { getSession } from '../lib/authService';
import { accountsStore } from '../lib/stores';
import { listAllAccounts, updateAccount, deleteAccount, listAssinantes, removeAssinante } from '../lib/adminAccounts';
import { listAllSubUsuarios, updateSubUsuarioCondominios, removeSubUsuario, getAccountCondominioOptions } from '../lib/subUsuario';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';

const PLAN_LABELS = { start: 'Start', pro: 'Pro', business: 'Business' };
const PLAN_OPTIONS = [{ value: '', label: 'Nenhum' }, { value: 'start', label: 'Start' }, { value: 'pro', label: 'Pro' }, { value: 'business', label: 'Business' }];
const STATUS_OPTIONS = [{ value: 'trial', label: 'Trial' }, { value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }];
const STATUS_STYLES = { ativo: { color: 'green', label: 'Ativo' }, pendente: { color: 'yellow', label: 'Pendente' }, trial: { color: 'blue', label: 'Trial' }, inativo: { color: 'red', label: 'Inativo' } };

function formatCpfCnpj(v) {
  if (!v) return '—';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

function formatPhone(v) {
  if (!v) return '—';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v;
}

function UsuariosTab({ currentUserId }) {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => { setLoading(true); listAllAccounts().then((data) => { setList(data); setLoading(false); }); };
  useEffect(load, []);

  const openEdit = (acc) => {
    setEditing(acc);
    setEditForm({
      plan_name: acc.plan_name || '',
      status: acc.status || 'trial',
      condominio_limit: acc.condominio_limit || 0,
      sub_usuario_limit: acc.sub_usuario_limit || 0,
    });
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await updateAccount(editing.id, { ...editForm, plan_name: editForm.plan_name || null });
      notifications.show({ color: 'green', message: 'Conta atualizada.' });
      setEditing(null);
      load();
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível atualizar a conta.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setRemoving(true);
    try {
      await deleteAccount(deleting.id);
      notifications.show({ color: 'green', message: 'Usuário excluído.' });
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Não foi possível excluir esse usuário.' });
    } finally {
      setRemoving(false);
      setDeleting(null);
      load();
    }
  };

  if (loading) return <Group justify="center" py={40}><Loader size="sm" color="brand" /></Group>;
  if (!list.length) return <Text c="dimmed" size="sm">Nenhuma conta cadastrada ainda.</Text>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((acc) => {
        const statusInfo = STATUS_STYLES[acc.status] || { color: 'gray', label: acc.status || '—' };
        const canManage = acc.role !== 'owner' && acc.id !== currentUserId;
        return (
          <div key={acc.id} className="surface-card" style={{ padding: 16 }}>
            <Group justify="space-between" align="flex-start" wrap="wrap" gap={10}>
              <div>
                <Group gap={8}>
                  <Text fw={700} size="sm">{acc.email || 'Sem e-mail'}</Text>
                  <Badge color={statusInfo.color} variant="light">{statusInfo.label}</Badge>
                  {acc.role === 'owner' && <Badge color="violet" variant="light">Owner</Badge>}
                  {acc.plan_name && <Badge color="brand" variant="light">{PLAN_LABELS[acc.plan_name] || acc.plan_name}</Badge>}
                </Group>
                <Text size="xs" c="dimmed" mt={6}>
                  Criada em {new Date(acc.created_at).toLocaleDateString('pt-BR')} · {acc.condominio_limit || 0} condomínio(s) · {acc.sub_usuario_limit || 0} sub-usuário(s)
                </Text>
              </div>
              {canManage && (
                <Group gap={4}>
                  <ActionIcon variant="light" color="gray" radius="xl" onClick={() => openEdit(acc)} aria-label="Editar usuário">
                    <Pencil size={15} />
                  </ActionIcon>
                  <ActionIcon variant="light" color="red" radius="xl" onClick={() => setDeleting(acc)} aria-label="Excluir usuário">
                    <Trash2 size={15} />
                  </ActionIcon>
                </Group>
              )}
            </Group>
          </div>
        );
      })}

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={`Editar ${editing?.email || ''}`} centered>
        <Select label="Plano" data={PLAN_OPTIONS} value={editForm.plan_name} onChange={(v) => setEditForm((f) => ({ ...f, plan_name: v }))} mb="sm" />
        <Select label="Status" data={STATUS_OPTIONS} value={editForm.status} onChange={(v) => setEditForm((f) => ({ ...f, status: v }))} mb="sm" />
        <NumberInput label="Limite de condomínios" min={0} value={editForm.condominio_limit} onChange={(v) => setEditForm((f) => ({ ...f, condominio_limit: v || 0 }))} mb="sm" />
        <NumberInput label="Limite de sub-usuários" min={0} value={editForm.sub_usuario_limit} onChange={(v) => setEditForm((f) => ({ ...f, sub_usuario_limit: v || 0 }))} mb="md" />
        <Button fullWidth onClick={handleSaveEdit} loading={saving}>Salvar</Button>
      </Modal>

      <ConfirmDeleteModal opened={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} itemLabel={deleting?.email} loading={removing} />
    </div>
  );
}

function AssinantesTab() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => { setLoading(true); listAssinantes().then((data) => { setList(data); setLoading(false); }); };
  useEffect(load, []);

  const handleDelete = async () => {
    setRemoving(true);
    try {
      await removeAssinante(deleting.asaas_subscription_id);
      notifications.show({ color: 'green', message: 'Assinante excluído.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir esse assinante.' });
    } finally {
      setRemoving(false);
      setDeleting(null);
      load();
    }
  };

  if (loading) return <Group justify="center" py={40}><Loader size="sm" color="brand" /></Group>;
  if (!list.length) return <Text c="dimmed" size="sm">Nenhum assinante ainda.</Text>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((s) => {
        const statusInfo = STATUS_STYLES[s.status] || { color: 'gray', label: s.status || '—' };
        return (
          <div key={s.asaas_subscription_id} className="surface-card" style={{ padding: 18 }}>
            <Group justify="space-between" align="flex-start" wrap="wrap" gap={10}>
              <div>
                <Group gap={8}>
                  <Text fw={700} size="md">{s.name || 'Sem nome'}</Text>
                  <Badge color={statusInfo.color} variant="light">{statusInfo.label}</Badge>
                  {s.plan_name && <Badge color="brand" variant="light">{s.plan_name}</Badge>}
                </Group>
                <Group gap={16} mt={8} wrap="wrap">
                  <Group gap={5}><Mail size={13} color="var(--text-muted)" /><Text size="xs" c="dimmed">{s.email || '—'}</Text></Group>
                  <Group gap={5}><Phone size={13} color="var(--text-muted)" /><Text size="xs" c="dimmed">{formatPhone(s.phone)}</Text></Group>
                  <Group gap={5}><IdCard size={13} color="var(--text-muted)" /><Text size="xs" c="dimmed">{formatCpfCnpj(s.cpf_cnpj)}</Text></Group>
                </Group>
              </div>
              <Group gap={4} align="flex-start">
                <div style={{ textAlign: 'right', marginRight: 6 }}>
                  <Text size="xs" c="dimmed">Assinou em {new Date(s.created_at).toLocaleString('pt-BR')}</Text>
                  {s.last_event && <Text size="xs" c="dimmed">Último evento: {s.last_event}</Text>}
                </div>
                <ActionIcon variant="light" color="red" radius="xl" onClick={() => setDeleting(s)} aria-label="Excluir assinante">
                  <Trash2 size={15} />
                </ActionIcon>
              </Group>
            </Group>
          </div>
        );
      })}

      <ConfirmDeleteModal opened={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} itemLabel={deleting?.name || 'este assinante'} loading={removing} />
    </div>
  );
}

function SubUsuariosTab() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [condoOptions, setCondoOptions] = useState([]);
  const [editCondominioIds, setEditCondominioIds] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => { setLoading(true); listAllSubUsuarios().then((data) => { setList(data); setLoading(false); }); };
  useEffect(load, []);

  const openEdit = async (sub) => {
    setEditing(sub);
    setEditCondominioIds(sub.condominioIds);
    const options = await getAccountCondominioOptions(sub.account_id);
    setCondoOptions(options.map((c) => ({ value: c.id, label: c.name })));
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      await updateSubUsuarioCondominios(editing.id, editCondominioIds);
      notifications.show({ color: 'green', message: 'Permissões atualizadas.' });
      setEditing(null);
      load();
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível atualizar as permissões.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setRemoving(true);
    try {
      await removeSubUsuario(deleting.id);
      notifications.show({ color: 'green', message: `${deleting.nome} removido.` });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível remover o sub-usuário.' });
    } finally {
      setRemoving(false);
      setDeleting(null);
      load();
    }
  };

  if (loading) return <Group justify="center" py={40}><Loader size="sm" color="brand" /></Group>;
  if (!list.length) return <Text c="dimmed" size="sm">Nenhum sub-usuário criado em nenhuma conta ainda.</Text>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((s) => (
        <div key={s.id} className="surface-card" style={{ padding: 14 }}>
          <Group justify="space-between" align="flex-start" wrap="wrap" gap={10}>
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={700}>{s.nome}</Text>
              <Text size="xs" c="dimmed">{s.email}</Text>
              <Text size="xs" c="dimmed" mt={2}>Conta principal: {s.contaPrincipal?.email || '—'}</Text>
              <Group gap={4} mt={6} wrap="wrap">
                {s.condominioNames.length ? (
                  s.condominioNames.map((name) => <Badge key={name} size="xs" variant="light" color="brand">{name}</Badge>)
                ) : (
                  <Badge size="xs" variant="light" color="gray">Nenhum condomínio</Badge>
                )}
              </Group>
            </div>
            <Group gap={4}>
              <ActionIcon variant="light" color="gray" radius="xl" onClick={() => openEdit(s)} aria-label="Editar permissões">
                <Pencil size={14} />
              </ActionIcon>
              <ActionIcon variant="light" color="red" radius="xl" onClick={() => setDeleting(s)} aria-label="Remover sub-usuário">
                <Trash2 size={14} />
              </ActionIcon>
            </Group>
          </Group>
        </div>
      ))}

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={`Permissões de ${editing?.nome || ''}`} centered>
        <MultiSelect label="Condomínios liberados" placeholder="Selecione um ou mais" data={condoOptions} value={editCondominioIds} onChange={setEditCondominioIds} mb="md" />
        <Button fullWidth onClick={handleSaveEdit} loading={savingEdit}>Salvar permissões</Button>
      </Modal>

      <ConfirmDeleteModal opened={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} itemLabel={deleting?.nome} loading={removing} />
    </div>
  );
}

export default function UsuariosPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      setCurrentUserId(session.user.id);
      const account = await accountsStore.getById(session.user.id);
      if (account?.role !== 'owner') { setLoading(false); return; }
      setAuthorized(true);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  if (!authorized) {
    return (
      <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
        <Text c="dimmed">Acesso restrito à conta administradora da plataforma.</Text>
      </div>
    );
  }

  return (
    <div>
      <Group gap={12} mb="xl">
        <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
          <Users size={19} color="var(--blue)" />
        </span>
        <div>
          <Text fw={800} size="1.6rem" className="font-display">Usuários</Text>
          <Text size="md" c="dimmed" mt={2}>Contas, assinantes e sub-usuários de toda a plataforma.</Text>
        </div>
      </Group>

      <Tabs defaultValue="usuarios">
        <Tabs.List mb="lg">
          <Tabs.Tab value="usuarios" leftSection={<Users size={15} />}>Usuários</Tabs.Tab>
          <Tabs.Tab value="assinantes" leftSection={<CreditCard size={15} />}>Assinantes</Tabs.Tab>
          <Tabs.Tab value="subusuarios" leftSection={<UserCog size={15} />}>Sub-usuários</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="usuarios"><UsuariosTab currentUserId={currentUserId} /></Tabs.Panel>
        <Tabs.Panel value="assinantes"><AssinantesTab /></Tabs.Panel>
        <Tabs.Panel value="subusuarios"><SubUsuariosTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
