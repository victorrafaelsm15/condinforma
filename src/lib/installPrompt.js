// Captura o evento beforeinstallprompt uma única vez, no nível do módulo,
// pra que qualquer página (landing, login, admin) consiga oferecer o botão
// de instalar mesmo que o evento tenha disparado antes dela montar.
let deferredPrompt = null;
let installed = false;
const listeners = new Set();

// Guarda de onde a instalação foi disparada, pra decidir pra onde o ícone
// instalado deve abrir (ver checkInstallLaunchRedirect em main.jsx). Fica
// salvo no localStorage porque precisa sobreviver ao fechamento do app.
export const INSTALL_SOURCE_KEY = 'condinforma_install_source';

export function setInstallSource(source) {
  if (source) localStorage.setItem(INSTALL_SOURCE_KEY, source);
  else localStorage.removeItem(INSTALL_SOURCE_KEY);
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

if (typeof window !== 'undefined') {
  installed = isStandalone();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    listeners.forEach((cb) => cb());
  });
}

/**
 * Roda antes do HashRouter montar. Se o app foi aberto em modo standalone
 * (ícone instalado) direto na rota raiz, e a instalação partiu do botão da
 * página de login, troca o hash pra "/admin/login" antes do React ler a URL
 * — assim a landing page nunca chega a renderizar.
 */
export function checkInstallLaunchRedirect() {
  if (typeof window === 'undefined') return;
  if (!isStandalone()) return;

  const source = localStorage.getItem(INSTALL_SOURCE_KEY);
  const atRoot = !window.location.hash || window.location.hash === '#/' || window.location.hash === '#';
  if (source === 'login' && atRoot) {
    window.location.hash = '#/admin/login';
  }
}

export function getInstallState() {
  return { canInstall: !!deferredPrompt && !installed, installed };
}

export function subscribeInstallState(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function promptInstall() {
  if (!deferredPrompt) return null;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((cb) => cb());
  return outcome; // 'accepted' | 'dismissed'
}
