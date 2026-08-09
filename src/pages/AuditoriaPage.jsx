import { Text } from '@mantine/core';
import AuditLogSection from '../components/admin/AuditLogSection';

export default function AuditoriaPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Text fw={800} size="1.6rem" className="font-display">Auditoria</Text>
        <Text size="md" c="dimmed" mt={2}>Histórico de ações administrativas: quem fez o quê e quando.</Text>
      </div>

      <AuditLogSection />
    </div>
  );
}
