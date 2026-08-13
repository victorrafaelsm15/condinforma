import { Link } from 'react-router-dom';
import { Text, Group, Badge } from '@mantine/core';
import { ChevronRight } from 'lucide-react';

// Linha compacta de ocorrência — usada na aba Ocorrências de AmbientePage
// e na página agregada OcorrenciasPage. Toda a interação (resolver,
// excluir, ver foto/vínculos) mora na tela de detalhe própria
// (OcorrenciaDetailPage); aqui é só navegação.
export default function OcorrenciaRow({ ocorrencia: o, locationLabel, to }) {
  const isPendente = o.status !== 'resolvido';
  const codeColor = isPendente ? 'var(--red)' : 'var(--green)';

  return (
    <Link to={to} className="surface-card surface-card--hover" style={{ display: 'block', padding: 18 }}>
      <Group justify="space-between" wrap="nowrap" align="center" gap={14}>
        <Group gap={16} wrap="nowrap" align="center" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <Text fw={800} size="md" style={{ color: codeColor }}>{o.code || '—'}</Text>
            <Badge size="xs" color={isPendente ? 'red' : 'green'} variant="light" mt={4}>
              {isPendente ? 'Pendente' : 'Resolvido'}
            </Badge>
          </div>
          <div style={{ minWidth: 0 }}>
            {locationLabel && <Text size="xs" c="dimmed" fw={600} mb={2}>{locationLabel}</Text>}
            <Text fw={700} size="md" truncate>{o.description}</Text>
          </div>
        </Group>
        <ChevronRight size={20} color="var(--text-faint)" style={{ flexShrink: 0 }} />
      </Group>
    </Link>
  );
}
