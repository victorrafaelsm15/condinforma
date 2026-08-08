import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Text, Group, Loader, ActionIcon, Breadcrumbs, Button, Badge } from '@mantine/core';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Clock, QrCode, DoorOpen,
  LayoutGrid, TrendingUp,
} from 'lucide-react';
import { condominiosStore, ambientesStore, execucoesStore, ocorrenciasStore } from '../lib/stores';

// Critério de atraso — fácil de ajustar depois:
// até ATRASO_HORAS: em dia (verde)
// entre ATRASO_HORAS e MUITO_ATRASO_HORAS: atrasado (amarelo)
// acima de MUITO_ATRASO_HORAS: muito atrasado (vermelho) — SÓ se o ambiente
// tiver pelo menos uma ocorrência registrada; sem ocorrência nenhuma, mesmo
// muito tempo sem execução (ou nunca executado) fica no máximo "atrasado",
// já que atraso sozinho não confirma que há um problema real no ambiente.
const ATRASO_HORAS = 48;
const MUITO_ATRASO_HORAS = 96;

const STATUS_STYLES = {
  verde: { color: 'var(--green)', bg: 'var(--green-light)', label: 'Em dia' },
  amarelo: { color: 'var(--amber)', bg: 'var(--amber-light)', label: 'Atrasado' },
  vermelho: { color: 'var(--red)', bg: 'var(--red-light)', label: 'Muito atrasado' },
};

function hoursSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
}

