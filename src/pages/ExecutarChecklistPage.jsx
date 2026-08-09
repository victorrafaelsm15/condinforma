import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Text, Checkbox, Button, TextInput, Textarea, Loader, FileButton, Group, Progress, Image as MantineImage, Badge,
} from '@mantine/core';
import { CheckCircle2, Camera, Building2, WifiOff, CloudUpload, AlertTriangle } from 'lucide-react';
import { ambientesStore, checklistItemsStore, ocorrenciasStore } from '../lib/stores';
import { enqueue, syncQueue, isPending, subscribeQueue, generateRecordId } from '../lib/offlineQueue';
import { reporterLabel } from '../lib/ocorrenciaDisplay';
import OcorrenciaForm from '../components/OcorrenciaForm';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ExecutarChecklistPage() {
  const { id } = useParams();
  const [ambiente, setAmbiente] = useState(null);
  const [items, setItems] = useState([]);
  const [checked, setChecked] = useState({});
  const [executedBy, setExecutedBy] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [freeTextNote, setFreeTextNote] = useState('');
  const [pendingLocal, setPendingLocal] = useState(false);
  const [queuedRecordId, setQueuedRecordId] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [pendingOcorrencias, setPendingOcorrencias] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);

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

  // Enquanto a execução ficar "pendente de envio" na fila local, escuta
  // qualquer sincronização (evento online, intervalo periódico, Background
  // Sync do service worker) pra saber assim que o servidor confirmar de
  // verdade, mesmo que o colaborador continue com a página aberta.
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

  useEffect(() => {
    Promise.all([
      ambientesStore.getById(id),
      checklistItemsStore.list({ ambiente_id: id }),
    ]).then(([amb, checklist]) => {
      setAmbiente(amb);
      setItems(checklist.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      setLoading(false);
    });
    loadPendingOcorrencias();
  }, [id]);

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

  const toggleItem = (itemId) => {
    setChecked((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    const base64 = await fileToBase64(file);
    setPhoto(base64);
  };

  const completedCount = Object.values(checked).filter(Boolean).length;
  const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0;

  const handleSubmit = async () => {
    setSubmitError('');

    // Salva na fila local (IndexedDB) ANTES de tentar enviar — é o que
    // garante que a execução não se perde se o colaborador confirmar numa
    // área sem sinal (elevador, subsolo, garagem) e a conexão cair na hora
    // do envio. O createStore.js genérico não serve aqui: ele cai
    // silenciosamente pro localStorage em qualquer erro de rede e devolve
    // um "sucesso" fake que nunca chega no painel do gestor.
    const record = {
      id: generateRecordId(),
      created_at: new Date().toISOString(),
      ambiente_id: id,
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

  if (loading) return <Group justify="center" py={80}><Loader color="brand" /></Group>;
  if (!ambiente) return <Text ta="center" py={80}>Ambiente não encontrado.</Text>;

  // Salvo localmente mas ainda NÃO confirmado pelo servidor — de propósito
  // não usa o mesmo visual de sucesso da tela "done" abaixo, pra não
  // sugerir que já chegou no painel do gestor quando na verdade só está
  // guardado neste aparelho, esperando a conexão voltar.
  if (pendingLocal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="surface-card"
          style={{ maxWidth: 400, margin: '0 20px', padding: '48px 32px', textAlign: 'center' }}
        >
          <div style={{
            width: 76, height: 76, borderRadius: '50%', background: 'var(--amber-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <CloudUpload size={38} color="var(--amber)" />
          </div>
          <Text fw={800} size="lg">Salvo neste dispositivo</Text>
          <Text c="dimmed" size="sm" mt={4}>{ambiente.name}</Text>
          <Text size="sm" mt={12} style={{ color: '#92620a' }}>
            Sua execução ainda não foi confirmada pelo servidor. Ela será enviada automaticamente assim que a conexão voltar — você pode fechar o app com segurança, nada será perdido.
          </Text>
          <Button mt="xl" variant="light" fullWidth size="md" onClick={handleRetryNow} loading={retrying} style={{ minHeight: 44 }}>
            Tentar enviar agora
          </Button>
        </motion.div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="surface-card"
          style={{ maxWidth: 400, margin: '0 20px', padding: '48px 32px', textAlign: 'center' }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 14 }}
            style={{
              width: 76, height: 76, borderRadius: '50%', background: 'var(--green-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}
            className="pulse-ring"
          >
            <CheckCircle2 size={40} color="var(--green)" />
          </motion.div>
          <Text fw={800} size="lg">Checklist concluído!</Text>
          <Text c="dimmed" size="sm" mt={4}>{ambiente.name}</Text>
          {items.length > 0 ? (
            <Text size="xs" c="dimmed" mt={10}>{completedCount} de {items.length} tarefas marcadas como feitas</Text>
          ) : (
            <Text size="xs" c="dimmed" mt={10}>Registro livre enviado</Text>
          )}
          <Button mt="xl" variant="light" fullWidth size="md" onClick={() => window.location.reload()} style={{ minHeight: 44 }}>Executar novamente</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 60px' }}>
        <Group gap={8} mb={16}>
          <span className="icon-tile" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--blue-light)' }}>
            <Building2 size={15} color="var(--blue)" />
          </span>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.06em' }}>Cond-Informa</Text>
        </Group>

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

        <div className="surface-card" style={{ padding: 22, marginBottom: 18 }}>
          <Text fw={800} size="xl" mb={4}>{ambiente.name}</Text>
          <Text size="sm" c="dimmed" mb={16}>Marque as tarefas realizadas e confirme a execução.</Text>

          {items.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <Group justify="space-between" mb={6}>
                <Text size="xs" fw={700} c="dimmed">Progresso</Text>
                <Text size="xs" fw={700} c={progressPct === 100 ? 'green' : 'dimmed'}>{completedCount}/{items.length}</Text>
              </Group>
              <Progress
                value={progressPct}
                color={progressPct === 100 ? 'green' : 'brand'}
                radius="xl"
                size={8}
                aria-label={`Progresso do checklist: ${completedCount} de ${items.length} tarefas concluídas`}
              />
            </div>
          )}
        </div>

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
                // <label> nativo em vez de <div onClick> — clicar em
                // qualquer parte da linha, tocar com a tela suja/luvas, ou
                // navegar por Tab + Espaço no checkbox já funciona sozinho
                // (associação label/input nativa do navegador), sem
                // precisar de nenhum JS extra de teclado.
                <label
                  key={item.id}
                  htmlFor={inputId}
                  className={`surface-card checklist-row ${isDone ? 'checklist-row--done' : ''}`}
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'block' }}
                >
                  <Group justify="space-between" wrap="nowrap">
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
                </label>
              );
            })}
          </div>
        ) : (
          <Text c="dimmed" size="sm" mb="lg">Nenhuma tarefa cadastrada para este ambiente ainda. Você ainda pode confirmar um registro livre abaixo.</Text>
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

        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <OcorrenciaForm ambienteId={id} accountId={ambiente.account_id} reportedByRole="colaborador" />
        </div>
      </div>
    </div>
  );
}
