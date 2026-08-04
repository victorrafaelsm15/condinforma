import { useEffect, useState } from 'react';
import { getInstallState, subscribeInstallState, promptInstall } from './installPrompt';

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function useInstallPrompt() {
  const [state, setState] = useState(getInstallState);

  useEffect(() => subscribeInstallState(() => setState(getInstallState())), []);

  return {
    ...state,
    // iOS/Safari não dispara beforeinstallprompt — não dá pra abrir o
    // diálogo programaticamente, então sinalizamos isso à parte pra UI
    // mostrar a instrução manual (Compartilhar > Adicionar à Tela de Início).
    isIosManual: isIos() && !state.installed,
    promptInstall,
  };
}