function getStatus(lastExec, hasOcorrencia) {
  const h = lastExec ? hoursSince(lastExec.created_at) : Infinity;
  if (h <= ATRASO_HORAS) return 'verde';
  if (h <= MUITO_ATRASO_HORAS || !hasOcorrencia) return 'amarelo';
  return 'vermelho';
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatRelative(dateStr) {
  const h = hoursSince(dateStr);
  if (h < 1) return 'há menos de 1h';
  if (h < 24) return `há ${Math.floor(h)}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function StatTile({ icon: Icon, tint, color, value, label }) {
  return (
    <div className="surface-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
      <span className="icon-tile" style={{ background: tint, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}>
        <Icon size={21} color={color} />
      </span>
      <div style={{ minWidth: 0 }}>
        <Text fw={800} size="1.4rem" className="font-display" style={{ lineHeight: 1.1 }} truncate>{value}</Text>
        <Text size="sm" c="dimmed">{label}</Text>
      </div>
    </div>
  );
}

export default function SindicoDashboard() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [condominio, setCondominio] = useState(null);
  const [rows, setRows] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [c, ambientes] = await Promise.all([
        condominiosStore.getById(id),
        ambientesStore.list({ condominio_id: id }),
      ]);
      setCondominio(c);

      const [execEntries, occEntries] = await Promise.all([
        Promise.all(ambientes.map(async (a) => {
          const execs = await execucoesStore.list({ ambiente_id: a.id });
          return [a.id, execs[0] || null];
        })),
        Promise.all(ambientes.map(async (a) => {
          const occs = await ocorrenciasStore.list({ ambiente_id: a.id });
          return [a.id, occs.map((o) => ({ ...o, ambienteName: a.name }))];
        })),
      ]);

      const execMap = Object.fromEntries(execEntries);
      const occMap = Object.fromEntries(occEntries);
      const combined = ambientes.map((a) => ({
        ambiente: a,
        lastExec: execMap[a.id],
        status: getStatus(execMap[a.id], (occMap[a.id] || []).length > 0),
      }));
      const statusOrder = { vermelho: 0, amarelo: 1, verde: 2 };
      combined.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      setRows(combined);
      const pendentes = Object.values(occMap).flat().filter((o) => o.status !== 'resolvido');
      setOcorrencias(pendentes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  const total = rows.length;
  const verificadosHoje = rows.filter((r) => r.lastExec && isToday(r.lastExec.created_at)).length;
  const pctHoje = total ? Math.round((verificadosHoje / total) * 100) : 0;

  const maisAtrasado = rows.reduce((worst, r) => {
    if (!worst) return r;
    const worstH = worst.lastExec ? hoursSince(worst.lastExec.created_at) : Infinity;
    const rH = r.lastExec ? hoursSince(r.lastExec.created_at) : Infinity;
    return rH > worstH ? r : worst;
  }, null);

  return (
    <div>
      <Group gap={10} mb="md">
        <ActionIcon component={Link} to="/admin" variant="light" color="gray" radius="xl" size="lg" aria-label="Voltar para condomínios">
          <ArrowLeft size={18} />
        </ActionIcon>
        <Breadcrumbs styles={{ separator: { color: 'var(--text-faint)' } }}>
          <Link to="/admin" style={{ fontSize: 14.5, color: 'var(--text-muted)', fontWeight: 600 }}>Condomínios</Link>
          <Text size="md" fw={600}>{condominio?.name}</Text>
          <Text size="md" fw={600} c="dimmed">Visão geral</Text>
        </Breadcrumbs>
      </Group>

      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <div>
          <Text fw={800} size="1.6rem">{condominio?.name}</Text>
          <Text size="md" c="dimmed" mt={2}>Acompanhamento rápido do dia a dia</Text>
        </div>
        <Group gap={8}>
          <Button component={Link} to={`/admin/condominios/${id}`} variant="default">
            Ver ambientes
          </Button>
          <Button component={Link} to={`/admin/condominios/${id}/qrcodes`} leftSection={<QrCode size={16} />} className="btn-glow" style={{ boxShadow: 'var(--shadow-brand)' }}>
            Ver todos os QR Codes
          </Button>
        </Group>
      </Group>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatTile icon={CheckCircle2} tint="var(--green-light)" color="var(--green)" value={`${pctHoje}%`} label="Ambientes verificados hoje" />
        <StatTile icon={AlertTriangle} tint="var(--red-light)" color="var(--red)" value={ocorrencias.length} label="Ocorrências pendentes" />
        <StatTile
          icon={Clock}
          tint="var(--amber-light)"
          color="var(--amber)"
          value={maisAtrasado ? maisAtrasado.ambiente.name : '—'}
          label={maisAtrasado ? (maisAtrasado.lastExec ? `Sem execução ${formatRelative(maisAtrasado.lastExec.created_at)}` : 'Nunca executado') : 'Nenhum ambiente'}
        />
      </div>

      <Text fw={800} size="md" className="font-display" mb={10}>Status dos ambientes</Text>
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {rows.map(({ ambiente, lastExec, status }) => {
            const s = STATUS_STYLES[status];
            return (
              <Link
                key={ambiente.id}
                to={`/admin/ambientes/${ambiente.id}`}
                className="surface-card surface-card--hover"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', gap: 12 }}
              >
                <Group gap={12} wrap="nowrap">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 34, height: 34, borderRadius: 10 }}>
                    <DoorOpen size={16} color="var(--blue)" />
                  </span>
                  <div>
                    <Text fw={700} size="sm">{ambiente.name}</Text>
                    <Text size="xs" c="dimmed">
                      {lastExec ? `Última execução ${formatRelative(lastExec.created_at)}` : 'Nunca executado'}
                    </Text>
                  </div>
                </Group>
                <Badge variant="light" style={{ background: s.bg, color: s.color, flexShrink: 0 }}>{s.label}</Badge>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '40px 20px', marginBottom: 28 }}>
          <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px' }}>
            <LayoutGrid size={22} color="var(--blue)" />
          </span>
          <Text c="dimmed">Nenhum ambiente cadastrado ainda.</Text>
        </div>
      )}

      <Text fw={800} size="md" className="font-display" mb={10}>Ocorrências pendentes</Text>
      {ocorrencias.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ocorrencias.map((o) => (
            <div key={o.id} className="surface-card" style={{ padding: 16, borderLeft: '3px solid var(--red)' }}>
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" fw={600}>{o.ambienteName}</Text>
                  <Text size="sm" mt={4}>{o.description}</Text>
                  <Text size="xs" c="dimmed" mt={4}>{new Date(o.created_at).toLocaleString('pt-BR')}</Text>
                </div>
                <Badge color="red" variant="light">Pendente</Badge>
              </Group>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <TrendingUp size={22} color="var(--green)" style={{ margin: '0 auto 8px' }} />
          <Text c="dimmed" size="sm">Nenhuma ocorrência pendente neste condomínio.</Text>
        </div>
      )}
    </div>
  );
}
