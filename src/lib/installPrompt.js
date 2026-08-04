// Captura o evento beforeinstallprompt uma única vez, no nível do módulo,
// pra que qualquer página (landing, login, admin) consiga oferecer o botão
// de instalar mesmo que o evento tenha disparado antes dela montar.
let deferredPrompt = null;
let installed = false;
const listeners = new Set();

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
