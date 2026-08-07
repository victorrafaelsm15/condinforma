import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Text, Checkbox, Button, TextInput, Textarea, Loader, FileButton, Group, Progress } from '@mantine/core';
import { CheckCircle2, Camera, Building2, WifiOff } from 'lucide-react';
import { ambientesStore, checklistItemsStore, execucoesStore } from '../lib/stores';
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

  useEffect(() => {
    Promise.all([
      ambientesStore.getById(id),
      checklistItemsStore.list({ ambiente_id: id }),
    ]).then(([amb, checklist]) => {
      setAmbiente(amb);
      setItems(checklist.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      setLoading(false);
    });
  }, [id]);

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

    // O checklistItemsStore (createStore.js) cai silenciosamente pra
    // localStorage se a chamada ao Supabase falhar — ótimo pra quando o
    // Supabase não está configurado, mas ruim aqui: sem internet, o
    // colaborador veria "concluído" mesmo sem a execução chegar no painel
    // do gestor. Por isso checamos a conexão ANTES de tentar, sem perder
    // nada do que já foi preenchido.
    if (!navigator.onLine) {
      setSubmitError('Sem conexão com a internet. Suas respostas continuam preenchidas — tente confirmar de novo assim que o sinal voltar.');
      return;
    }

    setSubmitting(true);
    try {
      await execucoesStore.create({
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
      });
      setDone(true);
    } catch {
      setSubmitError('Não foi possível confirmar agora. Suas respostas continuam preenchidas — tente novamente em instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Group justify="center" py={80}><Loader color="brand" /></Group>;
  if (!ambiente) return <Text ta="center" py={80}>Ambiente não encontrado.</Text>;

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
          <Button mt="xl" variant="light" fullWidth onClick={() => window.location.reload()}>Executar novamente</Button>
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16,
            background: 'var(--amber-light)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12,
          }}>
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
              <Progress value={progressPct} color={progressPct === 100 ? 'green' : 'brand'} radius="xl" size={8} />
            </div>
          )}
        </div>

        <TextInput
          placeholder="Seu nome (opcional)"
          value={executedBy}
          onChange={(e) => setExecutedBy(e.currentTarget.value)}
          mb="lg"
        />

        {items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {items.map((item, i) => {
              const isDone = !!checked[item.id];
              return (
                <div
                  key={item.id}
                  className={`surface-card checklist-row ${isDone ? 'checklist-row--done' : ''}`}
                  style={{ padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => toggleItem(item.id)}
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
                    <Checkbox checked={isDone} onChange={() => toggleItem(item.id)} onClick={(e) => e.stopPropagation()} color="green" />
                  </Group>
                </div>
              );
            })}
          </div>
        ) : (
          <Text c="dimmed" size="sm" mb="lg">Nenhuma tarefa cadastrada para este ambiente ainda. Você ainda pode confirmar um registro livre abaixo.</Text>
        )}

        <Textarea
          placeholder="Observação / registro livre (opcional) — descreva algo que fez ou notou, mesmo fora do checklist"
          value={freeTextNote}
          onChange={(e) => setFreeTextNote(e.currentTarget.value)}
          minRows={2}
          mb="md"
        />

        <FileButton onChange={handlePhoto} accept="image/*">
          {(props) => (
            <Button {...props} variant="light" leftSection={<Camera size={16} />} fullWidth mb="md">
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
          style={{ boxShadow: 'var(--shadow-brand)' }}
        >
          Confirmar execução
        </Button>
        {submitError && (
          <Text size="sm" c="red" fw={600} mt={10} ta="center">{submitError}</Text>
        )}

        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <OcorrenciaForm ambienteId={id} accountId={ambiente.account_id} reportedByRole="colaborador" />
        </div>
      </div>
    </div>
  );
}
