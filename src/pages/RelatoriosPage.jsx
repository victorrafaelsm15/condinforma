import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Text, Group, Loader, SimpleGrid, Select, SegmentedControl, TextInput, Button, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  BarChart3, TrendingUp, ClipboardCheck, AlertTriangle, Clock, FileDown, ChevronRight, DoorOpen, ListChecks,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import { condominiosStore } from '../lib/stores';
import {
  getExecucoesIndicators, getOcorrenciasIndicators, getChecklistItemsIndicators,
  getExecucoesSeries, getOcorrenciasRankingAmbiente, getChecklistItemRanking,
} from '../lib/reports';
import { generateRelatorioPdf } from '../lib/relatorioPdf';
import { downloadPdf } from '../lib/comunicado';

const PRESETS = [
  { value: '7d', label: '7 dias', days: 7 },
  { value: '30d', label: '30 dias', days: 30 },
  { value: '90d', label: '90 dias', days: 90 },
  { value: 'custom', label: 'Personalizado' },
];

function computeRange(preset, customFrom, customTo) {
  const now = new Date();
  if (preset === 'custom') {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(now.getTime() - 7 * 24 * 3_600_000);
    const to = customTo ? new Date(`${customTo}T23:59:59`) : now;
    return { from, to };
  }
  const days = PRESETS.find((p) => p.value === preset)?.days || 30;
  return { from: new Date(now.getTime() - days * 24 * 3_600_000), to: now };
}

