import { Modal, Text, Button, Group } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';

// Confirmação padrão pra qualquer exclusão do painel — mesmo texto/visual
// em todos os lugares (condomínios, ambientes, execuções, assinantes,
// usuários, sub-usuários), pra manter consistência.
export default function ConfirmDeleteModal({ opened, onClose, onConfirm, itemLabel, loading }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Confirmar exclusão" centered size="sm">
      <Group gap={12} align="flex-start" mb="lg">
        <span className="icon-tile" style={{ background: 'var(--red-light)', width: 38, height: 38, borderRadius: 12, flexShrink: 0 }}>
          <AlertTriangle size={18} color="var(--red)" />
        </span>
        <Text size="sm">
          Tem certeza que deseja excluir <strong>{itemLabel}</strong>? Essa ação não pode ser desfeita.
        </Text>
      </Group>
      <Group justify="flex-end" gap={8}>
        <Button variant="default" onClick={onClose}>Cancelar</Button>
        <Button color="red" onClick={onConfirm} loading={loading}>Excluir</Button>
      </Group>
    </Modal>
  );
}
