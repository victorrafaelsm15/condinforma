import { useEffect, useState } from 'react';
import { Text, Group, Loader, SimpleGrid, Progress, Tooltip } from '@mantine/core';
import { BarChart3, Building2, DoorOpen, ClipboardCheck, TrendingUp, AlertTriangle, LayoutGrid } from 'lucide-react';
import { condominiosStore, ambientesStore, execucoesStore, ocorrenciasStore } from '../lib/stores';

function StatTile({ icon: Icon, tint, color, value, label }) {
  return (
    <div className="surface-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
      <span className="icon-tile" style={{ background: tint, width: 44, height: 44, borderRadius: 13, flexShrink: 0 }}>
        <Icon size={21} color={color} />
      </span>
      <div>
        <Text fw={800} size="1.5rem" className="font-display" style={{ lineHeight: 1.1 }}>{value}</Text>
        <Text size="sm" c="dimmed">{label}</Text>
      </div>
    </div>
  );
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [condominios, ambientes, execucoes, ocorrencias] = await Promise.all([
        condominiosStore.list(),
        ambientesStore.list(),
        execucoesStore.list(),
        ocorrenciasStore.list(),
      ]);

      const totalCompleted = execucoes.reduce((sum, e) => sum + (e.completed_count || 0), 0);
      const totalTasks = execucoes.reduce((sum, e) => sum + (e.total_count || 0), 0);
      const taxaMedia = totalTasks ? Math.round((totalCompleted / totalTasks) * 100) : null;
      const pendentes = ocorrencias.filter((o) => o.status !== 'resolvido').length;

      const ambientesByCondo = {};
      ambientes.forEach((a) => {
        (ambientesByCondo[a.condominio_id] ||= []).push(a);
      });

      const porCondominio = condominios
        .map((c) => {
          const ambs = ambientesByCondo[c.id] || [];
          const ambIds = new Set(ambs.map((a) => a.id));
          const execs = execucoes.filter((e) => ambIds.has(e.ambiente_id));
          const comp = execs.reduce((s, e) => s + (e.completed_count || 0), 0);
          const tot = execs.reduce((s, e) => s + (e.total_count || 0), 0);
          const occPendentes = ocorrencias.filter((o) => ambIds.has(o.ambiente_id) && o.status !== 'resolvido').length;
          return {
            id: c.id,
            name: c.name,
            ambientesCount: ambs.length,
            execCount: execs.length,
            completed: comp,
            total: tot,
            taxa: tot ? Math.round((comp / tot) * 100) : null,
            pendentes: occPendentes,
          };
        })
        .sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1));

      setStats({
        totalCondominios: condominios.length,
        totalAmbientes: ambientes.length,
        totalExecucoes: execucoes.length,
        taxaMedia,
        pendentes,
        porCondominio,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
      <Group gap={12} mb="xl">
        <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 40, height: 40, borderRadius: 12 }}>
          <BarChart3 size={19} color="var(--blue)" />
        </span>
        <div>
          <Text fw={800} size="1.6rem">Relatórios</Text>
          <Text size="md" c="dimmed" mt={2}>Visão geral da operação em todos os condomínios</Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md" mb="xl">
        <StatTile icon={Building2} tint="var(--blue-light)" color="var(--blue)" value={stats.totalCondominios} label="Condomínios" />
        <StatTile icon={DoorOpen} tint="var(--blue-light)" color="var(--blue)" value={stats.totalAmbientes} label="Ambientes" />
        <StatTile icon={ClipboardCheck} tint="var(--green-light)" color="var(--green)" value={stats.totalExecucoes} label="Execuções registradas" />
        <StatTile icon={TrendingUp} tint="var(--green-light)" color="var(--green)" value={stats.taxaMedia != null ? `${stats.taxaMedia}%` : '—'} label="Taxa média de conclusão" />
        <StatTile icon={AlertTriangle} tint="var(--red-light)" color="var(--red)" value={stats.pendentes} label="Ocorrências pendentes" />
      </SimpleGrid>

      <div className="surface-card" style={{ padding: 26 }}>
        <Text fw={800} size="md" className="font-display" mb={4}>Taxa de conclusão por condomínio</Text>
        <Text size="sm" c="dimmed" mb="lg">Média de tarefas concluídas nas execuções registradas de cada condomínio</Text>

        {stats.porCondominio.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {stats.porCondominio.map((c) => (
              <Tooltip
                key={c.id}
                label={c.total ? `${c.completed} de ${c.total} tarefas concluídas em ${c.execCount} execução(ões)` : 'Nenhuma execução registrada ainda'}
                position="top"
                withArrow
              >
                <div>
                  <Group justify="space-between" mb={6}>
                    <Text size="sm" fw={600} style={{ maxWidth: '60%' }} truncate="end">{c.name}</Text>
                    <Group gap={10}>
                      <Text size="xs" c="dimmed">{c.ambientesCount} ambiente(s) · {c.execCount} execução(ões)</Text>
                      <Text size="sm" fw={700} c={c.taxa == null ? 'dimmed' : 'brand'}>{c.taxa != null ? `${c.taxa}%` : '—'}</Text>
                    </Group>
                  </Group>
                  <Progress value={c.taxa ?? 0} color="brand" size={10} radius="xl" />
                </div>
              </Tooltip>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <span className="icon-tile" style={{ background: 'var(--blue-light)', width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px' }}>
              <LayoutGrid size={22} color="var(--blue)" />
            </span>
            <Text c="dimmed">Nenhum condomínio cadastrado ainda.</Text>
          </div>
        )}
      </div>
    </div>
  );
}
