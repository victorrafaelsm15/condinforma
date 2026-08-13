import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Text, Loader, Badge, Group } from '@mantine/core';
import { CheckCircle2, Clock, Building2, ListChecks, HelpCircle, AlertTriangle } from 'lucide-react';
import { ambientesStore, execucoesStore, checklistPeriodosStore, checklistItemsStore, ocorrenciasStore } from '../lib/stores';
import OcorrenciaForm from '../components/OcorrenciaForm';
import Seo from '../components/common/Seo';

// Quatro estados possíveis, dos mais pros menos "tudo certo" — uma
// ocorrência pendente pesa mais que checklist incompleto (um problema
// relatado é mais urgente de sinalizar publicamente do que uma tarefa
// que ainda não foi marcada), e nenhum dos dois aparece junto do selo
// verde. Não expõe o CONTEÚDO da ocorrência aqui — só que existe.
function getStatus(lastExec, pendingOcorrenciasCount) {
  if (pendingOcorrenciasCount > 0) return 'pendencia';
  if (lastExec && lastExec.total_count > lastExec.completed_count) return 'incompleto';
  if (lastExec) return 'conforme';
  return 'sem_registro';
}

const STATUS_BLOB_COLOR = {
  conforme: 'rgba(18,183,106,0.16)',
  incompleto: 'rgba(245,158,11,0.16)',
  pendencia: 'rgba(245,158,11,0.16)',
  sem_registro: 'rgba(51,85,232,0.12)',
};
const STATUS_ICON_BG = {
  conforme: 'var(--green-light)',
  incompleto: 'var(--amber-light)',
  pendencia: 'var(--amber-light)',
};
const STATUS_TITLE = {
  conforme: 'Ambiente verificado',
  incompleto: 'Verificação em andamento',
  pendencia: 'Pendência em andamento',
};
const STATUS_BADGE_COLOR = { conforme: 'green', incompleto: 'yellow', pendencia: 'yellow' };
const STATUS_BADGE_LABEL = {
  conforme: 'Em conformidade',
  incompleto: 'Checklist incompleto',
  pendencia: 'Pendência em andamento',
};

export default function StatusPublicoPage() {
  const { id } = useParams();
  const [ambiente, setAmbiente] = useState(null);
  const [lastExec, setLastExec] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Página pública específica de um ambiente/condomínio — sem valor de
  // busca genérica, fica fora da indexação (mesmo critério do sitemap.xml).
  const seoTag = <Seo noindex title="Status da limpeza — Cond-Informa" path={`/ambiente/${id}/status`} />;

  useEffect(() => {
    Promise.all([
      ambientesStore.getById(id),
      execucoesStore.list({ ambiente_id: id }),
      checklistPeriodosStore.list({ ambiente_id: id, status: 'ativo' }),
      ocorrenciasStore.list({ ambiente_id: id, status: 'pendente' }),
    ]).then(async ([amb, execs, periodosAtivos, pendentes]) => {
      setAmbiente(amb);
      setLastExec(execs[0] || null);
      // Só itens do período ATIVO — só faz sentido o morador vincular a
      // ocorrência a uma tarefa que está de fato em uso agora.
      const periodoAtivo = periodosAtivos[0];
      const items = periodoAtivo ? await checklistItemsStore.list({ checklist_periodo_id: periodoAtivo.id }) : [];
      setChecklistItems(items);
      setPendingCount(pendentes.length);
      setLoading(false);
    });
  }, [id]);

  const status = getStatus(lastExec, pendingCount);

  if (loading) return <>{seoTag}<Group justify="center" py={80}><Loader color="brand" /></Group></>;
  if (!ambiente) return <>{seoTag}<Text ta="center" py={80}>Ambiente não encontrado.</Text></>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {seoTag}
      <div className="blob" style={{ width: 360, height: 360, top: -160, left: '50%', transform: 'translateX(-50%)', background: `radial-gradient(circle, ${STATUS_BLOB_COLOR[status]}, transparent 70%)` }} />
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
          {status !== 'sem_registro' ? (
            <>
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
                className={status === 'conforme' ? 'pulse-ring' : undefined}
                style={{
                  width: 74, height: 74, borderRadius: '50%', background: STATUS_ICON_BG[status],
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                }}
              >
                {status === 'conforme'
                  ? <CheckCircle2 size={38} color="var(--green)" />
                  : <AlertTriangle size={34} color="var(--amber)" />}
              </motion.div>
              <Text fw={700} mt="lg" size="lg">{STATUS_TITLE[status]}</Text>
              <Badge color={STATUS_BADGE_COLOR[status]} variant="light" mt="xs" size="lg">{STATUS_BADGE_LABEL[status]}</Badge>

              {lastExec && (
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
              )}
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

        <div style={{ marginTop: 24, padding: 16, border: '2px solid var(--red)', borderRadius: 16 }}>
          <OcorrenciaForm
            ambienteId={id}
            accountId={ambiente.account_id}
            reportedByRole="morador"
            askReporterName
            triggerLabel="Notou algo errado? Registrar ocorrência"
            checklistItems={checklistItems}
          />
        </div>
      </div>
    </div>
  );
}
