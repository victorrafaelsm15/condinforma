import { useState } from 'react';
import { Button, Modal, Text, List } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Download, Share, SquarePlus } from 'lucide-react';
import { useInstallPrompt } from '../../lib/useInstallPrompt';
import { setInstallSource } from '../../lib/installPrompt';

/**
 * Botão de "Instalar app". Usado tanto na landing page quanto na tela de
 * login — cada chamador decide o estilo (variant/color/size) pra combinar
 * com o fundo em que está.
 *
 * `installSource` marca de onde a instalação partiu (ex.: "login"), pra que
 * o ícone instalado abra direto naquela página em vez da landing page —
 * ver checkInstallLaunchRedirect em src/lib/installPrompt.js.
 */
export default function InstallAppButton({ label = 'Instalar app', installSource = null, ...buttonProps }) {
  const { canInstall, installed, isIosManual, promptInstall } = useInstallPrompt();
  const [iosModalOpen, setIosModalOpen] = useState(false);

  if (installed || (!canInstall && !isIosManual)) return null;

  const handleClick = async () => {
    setInstallSource(installSource);

    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        notifications.show({ color: 'green', message: 'App instalado! Procure o ícone do Cond Informa na tela inicial.' });
      } else {
        setInstallSource(null);
      }
      return;
    }
    // iOS não tem callback de conclusão — mantemos o source marcado, já que
    // é a intenção mais provável do usuário ao seguir as instruções.
    setIosModalOpen(true);
  };

  return (
    <>
      <Button leftSection={<Download size={16} />} onClick={handleClick} {...buttonProps}>
        <span className="install-btn-label">{label}</span>
      </Button>

      <Modal opened={iosModalOpen} onClose={() => setIosModalOpen(false)} title="Instalar o Cond Informa" centered>
        <Text size="sm" c="dimmed" mb="md">
          No iPhone/iPad, a instalação é feita pelo próprio Safari:
        </Text>
        <List spacing="sm" size="sm">
          <List.Item icon={<Share size={16} />}>Toque no ícone de Compartilhar na barra do Safari</List.Item>
          <List.Item icon={<SquarePlus size={16} />}>Escolha &quot;Adicionar à Tela de Início&quot;</List.Item>
        </List>
      </Modal>
    </>
  );
}
