import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Text, Checkbox, Button, TextInput, Textarea, Loader, FileButton, Group, Progress, Image as MantineImage, Badge, ActionIcon,
} from '@mantine/core';
import { CheckCircle2, Camera, Building2, WifiOff, CloudUpload, AlertTriangle, MessageSquareWarning } from 'lucide-react';
import { ambientesStore, checklistPeriodosStore, checklistItemsStore, ocorrenciasStore } from '../lib/stores';
import { enqueue, syncQueue, isPending, subscribeQueue, generateRecordId } from '../lib/offlineQueue';
import { reporterLabel } from '../lib/ocorrenciaDisplay';
import OcorrenciaForm from '../components/OcorrenciaForm';
import Seo from '../components/common/Seo';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Card único de execução do período ATIVO do ambiente (sempre existe
// exatamente um) — nome do executor, foto, progresso, envio — que vira
// uma linha em "execucoes" com checklist_periodo_id apontando pra esse
// período.
function PeriodoExecutionCard({ periodo, items, ambiente, isOnline, onReportItem }) {
  const [checked, setChecked] = useState({});
  const [executedBy, setExecutedBy] = useState('');
  const [photo, setPhoto] = useState(null);
  const [freeTextNote, setFreeTextNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [pendingLocal, setPendingLocal] = useState(false);
  const [queuedRecordId, setQueuedRecordId] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!queuedRecordId) return undefined;
    const unsubscribe = subscribeQueue(async () => {
      const stillPending = await isPending(queuedRecordId);
      if (!stillPending) {
        setPendingLocal(false);
        setDone(true);
      }
    });
    return unsubscribe;
  }, [queuedRecordId]);

  const toggleItem = (itemId) => setChecked((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  const handlePhoto = async (file) => {
    if (!file) return;
    setPhoto(await fileToBase64(file));
  };

  const completedCount = Object.values(checked).filter(Boolean).length;
  const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0;

  const resetForm = () => {
    setChecked({});
    setExecutedBy('');
    setPhoto(null);
    setFreeTextNote('');
    setDone(false);
    setPendingLocal(false);
    setQueuedRecordId(null);
    setSubmitError('');
  };

  const handleSubmit = async () => {
    setSubmitError('');
    // Salva na fila local (IndexedDB) ANTES de tentar enviar — é o que
    // garante que a execução não se perde se o colaborador confirmar numa
    // área sem sinal (elevador, subsolo, garagem) e a conexão cair na
    // hora do envio.
    const record = {
      id: generateRecordId(),
      created_at: new Date().toISOString(),
      ambiente_id: ambiente.id,
      checklist_periodo_id: periodo.id,
      // Sem sessão logada nesta página pública — o dono do registro é
      // copiado do próprio ambiente, não detectado por auth.
      account_id: ambiente.account_id,
      executed_by: executedBy || 'Colaborador',
      completed_count: completedCount,
      total_count: items.length,
      items: items.map((i) => ({ task: i.task, done: !!checked[i.id] })),
      photo,
      free_text_note: freeTextNote.trim() || null,
    };

    setSubmitting(true);
    try {
      await enqueue('execucao', record);
      setQueuedRecordId(record.id);
      await syncQueue();
      const stillPending = await isPending(record.id);
      if (stillPending) setPendingLocal(true);
      else setDone(true);
    } catch {
      setSubmitError('Não foi possível salvar sua execução neste dispositivo. Tente confirmar novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryNow = async () => {
    setRetrying(true);
    await syncQueue();
    const stillPending = queuedRecordId ? await isPending(queuedRecordId) : false;
    if (!stillPending) {
      setPendingLocal(false);
      setDone(true);
    }
    setRetrying(false);
  };

  if (pendingLocal) {
    return (
      <div className="surface-card" style={{ padding: '28px 24px', marginBottom: 18, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--amber-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
        }}>
          <CloudUpload size={28} color="var(--amber)" />
        </div>
        <Text fw={800}>{periodo.nome} — salvo neste dispositivo</Text>
        <Text size="sm" mt={8} style={{ color: '#92620a' }}>
          Ainda não confirmado pelo servidor. Será enviado automaticamente assim que a conexão voltar.
        </Text>
        <Button mt="lg" variant="light" fullWidth size="md" onClick={handleRetryNow} loading={retrying} style={{ minHeight: 44 }}>
          Tentar enviar agora
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="surface-card" style={{ padding: '28px 24px', marginBottom: 18, textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="pulse-ring"
          style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--green-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}
        >
          <CheckCircle2 size={28} color="var(--green)" />
        </motion.div>
        <Text fw={800}>{periodo.nome} — concluído!</Text>
        {items.length > 0 ? (
          <Text size="xs" c="dimmed" mt={8}>{completedCount} de {items.length} tarefas marcadas como feitas</Text>
        ) : (
          <Text size="xs" c="dimmed" mt={8}>Registro livre enviado</Text>
        )}
        <Button mt="lg" variant="light" fullWidth size="md" onClick={resetForm} style={{ minHeight: 44 }}>Executar novamente</Button>
      </div>
    );
  }

  return (
    <div className="surface-card" style={{ padding: 22, marginBottom: 18 }}>
      <Text fw={800} size="lg" mb={4}>{periodo.nome}</Text>
      <Text size="sm" c="dimmed" mb={16}>Marque as tarefas realizadas e confirme a execução.</Text>

      {items.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Group justify="space-between" mb={6}>
            <Text size="xs" fw={700} c="dimmed">Progresso</Text>
            <Text size="xs" fw={700} c={progressPct === 100 ? 'green' : 'dimmed'}>{completedCount}/{items.length}</Text>
          </Group>
          <Progress
            value={progressPct}
            color={progressPct === 100 ? 'green' : 'brand'}
            radius="xl"
            size={8}
            aria-label={`Progresso do período ${periodo.nome}: ${completedCount} de ${items.length} tarefas concluídas`}
          />
        </div>
      )}

      <TextInput
        label="Seu nome"
        placeholder="Opcional"
        value={executedBy}
        onChange={(e) => setExecutedBy(e.currentTarget.value)}
        mb="lg"
        styles={{ input: { minHeight: 44 } }}
      />

      {items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {items.map((item, i) => {
            const isDone = !!checked[item.id];
            const inputId = `checklist-item-${item.id}`;
            return (
              <div
                key={item.id}
                className={`surface-card checklist-row ${isDone ? 'checklist-row--done' : ''}`}
                style={{ padding: '14px 16px' }}
              >
                <Group justify="space-between" wrap="nowrap">
                  {/* <label> nativo em vez de <div onClick> — clicar em
                      qualquer parte da linha, tocar com a tela suja/luvas,
                      ou navegar por Tab + Espaço no checkbox já funciona
                      sozinho, sem precisar de nenhum JS extra de teclado. */}
                  <label htmlFor={inputId} style={{ cursor: 'pointer', flex: 1, display: 'flex' }}>
                    <Group gap={12} wrap="nowrap">
                      <span style={{
                        width: 24, height: 24, borderRadius: 7, flexShrink: 0, fontSize: 11, fontWeight: 700,
                        background: isDone ? 'var(--green)' : 'var(--blue-light)', color: isDone ? '#fff' : 'var(--blue)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s var(--ease)',
                      }}>
                        {i + 1}
                      </span>
                      <Text size="sm" style={{ textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.65 : 1 }}>
                        {item.task}
                      </Text>
                    </Group>
                  </label>
                  <Group gap={6} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      radius="md"
                      onClick={() => onReportItem(item)}
                      aria-label={`Relatar problema na tarefa: ${item.task}`}
                      title="Relatar problema"
                    >
                      <MessageSquareWarning size={16} />
                    </ActionIcon>
                    <Checkbox
                      id={inputId}
                      checked={isDone}
                      onChange={() => toggleItem(item.id)}
                      color="green"
                      size="md"
                      aria-label={item.task}
                      styles={{ input: { cursor: 'pointer' } }}
                    />
                  </Group>
                </Group>
              </div>
            );
          })}
        </div>
      ) : (
        <Text c="dimmed" size="sm" mb="lg">Nenhuma tarefa cadastrada neste período ainda. Você ainda pode confirmar um registro livre abaixo.</Text>
      )}

      <Textarea
        label="Observação / registro livre"
        placeholder="Descreva algo que fez ou notou, mesmo fora do checklist (opcional)"
        value={freeTextNote}
        onChange={(e) => setFreeTextNote(e.currentTarget.value)}
        minRows={2}
        mb="md"
      />

      <FileButton onChange={handlePhoto} accept="image/*">
        {(props) => (
          <Button
            {...props}
            variant="light"
            leftSection={<Camera size={16} />}
            fullWidth
            mb="md"
            size="md"
            aria-label={photo ? 'Foto anexada. Toque para trocar a foto' : 'Anexar foto, opcional'}
          >
            {photo ? 'Foto anexada ✓' : 'Anexar foto (opcional)'}
          </Button>
        )}
      </FileButton>

      <Button
        fullWidth
        size="md"
        onClick={handleSubmit}
        loading={submitting}
        className="btn-glow"
        style={{ boxShadow: 'var(--shadow-brand)', minHeight: 48 }}
      >
        Confirmar execução
      </Button>
      {submitError && (
        <Text role="alert" size="sm" c="red" fw={600} mt={10} ta="center">{submitError}</Text>
      )}
      {!isOnline && (
        <Text size="xs" c="dimmed" mt={8} ta="center">Sem conexão — a confirmação é enviada assim que a internet voltar.</Text>
      )}
    </div>
  );
}

export default function ExecutarChecklistPage() {
  const { id } = useParams();
  const [ambiente, setAmbiente] = useState(null);
  const [periodoAtivo, setPeriodoAtivo] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOcorrencias, setPendingOcorrencias] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const [reportItem, setReportItem] = useState(null);

  // Página pública específica de um ambiente/condomínio — sem valor de
  // busca genérica, então fica fora da indexação (mesmo critério do
  // sitemap.xml/robots.txt). Definida uma vez e reaproveitada em todo
  // "return" (loading, não encontrado, formulário).
  const seoTag = <Seo noindex title="Executar checklist — Cond-Informa" path={`/ambiente/${id}/executar`} />;

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const load = async () => {
    const [amb, periodos] = await Promise.all([
      ambientesStore.getById(id),
      checklistPeriodosStore.list({ ambiente_id: id, status: 'ativo' }),
    ]);
    setAmbiente(amb);
    const ativo = periodos[0] || null;
    setPeriodoAtivo(ativo);
    if (ativo) {
      const itemsList = await checklistItemsStore.list({ checklist_periodo_id: ativo.id });
      setItems(itemsList.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    } else {
      setItems([]);
    }
    setLoading(false);
    loadPendingOcorrencias();
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // O colaborador que vai executar o checklist é provavelmente quem vai
  // resolver o problema fisicamente ali — sem isso ele só via a lista de
  // tarefas, sem nenhum aviso de que já existe uma ocorrência aberta
  // nesse mesmo ambiente.
  const loadPendingOcorrencias = () => {
    ocorrenciasStore.list({ ambiente_id: id, status: 'pendente' }).then(setPendingOcorrencias);
  };

  const handleResolveOcorrencia = async (ocorrenciaId) => {
    setResolvingId(ocorrenciaId);
    try {
      await ocorrenciasStore.update(ocorrenciaId, { status: 'resolvido' });
      setPendingOcorrencias((prev) => prev.filter((o) => o.id !== ocorrenciaId));
    } catch {
      // silencioso — o item continua na lista, a pessoa pode tentar de novo
    } finally {
      setResolvingId(null);
    }
  };

  const handleReportItem = (item) => {
    setReportItem(item);
    // Pequeno delay pra garantir que o formulário (que muda de key e
    // remonta expandido) já esteja no DOM antes de rolar até ele.
    setTimeout(() => {
      document.getElementById('ocorrencia-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  if (loading) return <>{seoTag}<Group justify="center" py={80}><Loader color="brand" /></Group></>;
  if (!ambiente) return <>{seoTag}<Text ta="center" py={80}>Ambiente não encontrado.</Text></>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {seoTag}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 60px' }}>
        <Group gap={8} mb={16}>
          <span className="icon-tile" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--blue-light)' }}>
            <Building2 size={15} color="var(--blue)" />
          </span>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.06em' }}>Cond-Informa</Text>
        </Group>

        <Text fw={800} size="xl" mb={18}>{ambiente.name}</Text>

        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16,
              background: 'var(--amber-light)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12,
            }}
          >
            <WifiOff size={17} color="var(--amber)" style={{ flexShrink: 0 }} />
            <Text size="sm" fw={600} style={{ color: '#92620a' }}>
              Sem conexão agora. Você pode marcar as tarefas normalmente, mas a confirmação só é enviada quando a internet voltar.
            </Text>
          </div>
        )}

        {!!pendingOcorrencias.length && (
          <div className="surface-card" style={{ padding: 20, marginBottom: 18, borderColor: 'rgba(239,68,68,0.25)' }}>
            <Group gap={8} mb={12}>
              <AlertTriangle size={17} color="var(--red)" />
              <Text fw={700} size="sm">
                {pendingOcorrencias.length === 1 ? '1 ocorrência pendente neste ambiente' : `${pendingOcorrencias.length} ocorrências pendentes neste ambiente`}
              </Text>
            </Group>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingOcorrencias.map((o) => (
                <div key={o.id} style={{ padding: 12, borderRadius: 10, background: 'var(--red-light)' }}>
                  <Badge size="sm" color="red" variant="light" mb={6}>Pendente</Badge>
                  <Text size="sm">{o.description}</Text>
                  {reporterLabel(o) && <Text size="xs" c="dimmed" mt={4}>{reporterLabel(o)}</Text>}
                  {o.photo && (
                    <MantineImage
                      src={o.photo}
                      alt={`Foto anexada à ocorrência: ${o.description}`}
                      radius="md"
                      mt={8}
                      h={120}
                      w={120}
                      fit="cover"
                    />
                  )}
                  <Button
                    size="sm"
                    variant="light"
                    color="green"
                    mt={10}
                    onClick={() => handleResolveOcorrencia(o.id)}
                    loading={resolvingId === o.id}
                    aria-label={`Marcar ocorrência "${o.description}" como resolvida`}
                    style={{ minHeight: 40 }}
                  >
                    Marcar como resolvido
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {periodoAtivo ? (
          <PeriodoExecutionCard
            periodo={periodoAtivo}
            items={items}
            ambiente={ambiente}
            isOnline={isOnline}
            onReportItem={handleReportItem}
          />
        ) : (
          <div className="surface-card" style={{ padding: 22, marginBottom: 18, textAlign: 'center' }}>
            <Text fw={700}>Sem checklist ativo</Text>
            <Text size="sm" c="dimmed" mt={6}>Este ambiente está sem nenhum período de checklist ativo no momento.</Text>
          </div>
        )}

        <div id="ocorrencia-form-anchor" style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <OcorrenciaForm
            key={reportItem?.id || 'default'}
            ambienteId={id}
            accountId={ambiente.account_id}
            reportedByRole="colaborador"
            checklistItems={items}
            initiallyExpanded={!!reportItem}
            initialRelatedItemId={reportItem?.id || null}
          />
        </div>
      </div>
    </div>
  );
}
