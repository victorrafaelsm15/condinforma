import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer, Text, Switch, Button, Group, Divider, useMantineColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Moon, Sun, Headphones, LogOut, Compass, ShieldCheck } from 'lucide-react';
import PlanoSection from './PlanoSection';
import PushToggleSection from './PushToggleSection';
import SupportChat from '../SupportChat';

export default function ConfiguracoesDrawer({ opened, onClose, onLogout, isSubUsuario }) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [supportOpen, setSupportOpen] = useState(false);
  const isDark = colorScheme === 'dark';
  // No celular 25% da tela fica minúsculo e apertado pra tocar — usa
  // quase a largura toda; no desktop/tablet mantém o painel estreito.
  const isMobile = useMediaQuery('(max-width: 600px)');

  return (
    <>
      <Drawer opened={opened} onClose={onClose} position="right" size={isMobile ? '100%' : '25%'} title="Configurações" padding="lg">
        {/* Sub-usuários e Auditoria viraram itens próprios da sidebar
            esquerda — só Plano continua aqui (sub-usuário não gerencia
            plano/pagamento da conta principal). */}
        {!isSubUsuario && (
          <>
            <PlanoSection />
            <Divider my="lg" />
          </>
        )}

        <Button
          component={Link}
          to="/admin/seguranca"
          variant="light"
          color="gray"
          fullWidth
          leftSection={<ShieldCheck size={16} />}
          onClick={onClose}
          mb="lg"
        >
          Segurança
        </Button>

        <Divider mb="lg" />

        <PushToggleSection />

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

        {/* Rever o tutorial reabre o wizard de boas-vindas no dashboard,
            mesmo já tendo sido concluído — só faz sentido pra quem
            gerencia condomínios, não pro sub-usuário. */}
        {!isSubUsuario && (
          <>
            <Button
              component={Link}
              to="/admin?tutorial=1"
              variant="light"
              color="gray"
              fullWidth
              leftSection={<Compass size={16} />}
              onClick={onClose}
              mb="lg"
            >
              Ver tutorial
            </Button>
            <Divider mb="lg" />
          </>
        )}

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

      <SupportChat opened={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