function formatDelta(current, previous) {
  if (!previous) return current > 0 ? { text: 'Novo no período', dir: 'up' } : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: 'Igual ao período anterior', dir: 'flat' };
  return { text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs período anterior`, dir: pct > 0 ? 'up' : 'down' };
}

function StatTile({ icon: Icon, tint, color, value, label, delta }) {
  return (
    <div className="surface-card" style={{ padding: 20 }}>
      <Group gap={14} align="flex-start" wrap="nowrap">
        <span className="icon-tile" style={{ background: tint, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}>
          <Icon size={21} color={color} />
        </span>
        <div style={{ minWidth: 0 }}>
          <Text fw={800} size="1.5rem" className="font-display" style={{ lineHeight: 1.1 }} truncate>{value}</Text>
          <Text size="sm" c="dimmed">{label}</Text>
          {delta && (
            <Text size="xs" fw={700} mt={4} c={delta.dir === 'up' ? 'green' : delta.dir === 'down' ? 'red' : 'dimmed'}>
              {delta.text}
            </Text>
          )}
        </div>
      </Group>
    </div>
  );
}

function RankingList({ icon: Icon, title, rows, emptyLabel, renderRow }) {
  return (
    <div className="surface-card" style={{ padding: 24 }}>
      <Group gap={8} mb={16}>
        <Icon size={18} color="var(--blue)" />
        <Text fw={700} size="md">{title}</Text>
      </Group>
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => renderRow(row, i))}
        </div>
      ) : (
        <Text size="sm" c="dimmed">{emptyLabel}</Text>
      )}
    </div>
  );
}

export default function RelatoriosPage() {
  const [condominios, setCondominios] = useState([]);
  const [selectedCondominioId, setSelectedCondominioId] = useState('');
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    condominiosStore.list().then(setCondominios);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { from, to } = computeRange(preset, customFrom, customTo);
        const spanMs = Math.max(to.getTime() - from.getTime(), 1);
        const prevFrom = new Date(from.getTime() - spanMs);
        const prevTo = from;
        const bucket = spanMs > 60 * 24 * 3_600_000 ? 'week' : 'day';
        const condominioId = selectedCondominioId || null;
        const filters = { condominioId, dateFrom: from, dateTo: to };
        const prevFilters = { condominioId, dateFrom: prevFrom, dateTo: prevTo };

        const [execInd, execIndPrev, occInd, itemsInd, series, ambRanking, itemRanking] = await Promise.all([
          getExecucoesIndicators(filters),
          getExecucoesIndicators(prevFilters),
          getOcorrenciasIndicators(filters),
          getChecklistItemsIndicators(filters),
          getExecucoesSeries({ ...filters, bucket }),
          getOcorrenciasRankingAmbiente({ ...filters, limit: 10 }),
          getChecklistItemRanking({ ...filters, limit: 10 }),
        ]);

        setData({ from, to, bucket, execInd, execIndPrev, occInd, itemsInd, series, ambRanking, itemRanking });
      } catch {
        notifications.show({ color: 'red', message: 'Não foi possível carregar os relatórios.' });
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    // No modo "Personalizado" só recarrega quando as duas datas já foram
    // preenchidas — evita disparar consultas com um intervalo pela metade
    // enquanto a pessoa ainda está digitando a segunda data.
    if (preset !== 'custom' || (customFrom && customTo)) load();
    /* eslint-disable-next-line */
  }, [selectedCondominioId, preset, customFrom, customTo]);

  const handleExport = () => {
    if (!data) return;
    setExporting(true);
    try {
      const escopoLabel = selectedCondominioId
        ? (condominios.find((c) => c.id === selectedCondominioId)?.name || 'Condomínio')
        : 'Todos os condomínios';
      const periodoLabel = `${data.from.toLocaleDateString('pt-BR')} — ${data.to.toLocaleDateString('pt-BR')}`;
      const doc = generateRelatorioPdf({
        escopoLabel,
        periodoLabel,
        execucoesIndicators: data.execInd,
        ocorrenciasIndicators: data.occInd,
        itemsIndicators: data.itemsInd,
        ambienteRanking: data.ambRanking,
        itemRanking: data.itemRanking,
        series: data.series,
      });
      downloadPdf(doc, `relatorio-condinforma-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível gerar o PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const condominioOptions = [
    { value: '', label: 'Todos os condomínios' },
    ...condominios.map((c) => ({ value: c.id, label: c.name })),
  ];

  const taxaConclusao = data?.itemsInd.total_itens
    ? Math.round((data.itemsInd.concluidos / data.itemsInd.total_itens) * 100)
    : null;
  const execDelta = data ? formatDelta(data.execInd.total_execucoes, data.execIndPrev.total_execucoes) : null;
  const tempoMedio = data?.occInd.tempo_medio_resolucao_horas;
  const tempoMedioLabel = tempoMedio != null
    ? (tempoMedio < 24 ? `${tempoMedio.toFixed(1)}h` : `${(tempoMedio / 24).toFixed(1)}d`)
    : '—';

  const chartData = (data?.series || []).map((s) => ({
    label: new Date(s.bucket_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    total: Number(s.total),
  }));

  return (
    <div>
      <Group justify="space-between" mb="xl" wrap="wrap" gap={12}>
        <Group gap={12}>
          <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
            <BarChart3 size={19} color="var(--blue)" />
          </span>
          <div>
            <Text fw={800} size="1.6rem">Relatórios</Text>
            <Text size="md" c="dimmed" mt={2}>Indicadores, tendências e rankings da operação</Text>
          </div>
        </Group>
        <Button
          leftSection={<FileDown size={16} />}
          variant="light"
          onClick={handleExport}
          loading={exporting}
          disabled={!data || loading}
        >
          Exportar relatório
        </Button>
      </Group>

      <div className="surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <Group gap={16} align="flex-end" wrap="wrap">
          {condominios.length > 1 && (
            <Select
              label="Condomínio"
              data={condominioOptions}
              value={selectedCondominioId}
              onChange={(v) => setSelectedCondominioId(v || '')}
              style={{ minWidth: 220 }}
            />
          )}
          <div>
            <Text size="sm" fw={600} mb={6}>Período</Text>
            <SegmentedControl value={preset} onChange={setPreset} data={PRESETS.map((p) => ({ value: p.value, label: p.label }))} />
          </div>
          {preset === 'custom' && (
            <>
              <TextInput label="Data início" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.currentTarget.value)} />
              <TextInput label="Data fim" type="date" value={customTo} onChange={(e) => setCustomTo(e.currentTarget.value)} />
            </>
          )}
        </Group>
      </div>

      {loading || !data ? (
        <Group justify="center" py={60}><Loader color="brand" /></Group>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
            <StatTile
              icon={ClipboardCheck}
              tint="var(--green-light)"
              color="var(--green)"
              value={data.execInd.total_execucoes}
              label="Execuções no período"
              delta={execDelta}
            />
            <StatTile
              icon={TrendingUp}
              tint="var(--blue-light)"
              color="var(--blue)"
              value={taxaConclusao != null ? `${taxaConclusao}%` : '—'}
              label="Taxa de conclusão de itens"
            />
            <StatTile
              icon={AlertTriangle}
              tint="var(--red-light)"
              color="var(--red)"
              value={`${data.occInd.abertas} / ${data.occInd.resolvidas}`}
              label="Ocorrências abertas / resolvidas"
            />
            <StatTile
              icon={Clock}
              tint="var(--amber-light)"
              color="var(--amber)"
              value={tempoMedioLabel}
              label="Tempo médio de resolução"
            />
          </SimpleGrid>

          <div className="surface-card" style={{ padding: 26, marginBottom: 24 }}>
            <Text fw={800} size="md" className="font-display" mb={4}>Execuções ao longo do tempo</Text>
            <Text size="sm" c="dimmed" mb="lg">
              Quantidade de execuções de checklist por {data.bucket === 'week' ? 'semana' : 'dia'}, dentro do período selecionado
            </Text>
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={30} />
                  <RechartsTooltip
                    formatter={(value) => [value, 'Execuções']}
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                  <Bar dataKey="total" fill="var(--blue)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Text c="dimmed" size="sm" ta="center" py={40}>Nenhuma execução registrada no período.</Text>
            )}
          </div>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <RankingList
              icon={DoorOpen}
              title="Ambientes com mais ocorrências"
              rows={data.ambRanking}
              emptyLabel="Nenhuma ocorrência registrada no período."
              renderRow={(r, i) => (
                <Link
                  key={r.ambiente_id}
                  to={`/admin/ambientes/${r.ambiente_id}?tab=ocorrencias`}
                  className="surface-card surface-card--hover"
                  style={{ display: 'block', padding: '12px 14px' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text size="xs" fw={700} c="dimmed" style={{ width: 18, flexShrink: 0 }}>{i + 1}</Text>
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600} truncate>{r.ambiente_name}</Text>
                        {!selectedCondominioId && <Text size="xs" c="dimmed" truncate>{r.condominio_name}</Text>}
                      </div>
                    </Group>
                    <Group gap={8} wrap="nowrap">
                      <Badge size="sm" color="red" variant="light">{r.total}</Badge>
                      <ChevronRight size={16} color="var(--text-faint)" />
                    </Group>
                  </Group>
                </Link>
              )}
            />
            <RankingList
              icon={ListChecks}
              title="Itens de checklist mais problemáticos"
              rows={data.itemRanking}
              emptyLabel="Nenhuma ocorrência vinculada a um item de checklist no período."
              renderRow={(r, i) => (
                <Link
                  key={r.item_id}
                  to={`/admin/ambientes/${r.ambiente_id}/checklist/itens/${r.item_id}`}
                  className="surface-card surface-card--hover"
                  style={{ display: 'block', padding: '12px 14px' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text size="xs" fw={700} c="dimmed" style={{ width: 18, flexShrink: 0 }}>{i + 1}</Text>
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600} truncate>{r.task}</Text>
                        <Text size="xs" c="dimmed" truncate>{r.ambiente_name}</Text>
                      </div>
                    </Group>
                    <Group gap={8} wrap="nowrap">
                      <Badge size="sm" color="red" variant="light">{r.total}</Badge>
                      <ChevronRight size={16} color="var(--text-faint)" />
                    </Group>
                  </Group>
                </Link>
              )}
            />
          </SimpleGrid>
        </>
      )}
    </div>
  );
}
