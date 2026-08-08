import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Text, Group, Loader, ActionIcon, Breadcrumbs, Button } from '@mantine/core';
import { ArrowLeft, Printer, DoorOpen, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react';
import { condominiosStore, ambientesStore } from '../lib/stores';
import AmbienteQrCards from '../components/admin/AmbienteQrCards';

const PAGE_SIZE = 3;

export default function QrCodesCondominioPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [condominio, setCondominio] = useState(null);
  const [ambientes, setAmbientes] = useState([]);
  const [showAll, setShowAll] = useState(false);

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

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
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

      <Group justify="space-between" align="flex-start" mb="xl" className="no-print" wrap="wrap">
        <div>
          <Text fw={800} size="1.6rem">QR Codes — {condominio?.name}</Text>
          <Text size="md" c="dimmed" mt={2}>Todos os ambientes em um só lugar, prontos pra reimprimir.</Text>
        </div>
        <Button leftSection={<Printer size={16} />} onClick={() => window.print()} disabled={!ambientes.length}>
          Imprimir todos
        </Button>
      </Group>

      <div className="print-title" style={{ display: 'none', marginBottom: 24 }}>
        <Text fw={800} size="xl">{condominio?.name} — QR Codes dos ambientes</Text>
      </div>

      {ambientes.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {ambientes.map((a, i) => (
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
              <AmbienteQrCards ambiente={a} />
            </div>
          ))}
          {ambientes.length > PAGE_SIZE && (
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setShowAll((v) => !v)}
              leftSection={showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              className="no-print"
            >
              {showAll ? 'Ver menos' : `Ver mais ambientes (${ambientes.length - PAGE_SIZE})`}
            </Button>
          )}
        </div>
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
        }
      `}</style>
    </div>
  );
}
