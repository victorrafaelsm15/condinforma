import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Button, Textarea, TextInput, FileButton, Group } from '@mantine/core';
import { Camera, AlertTriangle, CloudUpload } from 'lucide-react';
import { enqueue, syncQueue, isPending, subscribeQueue, generateRecordId } from '../lib/offlineQueue';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Formulário de "Registrar ocorrência", usado tanto na página pública do
 * colaborador (ExecutarChecklistPage) quanto na página pública do morador
 * (StatusPublicoPage) — nenhuma das duas exige login, por isso grava
 * account_id copiado do ambiente, igual ao resto do fluxo público.
 */
export default function OcorrenciaForm({
  ambienteId,
  accountId,
  reportedByRole,
  askReporterName = false,
  triggerLabel = 'Encontrou um problema? Registrar ocorrência',
}) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterUnidade, setReporterUnidade] = useState('');
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pendingLocal, setPendingLocal] = useState(false);
  const [queuedRecordId, setQueuedRecordId] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  // Igual ao ExecutarChecklistPage: enquanto a ocorrência estiver
  // "pendente de envio" na fila local, escuta qualquer sincronização
  // (evento online, intervalo periódico, Background Sync) pra virar
  // "enviado" assim que o servidor confirmar de verdade.
  useEffect(() => {
    if (!queuedRecordId) return undefined;
    const unsubscribe = subscribeQueue(async () => {
      const stillPending = await isPending(queuedRecordId);
      if (!stillPending) {
        setPendingLocal(false);
        setSent(true);
      }
    });
    return unsubscribe;
  }, [queuedRecordId]);

  const handleSend = async () => {
    if (!description.trim()) {
      setError('Descreva o problema encontrado.');
      return;
    }
    setError('');

    // Salva na fila local (IndexedDB) ANTES de tentar enviar — mesma
    // lógica da execução de checklist, pra não perder o registro se a
    // conexão cair no momento do envio.
    const record = {
      id: generateRecordId(),
      created_at: new Date().toISOString(),
      ambiente_id: ambienteId,
      account_id: accountId,
      description: description.trim(),
      photo,
      status: 'pendente',
      reported_by_role: reportedByRole,
      reporter_name: askReporterName && reporterName.trim() ? reporterName.trim() : null,
      reporter_unidade: askReporterName && reporterUnidade.trim() ? reporterUnidade.trim() : null,
    };

    setSending(true);
    try {
      await enqueue('ocorrencia', record);
      setQueuedRecordId(record.id);
      await syncQueue();
      const stillPending = await isPending(record.id);
      if (stillPending) setPendingLocal(true);
      else setSent(true);
    } catch {
      setError('Não foi possível salvar sua ocorrência neste dispositivo. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleRetryNow = async () => {
    setRetrying(true);
    await syncQueue();
    const stillPending = queuedRecordId ? await isPending(queuedRecordId) : false;
    if (!stillPending) {
      setPendingLocal(false);
      setSent(true);
    }
    setRetrying(false);
  };

  return (
    <AnimatePresence mode="wait">
      {!expanded ? (
        <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Button
            variant="subtle"
            color="red"
            fullWidth
            leftSection={<AlertTriangle size={15} />}
            onClick={() => setExpanded(true)}
          >
            {triggerLabel}
          </Button>
        </motion.div>
      ) : pendingLocal ? (
        <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="surface-card" style={{ padding: 16, textAlign: 'center', background: 'var(--amber-light)', borderColor: 'rgba(245,158,11,0.3)' }}>
            <Group justify="center" gap={8} mb={4}>
              <CloudUpload size={16} color="var(--amber)" />
              <Text size="sm" fw={700} style={{ color: '#92620a' }}>Salva neste dispositivo</Text>
            </Group>
            <Text size="xs" style={{ color: '#92620a' }} mb={10}>
              Ainda não confirmada pelo servidor. Será enviada automaticamente assim que a conexão voltar.
            </Text>
            <Button size="xs" variant="light" onClick={handleRetryNow} loading={retrying}>
              Tentar enviar agora
            </Button>
          </div>
        </motion.div>
      ) : sent ? (
        <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="surface-card" style={{ padding: 16, textAlign: 'center', background: 'var(--green-light)', borderColor: 'rgba(18,183,106,0.25)' }}>
            <Text size="sm" c="green" fw={700}>Ocorrência registrada. Obrigado!</Text>
          </div>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Text fw={700} size="sm" mb="sm">Registrar ocorrência</Text>
          {askReporterName && (
            <Group grow mb="sm" gap="sm">
              <TextInput
                placeholder="Seu nome (opcional)"
                value={reporterName}
                onChange={(e) => setReporterName(e.currentTarget.value)}
              />
              <TextInput
                placeholder="Unidade / Apto (opcional)"
                value={reporterUnidade}
                onChange={(e) => setReporterUnidade(e.currentTarget.value)}
              />
            </Group>
          )}
          <Textarea
            placeholder="Descreva o problema encontrado"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            minRows={3}
            mb="sm"
          />
          <FileButton onChange={async (f) => setPhoto(f ? await fileToBase64(f) : null)} accept="image/*">
            {(props) => (
              <Button {...props} variant="light" leftSection={<Camera size={16} />} fullWidth mb="sm">
                {photo ? 'Foto anexada ✓' : 'Anexar foto (opcional)'}
              </Button>
            )}
          </FileButton>
          <Button fullWidth color="red" onClick={handleSend} loading={sending}>
            Enviar ocorrência
          </Button>
          {error && <Text size="sm" c="red" fw={600} mt={10} ta="center">{error}</Text>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
