import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Text, Group, Loader, ActionIcon, Breadcrumbs, Button, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, FileDown, DoorOpen, LayoutGrid, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { condominiosStore, ambientesStore } from '../lib/stores';
import { getSession } from '../lib/authService';
import AmbienteQrCards, { getAmbienteQrCardDefs } from '../components/admin/AmbienteQrCards';
import { generateQrCodesPdf, downloadQrCodesPdf } from '../lib/qrCodesPdf';

const PAGE_SIZE = 3;

export default function QrCodesCondominioPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [condominio, setCondominio] = useState(null);
  const [ambientes, setAmbientes] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

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

  // Sem seleção: exporta todos os QR Codes dos ambientes visíveis (mesmo
  // critério do botão antigo "Imprimir todos"). Com seleção: só os
  // marcados — e o ambiente inteiro some se nenhum dos seus 2 QR Codes
  // foi marcado. É a mesma função pra 1 ou pra vários: o card completo
  // (cor, título, nome do ambiente, QR Code) sai igual em ambos os casos.
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const sections = filteredAmbientes
        .map((a) => {
          const cards = getAmbienteQrCardDefs(a).filter((c) => !hasSelection || selectedIds.has(c.id));
          return { ambienteName: a.name, cards };
        })
        .filter((section) => section.cards.length);

      if (!sections.length) {
        notifications.show({ color: 'yellow', message: 'Nenhum QR Code selecionado para exportar.' });
        return;
      }

      const session = await getSession();
      const { doc } = await generateQrCodesPdf({
        condominioName: condominio?.name,
        sections,
        userEmail: session?.user?.email,
      });
      downloadQrCodesPdf(doc, `qrcodes-${condominio?.name || 'condominio'}.pdf`);
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível gerar o PDF agora. Tente novamente.' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to={`/admin/condominios/${id}/dashboard`} variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Link to={`/admin/condominios/${id}/dashboard`} style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>{condominio?.name}</Link>
          <Text size="md" fw={600} c="dimmed">QR Codes</Text>
        </Breadcrumbs>
      </Group>

      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <div>
          <Text fw={800} size="1.6rem">QR Codes: {condominio?.name}</Text>
          <Text size="md" c="dimmed" mt={2}>Todos os ambientes em um só lugar, prontos pra reimprimir.</Text>
        </div>
        <Button leftSection={<FileDown size={16} />} onClick={handleExportPdf} loading={exporting} disabled={!ambientes.length}>
          {hasSelection ? `Baixar PDF (${selectedIds.size})` : 'Baixar PDF (todos)'}
        </Button>
      </Group>

      {!!ambientes.length && (
        <Group justify="space-between" align="center" mb="xl" wrap="wrap" gap={10}>
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

      {ambientes.length ? (
        filteredAmbientes.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {filteredAmbientes.map((a, i) => (
              <div key={a.id} style={{ display: i >= PAGE_SIZE && !showAll ? 'none' : undefined }}>
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
              >
                {showAll ? 'Ver menos' : `Ver mais ambientes (${filteredAmbientes.length - PAGE_SIZE})`}
              </Button>
            )}
          </div>
        ) : (
          <div className="surface-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
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
    </div>
  );
}
