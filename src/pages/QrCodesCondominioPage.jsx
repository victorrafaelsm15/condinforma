import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Text, Group, Loader, ActionIcon, Breadcrumbs, Button, TextInput } from '@mantine/core';
import { ArrowLeft, Printer, DoorOpen, LayoutGrid, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { condominiosStore, ambientesStore } from '../lib/stores';
import AmbienteQrCards from '../components/admin/AmbienteQrCards';

const PAGE_SIZE = 3;

export default function QrCodesCondominioPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [condominio, setCondominio] = useState(null);
  const [ambientes, setAmbientes] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    Promise.all([
      condominiosStore.getById(id),
      ambientesStore.list({ condominio_id: id }),
    ]).then(([c, list]) => {
      setCondominio(c);
      setAmbientes(list);
      setLoading(false);
    });
  }, [id]);

  const filteredAmbientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ambientes;
    return ambientes.filter((a) => a.name.toLowerCase().includes(q));
  }, [ambientes, search]);

  const allQrIds = useMemo(
    () => filteredAmbientes.flatMap((a) => [`qr-${a.id}-exec`, `qr-${a.id}-status`]),
    [filteredAmbientes],
  );

  const toggleQr = (qrId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qrId)) next.delete(qrId);
      else next.add(qrId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allQrIds));
  const deselectAll = () => setSelectedIds(new Set());
  const hasSelection = selectedIds.size > 0;

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div className={hasSelection ? 'has-selection' : ''}>
      <Group gap={10} mb="md" className="no-print">
        <ActionIcon component={Link} to={`/admin/condominios/${id}/dashboard`} variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Link to={`/admin/condominios/${id}/dashboard`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{condominio?.name}</Link>
          <Text size="md" fw={600} c="dimmed">QR Codes</Text>
        </Breadcrumbs>
      </Group>

      <Group justify="space-between" align="flex-start" mb="lg" className="no-print" wrap="wrap">
        <div>
          <Text fw={800} size="1.6rem">QR Codes: {condominio?.name}</Text>
          <Text size="md" c="dimmed" mt={2}>Todos os ambientes em um só lugar, prontos pra reimprimir.</Text>
        </div>
        <Button leftSection={<Printer size={16} />} onClick={() => window.print()} disabled={!ambientes.length}>
          {hasSelection ? `Imprimir selecionados (${selectedIds.size})` : 'Imprimir todos'}
        </Button>
      </Group>

      {!!ambientes.length && (
        <Group justify="space-between" align="center" mb="xl" className="no-print" wrap="wrap" gap={10}>
          <TextInput
            placeholder="Buscar ambiente..."
            leftSection={<Search size={15} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ maxWidth: 280, flex: 1 }}
          />
          <Group gap={8}>
            <Button size="xs" variant="light" onClick={selectAll} disabled={!allQrIds.length}>Selecionar todos</Button>
            <Button size="xs" variant="light" color="gray" onClick={deselectAll} disabled={!hasSelection}>Desmarcar todos</Button>
          </Group>
        </Group>
      )}

      <div className="print-title" style={{ display: 'none', marginBottom: 24 }}>
        <Text fw={800} size="xl">{condominio?.name}: QR Codes dos ambientes</Text>
      </div>

      {ambientes.length ? (
        filteredAmbientes.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {filteredAmbientes.map((a, i) => (
              <div
                key={a.id}
                className={i >= PAGE_SIZE ? 'qr-print-block qr-extra' : 'qr-print-block'}
                style={{ pageBreakInside: 'avoid', display: i >= PAGE_SIZE && !showAll ? 'none' : undefined }}
              >
                <Group gap={10} mb={12}>
                  <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 32, height: 32, borderRadius: 10 }}>
                    <DoorOpen size={16} color="var(--blue)" />
                  </span>
                  <Text fw={700} size="md">{a.name}</Text>
                </Group>
                <AmbienteQrCards ambiente={a} selectable selectedIds={selectedIds} onToggle={toggleQr} />
              </div>
            ))}
            {filteredAmbientes.length > PAGE_SIZE && (
              <Button
                variant="subtle"
                color="gray"
                onClick={() => setShowAll((v) => !v)}
                leftSection={showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                className="no-print"
              >
                {showAll ? 'Ver menos' : `Ver mais ambientes (${filteredAmbientes.length - PAGE_SIZE})`}
              </Button>
            )}
          </div>
        ) : (
          <div className="surface-card no-print" style={{ textAlign: 'center', padding: '56px 24px' }}>
            <Text c="dimmed">Nenhum ambiente encontrado para &quot;{search}&quot;.</Text>
          </div>
        )
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px' }}>
            <LayoutGrid size={24} color="var(--blue)" />
          </span>
          <Text c="dimmed">Nenhum ambiente cadastrado neste condomínio ainda.</Text>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-title { display: block !important; }
          .admin-nav-link, header { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          .qr-print-block { break-inside: avoid; margin-bottom: 24px; }
          /* "Imprimir todos" sempre sai completo, mesmo com "Ver mais" ainda
             recolhido na tela — a paginação é só uma conveniência visual. */
          .qr-extra { display: block !important; }
          /* Com seleção ativa, só os QR Codes marcados saem impressos — e o
             bloco do ambiente inteiro some se nenhum dos seus QR Codes foi
             selecionado. Sem seleção nenhuma, imprime tudo (regra acima). */
          .has-selection .qr-card:not(.selected) { display: none !important; }
          .has-selection .qr-print-block:not(:has(.qr-card.selected)) { display: none !important; }
        }
      `}</style>
    </div>
  );
}
