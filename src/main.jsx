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
import ErrorBoundary from './components/ErrorBoundary.jsx';
import MissingEnvScreen from './components/MissingEnvScreen.jsx';
import { registerSW } from 'virtual:pwa-register';
import { checkInstallLaunchRedirect } from './lib/installPrompt';
import { initAutoSync } from './lib/offlineQueue';

const root = createRoot(document.getElementById('root'));

// Desde a migração pra multi-tenant, o Supabase é obrigatório — sem essas
// duas variáveis o app não tem como autenticar nem ler/gravar nada. Checa
// ANTES de montar qualquer coisa (Mantine, router, App) pra parar aqui com
// uma mensagem clara, em vez de deixar tudo tentar continuar e falhar
// silenciosamente mais na frente (tela branca sem nenhuma pista).
const missingVars = [
  !import.meta.env.VITE_SUPABASE_URL && 'VITE_SUPABASE_URL',
  !import.meta.env.VITE_SUPABASE_ANON_KEY && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean);

if (missingVars.length) {
  root.render(<MissingEnvScreen missingVars={missingVars} />);
} else {
  if ('serviceWorker' in navigator) {
    registerSW({ immediate: true });
  }

  // Sincroniza a fila offline de execuções/ocorrências pendentes assim que
  // o app abre — cobre o caso do colaborador confirmar sem sinal, fechar o
  // app, e só voltar a ter conexão bem depois (Background Sync real é
  // registrado por item em offlineQueue.enqueue(), isto aqui é o fallback
  // que funciona mesmo em navegadores sem suporte a Background Sync).
  initAutoSync();

  // Antes do HashRouter ler a URL: se o ícone instalado veio do botão da
  // página de login, já troca o hash pra lá — a landing page nunca renderiza.
  checkInstallLaunchRedirect();

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="top-right" />
          <HashRouter>
            <App />
          </HashRouter>
        </MantineProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
