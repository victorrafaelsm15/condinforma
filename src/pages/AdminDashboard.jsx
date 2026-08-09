import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, TextInput, Text, Group, Modal, Loader, SimpleGrid, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Building2, ChevronRight, LayoutGrid, Pencil, Trash2, Lock, ArrowRight, TrendingUp } from 'lucide-react';
import { condominiosStore, ambientesStore, accountsStore } from '../lib/stores';
import { getSession } from '../lib/authService';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import { logAudit } from '../lib/auditLog';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import OnboardingWizard from '../components/admin/OnboardingWizard';

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

// Aviso preventivo — dispara quando falta exatamente 1 condomínio pra
// bater o limite do plano, não bloqueante (o botão "Novo condomínio"
// continua liberado). Some sozinho se a conta se afastar do limite de
// novo (ex.: excluir um condomínio) ou já estiver bloqueada (nesse caso
// getBlockedMessage acima já cobre o aviso).
function getNearLimitMessage(account, condominiosCount) {
  if (!account || account.role === 'owner') return '';
  if (account.status !== 'ativo') return '';
  const limit = account.condominio_limit || 0;
  if (limit <= 0 || condominiosCount >= limit) return '';
  if (limit - condominiosCount !== 1) return '';
  const planLabel = PLAN_LABELS[account.plan_name] || account.plan_name || '';
  return `Você está usando ${condominiosCount} de ${limit} condomínio(s) do plano ${planLabel}. Considere fazer upgrade para continuar crescendo.`;
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [condominios, setCondominios] = useState([]);
  const [ambienteCounts, setAmbienteCounts] = useState({});
  const [account, setAccount] = useState(null);
  const [isSubUsuario, setIsSubUsuario] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    setLoading(true);
    const session = await getSession();
    let acc = null;
    let subInfo = null;
    if (session) {
      subInfo = await getSubUsuarioInfo(session.user.id);
      setIsSubUsuario(!!subInfo);
      // Sub-usuário nunca gerencia plano/limite — isso é só da conta
      // principal, então nem busca o próprio account (irrelevante: seria
      // sempre um "trial" vazio, sem relação com o plano de quem o convidou).
      if (!subInfo) {
        acc = await accountsStore.getById(session.user.id);
        setAccount(acc);
      }
    }
    const list = await condominiosStore.list();
    setCondominios(list);
    const allAmbientes = await ambientesStore.list();
    const counts = {};
    allAmbientes.forEach((a) => { counts[a.condominio_id] = (counts[a.condominio_id] || 0) + 1; });
    setAmbienteCounts(counts);
    setLoading(false);

    // Onboarding guiado: só faz sentido pra conta principal (sub-usuário
    // nunca cria condomínio) — só aparece sozinho pra conta nova que ainda
    // não passou do primeiro condomínio. O reabrir forçado via "Ver
    // tutorial" (?tutorial=1) é tratado num efeito à parte abaixo, porque
    // navegar de /admin pra /admin?tutorial=1 não remonta este componente
    // (mesma rota), então esse load() aqui só roda uma vez no mount e
    // nunca veria a mudança do parâmetro.
    if (!subInfo && acc && !acc.onboarding_completed && list.length === 0) {
      setWizardOpen(true);
    }
  };

  useEffect(() => { load(); }, []);

  // Reabre o wizard sempre que ?tutorial=1 aparecer na URL (botão "Ver
  // tutorial" em Configurações) — roda de novo a cada mudança de
  // searchParams, diferente do load() acima que só roda no mount.
  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setWizardOpen(true);
      searchParams.delete('tutorial');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const blockedMessage = isSubUsuario ? '' : getBlockedMessage(account, condominios.length);
  const nearLimitMessage = isSubUsuario || blockedMessage ? '' : getNearLimitMessage(account, condominios.length);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await condominiosStore.create({ name: newName.trim() });
      logAudit({ action: 'condominio.criado', entityType: 'condominio', entityId: created.id, details: { name: created.name } });
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
    const oldName = editing.name;
    await condominiosStore.update(editing.id, { name: editName.trim() });
    logAudit({ action: 'condominio.editado', entityType: 'condominio', entityId: editing.id, details: { antes: oldName, depois: editName.trim() } });
    setSavingEdit(false);
    setEditing(null);
    load();
  };

  const openDelete = (e, condominio) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(condominio);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      // Ambientes, checklists, execuções e ocorrências desse condomínio
      // já saem junto — são "on delete cascade" no banco (ver schema.sql).
      await condominiosStore.remove(deleting.id);
      logAudit({ action: 'condominio.excluido', entityType: 'condominio', entityId: deleting.id, details: { name: deleting.name } });
      notifications.show({ color: 'green', message: `${deleting.name} excluído.` });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir o condomínio.' });
    } finally {
      setRemoving(false);
      setDeleting(null);
      load();
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="xl" align="flex-start">
        <div>
          <Text fw={800} size="1.6rem" className="font-display">Condomínios</Text>
          <Text size="md" c="dimmed" mt={2}>Selecione um condomínio para gerenciar ambientes e checklists.</Text>
        </div>
        {/* Sub-usuário nunca cria condomínio — isso é da conta principal,
            que é quem paga pelo condominio_limit. Esconde em vez de
            desabilitar, pra não confundir com uma mensagem de plano que
            não é dele. */}
        {!isSubUsuario && (
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => setModalOpen(true)}
            disabled={loading || !!blockedMessage}
            className="btn-glow"
            style={{ boxShadow: 'var(--shadow-brand)' }}
          >
            Novo condomínio
          </Button>
        )}
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

      {!loading && nearLimitMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', marginBottom: 20,
          background: 'var(--amber-light)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12,
          flexWrap: 'wrap',
        }}>
          <TrendingUp size={17} color="var(--amber)" style={{ flexShrink: 0 }} />
          <Text size="sm" fw={600} style={{ color: '#92620a', flex: 1, minWidth: 220 }}>{nearLimitMessage}</Text>
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
                  {/* Sub-usuário só enxerga o condomínio (RLS de select),
                      não pode renomear — esconde o lápis pra não deixar
                      cair no fallback silencioso de localStorage do
                      createStore quando o RLS recusar o update. */}
                  {!isSubUsuario && (
                    <>
                      <ActionIcon variant="light" color="gray" radius="xl" onClick={(e) => openEdit(e, c)} aria-label="Editar condomínio">
                        <Pencil size={15} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" radius="xl" onClick={(e) => openDelete(e, c)} aria-label="Excluir condomínio">
                        <Trash2 size={15} />
                      </ActionIcon>
                    </>
                  )}
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
          <Text c="dimmed">
            {isSubUsuario
              ? 'Nenhum condomínio liberado pra você ainda. Peça pra quem administra a conta liberar acesso.'
              : 'Nenhum condomínio cadastrado ainda. Clique em "Novo condomínio" para começar.'}
          </Text>
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

      <ConfirmDeleteModal
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        itemLabel={deleting?.name}
        loading={removing}
      />

      {!isSubUsuario && account && (
        <OnboardingWizard
          opened={wizardOpen}
          onClose={() => setWizardOpen(false)}
          accountId={account.id}
          hasCondominio={condominios.length > 0}
          firstCondominio={condominios[0] || null}
          onCondominioCreated={load}
        />
      )}
    </div>
  );
}
