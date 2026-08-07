import { useState } from 'react';
import { Drawer, Text, Switch, Button, Group, Divider, Modal, useMantineColorScheme } from '@mantine/core';
import { Moon, Sun, Headphones, LogOut } from 'lucide-react';
import SubUsuariosSection from './SubUsuariosSection';

export default function ConfiguracoesDrawer({ opened, onClose, onLogout, isSubUsuario }) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [supportOpen, setSupportOpen] = useState(false);
  const isDark = colorScheme === 'dark';

  return (
    <>
      <Drawer opened={opened} onClose={onClose} position="right" size="25%" title="Configurações" padding="lg">
        {/* Sub-usuário não gerencia sub-usuários nem enxerga configurações
            de plano/pagamento — só a conta principal vê esta seção. */}
        {!isSubUsuario && (
          <>
            <SubUsuariosSection />
            <Divider my="lg" />
          </>
        )}

        <Group justify="space-between" mb="lg">
          <Group gap={8}>
            {isDark ? <Moon size={16} color="var(--blue)" /> : <Sun size={16} color="var(--amber)" />}
            <Text fw={700} size="sm">Modo escuro</Text>
          </Group>
          <Switch
            checked={isDark}
            onChange={(e) => setColorScheme(e.currentTarget.checked ? 'dark' : 'light')}
            aria-label="Alternar modo escuro"
          />
        </Group>

        <Divider mb="lg" />

        <Button
          variant="light"
          color="gray"
          fullWidth
          leftSection={<Headphones size={16} />}
          onClick={() => setSupportOpen(true)}
          mb="lg"
        >
          Falar com o suporte
        </Button>

        <Divider mb="lg" />

        <Button variant="filled" color="gray" fullWidth leftSection={<LogOut size={16} />} onClick={onLogout}>
          Sair
        </Button>
      </Drawer>

      <Modal opened={supportOpen} onClose={() => setSupportOpen(false)} title="Falar com o suporte" centered>
        <Text size="sm" c="dimmed" mb="md">
          Nosso atendimento automático chega em breve por aqui. Enquanto isso, você pode falar
          diretamente com a gente por e-mail.
        </Text>
        <Button component="a" href="mailto:suporte@condinforma.com.br" fullWidth variant="light">
          Enviar e-mail
        </Button>
      </Modal>
    </>
  );
}
