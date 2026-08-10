import { Text, Group, Badge, Button, ActionIcon, Image as MantineImage } from '@mantine/core';
import { Trash2, ListChecks } from 'lucide-react';

// Card de ocorrência compartilhado entre a aba Ocorrências (dentro de
// AmbientePage) e a página agregada OcorrenciasPage — mesmo visual nos
// dois lugares, de propósito.
export default function OcorrenciaCard({
  ocorrencia: o,
  relatedTask,
  locationLabel,
  onResolve,
  onDelete,
  resolving = false,
}) {
  const isPendente = o.status !== 'resolvido';
  const moradorName = o.reported_by_role === 'morador' ? o.reporter_name?.trim() : null;

  return (
    <div className="surface-card" style={{ padding: 20 }}>
      <Group justify="space-between" align="flex-start" mb={10}>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Ocorrência{o.code ? ` ${o.code}` : ''}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={isPendente ? 'red' : 'green'} variant="light">{isPendente ? 'Pendente' : 'Resolvido'}</Badge>
          {onDelete && (
            <ActionIcon variant="light" color="red" radius="md" size="sm" onClick={onDelete} aria-label="Excluir ocorrência">
              <Trash2 size={13} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {locationLabel && <Text size="xs" c="dimmed" fw={600} mb={4}>{locationLabel}</Text>}
      <Text fw={700} size="md" mb={14}>{o.description}</Text>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <Group grow align="flex-start" mb={o.reported_by_role || relatedTask ? 8 : 0}>
          <div>
            <Text size="xs" c="dimmed" fw={600} mb={2}>Data e hora</Text>
            <Text size="sm">{new Date(o.created_at).toLocaleString('pt-BR')}</Text>
          </div>
          {o.reported_by_role === 'morador' && o.reporter_unidade && (
            <div>
              <Text size="xs" c="dimmed" fw={600} mb={2}>Unidade</Text>
              <Text size="sm">{o.reporter_unidade}</Text>
            </div>
          )}
        </Group>

        {moradorName && (
          <Text size="sm" mb={relatedTask ? 6 : 0}>
            <Text component="span" c="dimmed" fw={600}>Morador: </Text>{moradorName}
          </Text>
        )}
        {o.reported_by_role === 'colaborador' && o.reporter_name?.trim() && (
          <Text size="sm" mb={relatedTask ? 6 : 0}>
            <Text component="span" c="dimmed" fw={600}>Colaborador: </Text>{o.reporter_name.trim()}
          </Text>
        )}

        {relatedTask && (
          <Group gap={6} wrap="nowrap" align="flex-start">
            <ListChecks size={14} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
            <Text size="sm"><Text component="span" c="dimmed" fw={600}>Relacionado a: </Text>{relatedTask}</Text>
          </Group>
        )}
      </div>

      {o.photo ? (
        <div style={{ marginTop: 14 }}>
          <Text size="xs" c="dimmed" fw={600} mb={6}>Foto anexada</Text>
          <MantineImage src={o.photo} alt={`Foto anexada à ocorrência: ${o.description}`} radius="md" h={150} w={150} fit="cover" />
        </div>
      ) : null}

      {isPendente && onResolve && (
        <Button fullWidth color="green" variant="light" mt={14} onClick={onResolve} loading={resolving}>
          Marcar como resolvido
        </Button>
      )}
    </div>
  );
}
