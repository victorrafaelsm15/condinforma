import { useEffect, useState } from 'react';
import { Text, Group, Loader, Badge, Button, ActionIcon, Menu, Image as MantineImage } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Trash2, Check, FileDown, Download, Share2, Calendar } from 'lucide-react';
import { execucoesStore, ocorrenciasStore, checklistItemsStore } from '../../lib/stores';
import { generateComunicadoPdf, downloadPdf, sharePdf } from '../../lib/comunicado';
import { logAudit } from '../../lib/auditLog';
import ConfirmDeleteModal from '../common/ConfirmDeleteModal';

function ComunicadoMenu({ label, icon, onPick, loading, disabled }) {
  return (
    <Menu shadow="md" width={210} position="bottom-end" withinPortal disabled={disabled}>
      <Menu.Target>
        <Button size="xs" variant="light" leftSection={icon} loading={loading} disabled={disabled} onClick={(e) => e.stopPropagation()}>
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item leftSection={<Download size={14} />} onClick={() => onPick('download')}>Baixar PDF</Menu.Item>
        <Menu.Item leftSection={<Share2 size={14} />} onClick={() => onPick('share')}>Compartilhar (WhatsApp)</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// Histórico de execuções — reaproveitado tanto na aba "Histórico" de
// AmbientePage (ambiente inteiro, sem periodoId) quanto na página própria
// de cada período fechado (ChecklistPeriodoPage, passando periodoId pra
// filtrar só as execuções daquele período especificamente).
export default function HistoryTab({ ambienteId, ambienteName, condominioName, periodoId }) {
  const [execs, setExecs] = useState([]);
  const [ocorrenciasVinculadas, setOcorrenciasVinculadas] = useState([]);
  const [itemsById, setItemsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [generatingId, setGeneratingId] = useState(null);
  const [generatingPeriod, setGeneratingPeriod] = useState(false);
  const [generatingSelection, setGeneratingSelection] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    setSelectedIds(new Set());
    const execFilter = periodoId ? { ambiente_id: ambienteId, checklist_periodo_id: periodoId } : { ambiente_id: ambienteId };
    Promise.all([
      execucoesStore.list(execFilter),
      ocorrenciasStore.list({ ambiente_id: ambienteId }),
      checklistItemsStore.list({ ambiente_id: ambienteId }),
    ]).then(([data, ocorrencias, items]) => {
      setExecs(data);
      // Só as que têm vínculo com um item — é só isso que entra no
      // resumo do comunicado.
      setOcorrenciasVinculadas(ocorrencias.filter((o) => o.related_checklist_item_id));
      setItemsById(Object.fromEntries(items.map((i) => [i.id, i.task])));
      setLoading(false);
    });
  };

  useEffect(load, [ambienteId, periodoId]);

  // Só faz sentido resumir "ocorrências vinculadas no período" quando o
  // comunicado cobre mais de uma execução (período/seleção) — pra uma
  // única execução, a janela de tempo é só aquele instante, e a seção
  // ficaria sempre vazia.
  const buildItemOcorrenciaCounts = (execucoes) => {
    if (execucoes.length <= 1) return undefined;
    const timestamps = execucoes.map((e) => new Date(e.created_at).getTime());
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const counts = {};
    ocorrenciasVinculadas.forEach((o) => {
      const t = new Date(o.created_at).getTime();
      if (t < min || t > max) return;
      counts[o.related_checklist_item_id] = (counts[o.related_checklist_item_id] || 0) + 1;
    });
    const rows = Object.entries(counts)
      .map(([itemId, count]) => ({ task: itemsById[itemId] || 'Tarefa removida', count }))
      .sort((a, b) => b.count - a.count);
    return rows.length ? rows : undefined;
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await execucoesStore.remove(deleting.id);
      logAudit({ action: 'execucao.excluida', entityType: 'execucao', entityId: deleting.id, details: { executed_by: deleting.executed_by, created_at: deleting.created_at } });
      notifications.show({ color: 'green', message: 'Execução excluída.' });
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível excluir a execução.' });
    } finally {
      setRemoving(false);
      setDeleting(null);
      load();
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(execs.map((e) => e.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const runComunicado = async (execucoes, filename, action, setBusy, key) => {
    if (!execucoes.length) {
      notifications.show({ color: 'red', message: 'Nenhuma execução selecionada pra gerar comunicado.' });
      return;
    }
    setBusy(key);
    try {
      const itemOcorrenciaCounts = buildItemOcorrenciaCounts(execucoes);
      const doc = generateComunicadoPdf({ condominioName, ambienteName, execucoes, itemOcorrenciaCounts });
      if (action === 'share') {
        const result = await sharePdf(doc, filename);
        if (result === 'downloaded') {
          notifications.show({ color: 'blue', message: 'Seu navegador não suporta compartilhar arquivos. O PDF foi baixado.' });
        }
      } else {
        downloadPdf(doc, filename);
      }
    } catch {
      notifications.show({ color: 'red', message: 'Não foi possível gerar o PDF. Tente novamente.' });
    } finally {
      setBusy(null);
    }
  };

  const handleExecucaoComunicado = (exec, action) => {
    const dataStr = new Date(exec.created_at).toLocaleDateString('pt-BR').replaceAll('/', '-');
    runComunicado([exec], `comunicado-${ambienteName}-${dataStr}.pdf`, action, setGeneratingId, exec.id);
  };

  const handlePeriodoComunicado = (days, action) => {
    const cutoff = days ? Date.now() - days * 24 * 3_600_000 : null;
    const filtered = cutoff ? execs.filter((e) => new Date(e.created_at).getTime() >= cutoff) : execs;
    const label = days ? `ultimos-${days}-dias` : 'todas';
    runComunicado(filtered, `comunicado-${ambienteName}-${label}.pdf`, action, setGeneratingPeriod, true);
  };

  const handleSelectionComunicado = (action) => {
    // .filter preserva a ordem em que aparecem em "execs" (mais recente primeiro)
    const selectedExecs = execs.filter((e) => selectedIds.has(e.id));
    runComunicado(selectedExecs, `comunicado-${ambienteName}-selecionados.pdf`, action, setGeneratingSelection, true);
  };

  if (loading) return <Loader size="sm" color="brand" />;

  return (
    <div>
      {!!execs.length && (
        <Group justify="space-between" mb="md" wrap="wrap" gap={10}>
          <Group gap={8}>
            <Button size="xs" variant="light" onClick={selectAll}>Selecionar todos</Button>
            <Button size="xs" variant="light" color="gray" onClick={deselectAll}>Desmarcar todos</Button>
          </Group>
          <Group gap={8}>
            <ComunicadoMenu
              label={selectedIds.size ? `Gerar comunicado (${selectedIds.size})` : 'Gerar comunicado'}
              icon={<FileDown size={14} />}
              loading={!!generatingSelection}
              disabled={!selectedIds.size}
              onPick={handleSelectionComunicado}
            />
            <Menu shadow="md" width={230} position="bottom-end" withinPortal>
              <Menu.Target>
                <Button size="xs" variant="default" leftSection={<Calendar size={14} />} loading={!!generatingPeriod}>
                  Por período
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Baixar PDF</Menu.Label>
                <Menu.Item onClick={() => handlePeriodoComunicado(7, 'download')}>Últimos 7 dias</Menu.Item>
                <Menu.Item onClick={() => handlePeriodoComunicado(30, 'download')}>Últimos 30 dias</Menu.Item>
                <Menu.Item onClick={() => handlePeriodoComunicado(null, 'download')}>Todo o histórico</Menu.Item>
                <Menu.Divider />
                <Menu.Label>Compartilhar (WhatsApp)</Menu.Label>
                <Menu.Item onClick={() => handlePeriodoComunicado(7, 'share')}>Últimos 7 dias</Menu.Item>
                <Menu.Item onClick={() => handlePeriodoComunicado(30, 'share')}>Últimos 30 dias</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      )}

      {!execs.length ? (
        <Text c="dimmed" size="sm">Nenhuma execução registrada ainda.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {execs.map((e) => {
            const isSelected = selectedIds.has(e.id);
            return (
              <div key={e.id} className="surface-card" style={{ padding: 16 }}>
                <Group justify="space-between" align="flex-start" wrap="wrap" gap={10}>
                  <Group gap={10} align="flex-start" wrap="nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSelect(e.id)}
                      aria-label={isSelected ? 'Desmarcar execução' : 'Marcar execução'}
                      aria-pressed={isSelected}
                      style={{
                        width: 22, height: 22, marginTop: 2, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
                        border: isSelected ? 'none' : '2px solid var(--border)',
                        background: isSelected ? 'var(--blue)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s var(--ease)',
                      }}
                    >
                      {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                    </button>
                    <div>
                      <Text size="sm" fw={600}>{e.executed_by || 'Colaborador'}</Text>
                      <Text size="xs" c="dimmed">{new Date(e.created_at).toLocaleString('pt-BR')}</Text>
                    </div>
                  </Group>
                  <Group gap={8}>
                    <Badge color="green" variant="light">{e.completed_count}/{e.total_count} tarefas</Badge>
                    <ComunicadoMenu
                      label="Gerar comunicado"
                      icon={<FileDown size={14} />}
                      loading={generatingId === e.id}
                      onPick={(action) => handleExecucaoComunicado(e, action)}
                    />
                    <ActionIcon variant="light" color="red" radius="md" onClick={() => setDeleting(e)} aria-label="Excluir execução">
                      <Trash2 size={15} />
                    </ActionIcon>
                  </Group>
                </Group>
                {e.free_text_note && (
                  <Text size="sm" mt={8} ml={32} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    &quot;{e.free_text_note}&quot;
                  </Text>
                )}
                {e.photo && <MantineImage src={e.photo} radius="md" mt="sm" ml={32} h={140} w={140} fit="cover" />}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        itemLabel="esta execução"
        loading={removing}
      />
    </div>
  );
}
