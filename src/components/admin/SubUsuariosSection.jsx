import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Text, Group, Button, Modal, TextInput, PasswordInput, MultiSelect, Badge, ActionIcon, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { UserPlus, Pencil, Trash2, TrendingUp, ArrowRight } from 'lucide-react';
import { getSession } from '../../lib/authService';
import { accountsStore, condominiosStore } from '../../lib/stores';
import { listSubUsuarios, createSubUsuario, updateSubUsuarioCondominios, removeSubUsuario } from '../../lib/subUsuario';
import { logAudit } from '../../lib/auditLog';

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
  const unlimitedAccess = account?.role === 'owner' || !!account?.bypass_limits;
  const atLimit = !unlimitedAccess && subUsuarios.length >= limit;
  // Aviso preventivo: falta exatamente 1 sub-usuário pra bater o limite do
  // plano — não bloqueia nada, só avisa. Some sozinho se atLimit já
  // cobrir (bloqueado) ou se a conta se afastar do limite (ex.: remover
  // um sub-usuário).
  const nearLimit = !unlimitedAccess && !atLimit && limit > 0 && limit - subUsuarios.length === 1;
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
      const created = await createSubUsuario({ nome: nome.trim(), email: email.trim(), password, condominioIds });
      logAudit({ action: 'sub_usuario.criado', entityType: 'sub_usuario', entityId: created?.id, details: { nome: nome.trim(), email: email.trim() } });
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
      logAudit({ action: 'sub_usuario.editado', entityType: 'sub_usuario', entityId: editing.id, details: { nome: editing.nome, condominioIds: editCondominioIds } });
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
      logAudit({ action: 'sub_usuario.excluido', entityType: 'sub_usuario', entityId: sub.id, details: { nome: sub.nome, email: sub.email } });
      load();
      notifications.show({ color: 'green', message: `${sub.nome} removido.` });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível remover o sub-usuário.' });
    }
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
      <Group justify="flex-end" mb="lg">
        <Button leftSection={<UserPlus size={16} />} onClick={openCreate} disabled={atLimit} className="btn-glow" style={{ boxShadow: 'var(--shadow-brand)' }}>
          Novo sub-usuário
        </Button>
      </Group>

      <Text size="sm" c="dimmed" mb={12}>
        {unlimitedAccess ? 'Conta sem limite de sub-usuários.' : `${subUsuarios.length} de ${limit} sub-usuário(s) do plano${account?.plan_name ? ` ${PLAN_LABELS[account.plan_name] || account.plan_name}` : ''}.`}
      </Text>

      {atLimit && (
        <Text size="xs" c="red" mb={12}>
          Limite de sub-usuários do plano atingido. Faça upgrade para adicionar mais.
        </Text>
      )}

      {nearLimit && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 12,
          background: 'var(--amber-light)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10,
          flexWrap: 'wrap',
        }}>
          <TrendingUp size={14} color="var(--amber)" style={{ flexShrink: 0 }} />
          <Text size="xs" fw={600} style={{ color: '#92620a', flex: 1, minWidth: 160 }}>
            Você está usando {subUsuarios.length} de {limit} sub-usuário(s) do seu plano. Considere fazer upgrade para continuar crescendo.
          </Text>
          <Button component={Link} to="/?scrollTo=planos" size="xs" variant="white" rightSection={<ArrowRight size={12} />}>
            Ver planos
          </Button>
        </div>
      )}

      {subUsuarios.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subUsuarios.map((sub) => (
            <div key={sub.id} className="surface-card" style={{ padding: 14 }}>
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
        <Text size="sm" c="dimmed">Nenhum sub-usuário criado ainda.</Text>
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
