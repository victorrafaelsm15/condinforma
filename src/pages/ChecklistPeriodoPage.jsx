import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Text, Group, Breadcrumbs, Loader, Badge, ActionIcon, Tabs } from '@mantine/core';
import { ArrowLeft, History, ClipboardCheck, Archive, ChevronRight } from 'lucide-react';
import { ambientesStore, condominiosStore, checklistPeriodosStore, checklistItemsStore } from '../lib/stores';
import HistoryTab from '../components/admin/HistoryTab';

// Período fechado — histórico read-only. Mostra o estado exato de cada
// item no momento do fechamento (ver closePeriodoAndStartNew em
// checklistPeriodos.js): nenhuma edição acontece aqui, só consulta.
export default function ChecklistPeriodoPage() {
  const { ambienteId, periodoId } = useParams();
  const [ambiente, setAmbiente] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('itens');

  const load = async () => {
    const p = await checklistPeriodosStore.getById(periodoId);
    setPeriodo(p);
    if (p) {
      const [amb, itemsList] = await Promise.all([
        ambientesStore.getById(p.ambiente_id),
        checklistItemsStore.list({ checklist_periodo_id: periodoId }),
      ]);
      setAmbiente(amb);
      if (amb) setCondominio(await condominiosStore.getById(amb.condominio_id));
      setItems(itemsList.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodoId]);

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;
  if (!periodo || !ambiente) return <Text>Período não encontrado.</Text>;

  const concluidos = items.filter((i) => i.status === 'concluido').length;

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to={`/admin/ambientes/${ambienteId}`} variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar para o ambiente">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Link to={`/admin/condominios/${ambiente.condominio_id}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{condominio?.name || 'Condomínio'}</Link>
          <Link to={`/admin/ambientes/${ambienteId}`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{ambiente.name}</Link>
          <Text size="md" fw={600}>{periodo.nome}</Text>
        </Breadcrumbs>
      </Group>

      <Group gap={12} mb="lg" justify="space-between" wrap="wrap">
        <Group gap={10} style={{ background: '#6b7280', borderRadius: 999, padding: '8px 20px 8px 10px' }}>
          <span style={{
            width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Archive size={17} color="#fff" />
          </span>
          <Text fw={800} size="1.6rem" className="font-display" c="#fff" lh={1.2}>{periodo.nome}</Text>
        </Group>
        <Group gap={12}>
          <Badge color="gray" variant="light" size="lg">Fechado</Badge>
          <Text size="sm" c="dimmed">
            {new Date(periodo.started_at).toLocaleDateString('pt-BR')}
            {periodo.closed_at ? ` — ${new Date(periodo.closed_at).toLocaleDateString('pt-BR')}` : ''}
          </Text>
        </Group>
      </Group>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          tab: { fontWeight: 600, fontSize: 14, borderRadius: 999, border: 'none', padding: '9px 18px', transition: 'all 0.2s var(--ease)' },
          list: { border: 'none', gap: 8, flexWrap: 'wrap' },
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="itens"
            leftSection={<ClipboardCheck size={15} />}
            style={{ background: activeTab === 'itens' ? 'var(--green)' : 'var(--green-light)', color: activeTab === 'itens' ? '#fff' : 'var(--green)' }}
          >
            Itens ({concluidos}/{items.length})
          </Tabs.Tab>
          <Tabs.Tab
            value="historico"
            leftSection={<History size={15} />}
            style={{ background: activeTab === 'historico' ? '#6b7280' : '#eef0f3', color: activeTab === 'historico' ? '#fff' : '#6b7280' }}
          >
            Histórico
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="itens" pt="lg">
          <Text size="sm" c="dimmed" mb="md">
            Período fechado — este é o estado exato de cada item no momento do fechamento. Clique num item para ver todos os detalhes.
          </Text>
          {items.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((item, i) => (
                <Link
                  key={item.id}
                  to={`/admin/ambientes/${ambienteId}/checklist/itens/${item.id}`}
                  className="surface-card surface-card--hover"
                  style={{ display: 'block', padding: '16px 18px' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={12} wrap="nowrap" style={{ minWidth: 0 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0, fontSize: 13, fontWeight: 700,
                        background: item.status === 'concluido' ? 'var(--green)' : '#eef0f3', color: item.status === 'concluido' ? '#fff' : '#6b7280',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {i + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <Text size="md" truncate>{item.task}</Text>
                        {item.resolvido_por && <Text size="sm" c="dimmed">Concluído por {item.resolvido_por}</Text>}
                      </div>
                    </Group>
                    <Group gap={10} wrap="nowrap">
                      <Badge size="sm" color={item.status === 'concluido' ? 'green' : 'gray'} variant="light">
                        {item.status === 'concluido' ? 'Concluído' : 'Pendente'}
                      </Badge>
                      <ChevronRight size={18} color="var(--text-faint)" />
                    </Group>
                  </Group>
                </Link>
              ))}
            </div>
          ) : (
            <Text c="dimmed" size="sm">Nenhum item neste período.</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="historico" pt="lg">
          <HistoryTab
            ambienteId={periodo.ambiente_id}
            ambienteName={`${ambiente.name} — ${periodo.nome}`}
            condominioName={condominio?.name}
            periodoId={periodo.id}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
