import { Text } from '@mantine/core';
import SubUsuariosSection from '../components/admin/SubUsuariosSection';

export default function SubUsuariosPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Text fw={800} size="1.6rem" className="font-display">Sub-usuários</Text>
        <Text size="md" c="dimmed" mt={2}>Dê acesso a colaboradores da sua equipe, condomínio por condomínio.</Text>
      </div>

      <SubUsuariosSection />
    </div>
  );
}
