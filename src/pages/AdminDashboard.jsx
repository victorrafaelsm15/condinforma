import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, TextInput, Text, Group, Modal, Loader, SimpleGrid } from '@mantine/core';
import { Plus, Building2, ChevronRight, LayoutGrid } from 'lucide-react';
import { condominiosStore, ambientesStore } from '../lib/stores';

export default function AdminDashboard() {
  const [condominios, setCondominios] = useState([]);
  const [ambienteCounts, setAmbienteCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await condominiosStore.list();
    setCondominios(list);
    const allAmbientes = await ambientesStore.list();
    const counts = {};
    allAmbientes.forEach((a) => { counts[a.condominio_id] = (counts[a.condominio_id] || 0) + 1; });
    setAmbienteCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await condominiosStore.create({ name: newName.trim() });
    setNewName('');
    setModalOpen(false);
    setSaving(false);
    load();
  };

  return (
    <div>
      <Group justify="space-between" mb="xl" align="flex-start">
        <div>
          <Text fw={800} size="xl" className="font-display">Condomínios</Text>
          <Text size="sm" c="dimmed">Selecione um condomínio para gerenciar ambientes e checklists.</Text>
        </div>
        <Button leftSection={<Plus size={16} />} onClick={() => setModalOpen(true)} className="btn-glow" style={{ boxShadow: 'var(--shadow-brand)' }}>
          Novo condomínio
        </Button>
      </Group>

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
                  <Text fw={700}>{c.name}</Text>
                </Group>
                <ChevronRight size={18} color="var(--text-faint)" />
              </Group>
              <Text size="xs" c="dimmed" mt={12}>{ambienteCounts[c.id] || 0} ambiente(s) cadastrado(s)</Text>
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
    </div>
  );
}
