import { useEffect, useState } from 'react';
import {
  Text, Group, Button, Modal, TextInput, PasswordInput, MultiSelect, Badge, ActionIcon, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { UserPlus, Pencil, Trash2, Users } from 'lucide-react';
import { getSession } from '../../lib/authService';
import { accountsStore, condominiosStore } from '../../lib/stores';
import { listSubUsuarios, createSubUsuario, updateSubUsuarioCondominios, removeSubUsuario } from '../../lib/subUsuario';

const PLAN_LABELS = { start: 'Start', pro: 'Pro', business: 'Business' };

export default function SubUsuariosSection() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [condominios, setCondominios] = useState([]);
  const [subUsuarios, setSubUsuarios] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [condominioIds, setCondominioIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [editing, setEditing] = useState(null);
  const [editCondominioIds, setEditCondominioIds] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    const [acc, condos, subs] = await Promise.all([
      accountsStore.getById(session.user.id),
      condominiosStore.list(),
      listSubUsuarios(session.user.id),
    ]);
    setAccount(acc);
    setCondominios(condos);
    setSubUsuarios(subs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const limit = account?.sub_usuario_limit || 0;
  const isOwner = account?.role === 'owner';
  const atLimit = !isOwner && subUsuarios.length >= limit;
  const condoOptions = condominios.map((c) => ({ value: c.id, label: c.name }));

  const openCreate = () => {
    setNome('');
    setEmail('');
    setPassword('');
    setCondominioIds([]);
    setFormError('');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!nome.trim() || !email.trim() || !password || !condominioIds.length) {
      setFormError('Preencha nome, e-mail, senha e selecione ao menos um condomínio.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await createSubUsuario({ nome: nome.trim(), email: email.trim(), password, condominioIds });
      setCreateOpen(false);
      load();
      notifications.show({ color: 'green', message: 'Sub-usuário criado com sucesso.' });
    } catch (err) {
      setFormError(err.message || 'Não foi possível criar o sub-usuário.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (sub) => {
    setEditing(sub);
    setEditCondominioIds(sub.condominioIds);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await updateSubUsuarioCondominios(editing.id, editCondominioIds);
      setEditing(null);
      load();
      notifications.show({ color: 'green', message: 'Permissões atualizadas.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível atualizar as permissões.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemove = async (sub) => {
    try {
      await removeSubUsuario(sub.id);
      load();
      notifications.show({ color: 'green', message: `${sub.nome} removido.` });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível remover o sub-usuário.' });
    }
  };

  if (loading) return <Group justify="center" py={30}><Loader size="sm" color="brand" /></Group>;

  return (
    <div>
      <Group justify="space-between" mb={10}>
        <Group gap={8}>
          <Users size={16} color="var(--blue)" />
          <Text fw={700} size="sm">Sub-usuários</Text>
        </Group>
        <Button size="xs" leftSection={<UserPlus size={14} />} onClick={openCreate} disabled={atLimit}>
          Novo
        </Button>
      </Group>

      <Text size="xs" c="dimmed" mb={12}>
        {isOwner ? 'Conta sem limite de sub-usuários.' : `${subUsuarios.length} de ${limit} sub-usuário(s) do plano${account?.plan_name ? ` ${PLAN_LABELS[account.plan_name] || account.plan_name}` : ''}.`}
      </Text>

      {atLimit && (
        <Text size="xs" c="red" mb={12}>
          Limite de sub-usuários do plano atingido. Faça upgrade para adicionar mais.
        </Text>
      )}

      {subUsuarios.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subUsuarios.map((sub) => (
            <div key={sub.id} className="surface-card" style={{ padding: 12 }}>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>{sub.nome}</Text>
                  <Text size="xs" c="dimmed" truncate>{sub.email}</Text>
                  <Group gap={4} mt={6} wrap="wrap">
                    {sub.condominioIds.length ? (
                      condominios
                        .filter((c) => sub.condominioIds.includes(c.id))
                        .map((c) => <Badge key={c.id} size="xs" variant="light" color="brand">{c.name}</Badge>)
                    ) : (
                      <Badge size="xs" variant="light" color="gray">Nenhum condomínio</Badge>
                    )}
                  </Group>
                </div>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon variant="light" color="gray" radius="xl" onClick={() => openEdit(sub)} aria-label="Editar permissões">
                    <Pencil size={14} />
                  </ActionIcon>
                  <ActionIcon variant="light" color="red" radius="xl" onClick={() => handleRemove(sub)} aria-label="Remover sub-usuário">
                    <Trash2 size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            </div>
          ))}
        </div>
      ) : (
        <Text size="xs" c="dimmed">Nenhum sub-usuário criado ainda.</Text>
      )}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Novo sub-usuário" centered>
        <TextInput label="Nome" value={nome} onChange={(e) => setNome(e.currentTarget.value)} mb="sm" data-autofocus />
        <TextInput label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} mb="sm" />
        <PasswordInput label="Senha inicial" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.currentTarget.value)} mb="sm" />
        <MultiSelect
          label="Condomínios liberados"
          placeholder="Selecione um ou mais"
          data={condoOptions}
          value={condominioIds}
          onChange={setCondominioIds}
          mb="sm"
        />
        {formError && <Text size="sm" c="red" mb="sm">{formError}</Text>}
        <Button fullWidth onClick={handleCreate} loading={saving}>Criar sub-usuário</Button>
      </Modal>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={`Permissões de ${editing?.nome || ''}`} centered>
        <MultiSelect
          label="Condomínios liberados"
          placeholder="Selecione um ou mais"
          data={condoOptions}
          value={editCondominioIds}
          onChange={setEditCondominioIds}
          mb="md"
        />
        <Button fullWidth onClick={handleSaveEdit} loading={savingEdit}>Salvar permissões</Button>
      </Modal>
    </div>
  );
}
