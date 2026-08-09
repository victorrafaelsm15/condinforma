import { useEffect, useMemo, useState } from 'react';
import { Text, Group, Loader, Badge, Select } from '@mantine/core';
import { getSession } from '../../lib/authService';
import { listAuditLog } from '../../lib/auditLog';
import { listSubUsuarios } from '../../lib/subUsuario';

const ACTION_LABELS = {
  'condominio.criado': 'Condomínio criado',
  'condominio.editado': 'Condomínio editado',
  'condominio.excluido': 'Condomínio excluído',
  'ambiente.criado': 'Ambiente criado',
  'ambiente.editado': 'Ambiente editado',
  'ambiente.excluido': 'Ambiente excluído',
  'checklist.item_criado': 'Item de checklist criado',
  'checklist.item_editado': 'Item de checklist editado',
  'checklist.item_excluido': 'Item de checklist excluído',
  'execucao.excluida': 'Execução excluída',
  'sub_usuario.criado': 'Sub-usuário criado',
  'sub_usuario.editado': 'Permissões de sub-usuário editadas',
  'sub_usuario.excluido': 'Sub-usuário excluído',
  'plano.alterado': 'Plano alterado',
};

const ACTION_COLORS = {
  criado: 'green',
  editado: 'blue',
  excluido: 'red',
  excluida: 'red',
  alterado: 'violet',
};

function colorFor(action) {
  const suffix = action.split('_').pop().split('.').pop();
  return ACTION_COLORS[suffix] || 'gray';
}

function summarizeDetails(entry) {
  const d = entry.details;
  if (!d) return null;
  if (d.name) return d.name;
  if (d.nome) return d.nome;
  if (d.task) return d.task;
  if (d.antes !== undefined && d.depois !== undefined) return `${d.antes ?? '—'} → ${d.depois ?? '—'}`;
  return null;
}

export default function AuditLogSection() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [actorNames, setActorNames] = useState({});
  const [accountId, setAccountId] = useState(null);
  const [actionFilter, setActionFilter] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      setAccountId(session.user.id);
      const [log, subs] = await Promise.all([
        listAuditLog(session.user.id),
        listSubUsuarios(session.user.id),
      ]);
      setEntries(log);
      setActorNames(Object.fromEntries(subs.map((s) => [s.auth_user_id, s.nome])));
      setLoading(false);
    })();
  }, []);

  const actionOptions = useMemo(() => {
    const unique = [...new Set(entries.map((e) => e.action))];
    return unique.map((a) => ({ value: a, label: ACTION_LABELS[a] || a }));
  }, [entries]);

  const filtered = actionFilter ? entries.filter((e) => e.action === actionFilter) : entries;

  const actorLabel = (entry) => {
    if (!entry.auth_user_id) return 'Sistema';
    if (entry.auth_user_id === accountId) return 'Você (conta principal)';
    return actorNames[entry.auth_user_id] || 'Sub-usuário';
  };

  if (loading) return <Group justify="center" py={60}><Loader color="brand" /></Group>;

  return (
    <div>
      {entries.length ? (
        <>
          <Select
            placeholder="Filtrar por tipo de ação"
            data={actionOptions}
            value={actionFilter}
            onChange={setActionFilter}
            clearable
            size="sm"
            mb="lg"
            style={{ maxWidth: 320 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((entry) => {
              const summary = summarizeDetails(entry);
              return (
                <div key={entry.id} className="surface-card" style={{ padding: 10 }}>
                  <Group justify="space-between" gap={8} wrap="nowrap">
                    <Badge size="xs" color={colorFor(entry.action)} variant="light">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </Badge>
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {new Date(entry.created_at).toLocaleString('pt-BR')}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>{actorLabel(entry)}</Text>
                  {summary && <Text size="xs" mt={2} truncate>{summary}</Text>}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <Text size="xs" c="dimmed">Nenhuma ação registrada ainda.</Text>
      )}
    </div>
  );
}
