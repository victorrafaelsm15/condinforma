import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

import { theme } from './theme';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';
import { checkInstallLaunchRedirect } from './lib/installPrompt';

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Antes do HashRouter ler a URL: se o ícone instalado veio do botão da
// página de login, já troca o hash pra lá — a landing page nunca renderiza.
checkInstallLaunchRedirect();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <HashRouter>
        <App />
      </HashRouter>
    </MantineProvider>
  </StrictMode>,
);
