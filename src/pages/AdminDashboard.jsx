import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, TextInput, Text, Group, Modal, Loader, SimpleGrid, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Building2, ChevronRight, LayoutGrid, Pencil, Lock, ArrowRight } from 'lucide-react';
import { condominiosStore, ambientesStore, accountsStore } from '../lib/stores';
import { getSession } from '../lib/authService';

const PLAN_LABELS = { start: 'Start', pro: 'Pro', business: 'Business' };

function getBlockedMessage(account, condominiosCount) {
  if (!account) return '';
  if (account.role === 'owner') return ''; // conta dona da plataforma: sem limite
  if (account.status === 'inativo') {
    return 'Sua assinatura está inativa (pagamento pendente). Regularize o pagamento para voltar a cadastrar condomínios.';
  }
  if (account.status === 'trial') {
    return 'Você ainda não tem um plano ativo. Assine um plano para começar a cadastrar condomínios.';
  }
  if (condominiosCount >= (account.condominio_limit || 0)) {
    const planLabel = PLAN_LABELS[account.plan_name] || account.plan_name || '';
    return `Você atingiu o limite de ${account.condominio_limit} condomínio(s) do plano ${planLabel}. Faça upgrade para cadastrar mais.`;
  }
  return '';
}

export default function AdminDashboard() {
  const [condominios, setCondominios] = useState([]);
  const [ambienteCounts, setAmbienteCounts] = useState({});
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    const session = await getSession();
    if (session) {
      const acc = await accountsStore.getById(session.user.id);
      setAccount(acc);
    }
    const list = await condominiosStore.list();
    setCondominios(list);
    const allAmbientes = await ambientesStore.list();
    const counts = {};
    allAmbientes.forEach((a) => { counts[a.condominio_id] = (counts[a.condominio_id] || 0) + 1; });
    setAmbienteCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const blockedMessage = getBlockedMessage(account, condominios.length);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await condominiosStore.create({ name: newName.trim() });
      setNewName('');
      setModalOpen(false);
      load();
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err.code === 'CI001' ? (blockedMessage || err.message) : 'Não foi possível criar o condomínio. Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (e, condominio) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(condominio);
    setEditName(condominio.name);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editing) return;
    setSavingEdit(true);
    await condominiosStore.update(editing.id, { name: editName.trim() });
    setSavingEdit(false);
    setEditing(null);
    load();
  };

  return (
    <div>
      <Group justify="space-between" mb="xl" align="flex-start">
        <div>
          <Text fw={800} size="1.6rem" className="font-display">Condomínios</Text>
          <Text size="md" c="dimmed" mt={2}>Selecione um condomínio para gerenciar ambientes e checklists.</Text>
        </div>
        <Button
          leftSection={<Plus size={16} />}
          onClick={() => setModalOpen(true)}
          disabled={loading || !!blockedMessage}
          className="btn-glow"
          style={{ boxShadow: 'var(--shadow-brand)' }}
        >
          Novo condomínio
        </Button>
      </Group>

      {!loading && blockedMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', marginBottom: 20,
          background: 'var(--amber-light)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12,
          flexWrap: 'wrap',
        }}>
          <Lock size={17} color="var(--amber)" style={{ flexShrink: 0 }} />
          <Text size="sm" fw={600} style={{ color: '#92620a', flex: 1, minWidth: 220 }}>{blockedMessage}</Text>
          <Button component={Link} to="/?scrollTo=planos" size="xs" variant="white" rightSection={<ArrowRight size={13} />}>
            Ver planos
          </Button>
        </div>
      )}

      {loading ? (
        <Group justify="center" py={60}><Loader color="brand" /></Group>
      ) : condominios.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {condominios.map((c) => (
            <Link key={c.id} to={`/admin/condominios/${c.id}`} className="surface-card surface-card--hover" style={{ display: 'block', padding: 22 }}>
              <Group justify="space-between">
                <Group gap={12}>
                  <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
                    <Building2 size={19} color="var(--blue)" />
                  </span>
                  <Text fw={700} size="md">{c.name}</Text>
                </Group>
                <Group gap={4}>
                  <ActionIcon variant="subtle" color="gray" radius="xl" onClick={(e) => openEdit(e, c)} aria-label="Editar condomínio">
                    <Pencil size={15} />
                  </ActionIcon>
                  <ChevronRight size={18} color="var(--text-faint)" />
                </Group>
              </Group>
              <Text size="sm" c="dimmed" mt={12}>{ambienteCounts[c.id] || 0} ambiente(s) cadastrado(s)</Text>
            </Link>
          ))}
        </SimpleGrid>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px' }}>
            <LayoutGrid size={24} color="var(--blue)" />
          </span>
          <Text c="dimmed">Nenhum condomínio cadastrado ainda. Clique em &quot;Novo condomínio&quot; para começar.</Text>
        </div>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Novo condomínio">
        <TextInput
          label="Nome do condomínio"
          placeholder="Ex: Residencial Jardins"
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          data-autofocus
        />
        <Button fullWidth mt="lg" onClick={handleCreate} loading={saving}>Criar</Button>
      </Modal>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title="Editar condomínio">
        <TextInput
          label="Nome do condomínio"
          value={editName}
          onChange={(e) => setEditName(e.currentTarget.value)}
          data-autofocus
        />
        <Button fullWidth mt="lg" onClick={handleSaveEdit} loading={savingEdit}>Salvar</Button>
      </Modal>
    </div>
  );
}
