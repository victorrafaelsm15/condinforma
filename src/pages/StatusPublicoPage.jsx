import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Text, Loader, Badge, Group } from '@mantine/core';
import { CheckCircle2, Clock, Building2, ListChecks, HelpCircle } from 'lucide-react';
import { ambientesStore, execucoesStore } from '../lib/stores';
import OcorrenciaForm from '../components/OcorrenciaForm';
import Seo from '../components/common/Seo';

export default function StatusPublicoPage() {
  const { id } = useParams();
  const [ambiente, setAmbiente] = useState(null);
  const [lastExec, setLastExec] = useState(null);
  const [loading, setLoading] = useState(true);

  // Página pública específica de um ambiente/condomínio — sem valor de
  // busca genérica, fica fora da indexação (mesmo critério do sitemap.xml).
  const seoTag = <Seo noindex title="Status da limpeza — Cond-Informa" path={`/ambiente/${id}/status`} />;

  useEffect(() => {
    Promise.all([
      ambientesStore.getById(id),
      execucoesStore.list({ ambiente_id: id }),
    ]).then(([amb, execs]) => {
      setAmbiente(amb);
      setLastExec(execs[0] || null);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <>{seoTag}<Group justify="center" py={80}><Loader color="brand" /></Group></>;
  if (!ambiente) return <>{seoTag}<Text ta="center" py={80}>Ambiente não encontrado.</Text></>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {seoTag}
      <div className="blob" style={{ width: 360, height: 360, top: -160, left: '50%', transform: 'translateX(-50%)', background: `radial-gradient(circle, ${lastExec ? 'rgba(18,183,106,0.16)' : 'rgba(51,85,232,0.12)'}, transparent 70%)` }} />
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '52px 20px', position: 'relative' }}>
        <Group gap={8} mb={6} justify="center">
          <span className="icon-tile" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-light)' }}>
            <Building2 size={14} color="var(--blue)" />
          </span>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.06em' }}>Cond-Informa</Text>
        </Group>
        <Text fw={800} size="xl" ta="center" mb={28}>{ambiente.name}</Text>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="surface-card"
          style={{ padding: '36px 28px', textAlign: 'center' }}
        >
          {lastExec ? (
            <>
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
                className="pulse-ring"
                style={{
                  width: 74, height: 74, borderRadius: '50%', background: 'var(--green-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                }}
              >
                <CheckCircle2 size={38} color="var(--green)" />
              </motion.div>
              <Text fw={700} mt="lg" size="lg">Ambiente verificado</Text>
              <Badge color="green" variant="light" mt="xs" size="lg">Em conformidade</Badge>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <Group justify="center" gap={6}>
                  <Clock size={14} color="var(--text-muted)" />
                  <Text size="sm" c="dimmed">
                    Última atualização: {new Date(lastExec.created_at).toLocaleString('pt-BR')}
                  </Text>
                </Group>
                <Group justify="center" gap={6}>
                  <ListChecks size={14} color="var(--text-muted)" />
                  <Text size="sm" c="dimmed">
                    {lastExec.completed_count} de {lastExec.total_count} tarefas concluídas
                  </Text>
                </Group>
              </div>
            </>
          ) : (
            <>
              <div style={{
                width: 74, height: 74, borderRadius: '50%', background: 'var(--blue-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
              }}>
                <HelpCircle size={36} color="var(--blue)" />
              </div>
              <Text c="dimmed" mt="lg">Ainda não há registro de verificação para este ambiente.</Text>
            </>
          )}
        </motion.div>

        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <OcorrenciaForm
            ambienteId={id}
            accountId={ambiente.account_id}
            reportedByRole="morador"
            askReporterName
            triggerLabel="Notou algo errado? Registrar ocorrência"
          />
        </div>
      </div>
    </div>
  );
}
