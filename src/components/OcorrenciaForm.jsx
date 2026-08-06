import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Button, Textarea, TextInput, FileButton } from '@mantine/core';
import { Camera, AlertTriangle } from 'lucide-react';
import { ocorrenciasStore } from '../lib/stores';

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
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!description.trim()) {
      setError('Descreva o problema encontrado.');
      return;
    }
    setError('');
    if (!navigator.onLine) {
      setError('Sem conexão com a internet. O texto continua preenchido — tente enviar de novo assim que o sinal voltar.');
      return;
    }
    setSending(true);
    try {
      await ocorrenciasStore.create({
        ambiente_id: ambienteId,
        account_id: accountId,
        description: description.trim(),
        photo,
        status: 'pendente',
        reported_by_role: reportedByRole,
        reporter_name: askReporterName && reporterName.trim() ? reporterName.trim() : null,
      });
      setSent(true);
    } catch {
      setError('Não foi possível enviar agora. O texto continua preenchido — tente novamente em instantes.');
    } finally {
      setSending(false);
    }
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
            <TextInput
              placeholder="Nome / Unidade (opcional)"
              value={reporterName}
              onChange={(e) => setReporterName(e.currentTarget.value)}
              mb="sm"
            />
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
