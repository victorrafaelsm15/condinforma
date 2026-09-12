// Quando o Supabase rejeita um link de e-mail (recovery/confirmação) — link
// expirado, já usado, etc — ele redireciona pra raiz do domínio com
// "?error=...&error_code=...&error_description=..." (às vezes duplicado no
// fragmento também), IGNORANDO completamente a rota que a gente pediu em
// redirectTo. O HashRouter então recebe um hash tipo
// "#error=access_denied&error_code=otp_expired&..." — não bate com nenhuma
// rota da SPA (o próprio texto do erro vira "o path"), e como não existe
// rota coringa, o React Router não renderiza nada: tela em branco, sem
// nenhuma pista pro usuário.
//
// Roda ANTES do React montar (main.jsx) — normaliza a URL pra mandar quem
// caiu aqui pra tela de "esqueci minha senha" com a mensagem de erro guardada
// (sessionStorage, porque precisa sobreviver ao "window.location.hash = ..."
// que troca a página inteira de estado de navegação).
const AUTH_ERROR_KEY = 'condinforma_auth_error';

const ERROR_MESSAGES = {
  otp_expired: 'Esse link de redefinição de senha expirou ou já foi usado. Solicite um novo abaixo.',
};

function extractErrorParams() {
  const search = new URLSearchParams(window.location.search);
  if (search.get('error')) {
    return { code: search.get('error_code'), description: search.get('error_description') };
  }
  // Fallback: em alguns casos o Supabase só coloca o erro no fragmento, sem
  // query string nenhuma.
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('error=')) {
    const hashParams = new URLSearchParams(hash);
    return { code: hashParams.get('error_code'), description: hashParams.get('error_description') };
  }
  return null;
}

export function normalizeAuthErrorRedirect() {
  const found = extractErrorParams();
  if (!found) return;

  const message = ERROR_MESSAGES[found.code] || (found.description && decodeURIComponent(found.description.replace(/\+/g, ' '))) || 'O link usado é inválido ou expirou. Solicite um novo abaixo.';
  try {
    sessionStorage.setItem(AUTH_ERROR_KEY, message);
  } catch {
    // sessionStorage indisponível (modo privado restrito etc) — segue sem a
    // mensagem específica, ainda assim a rota fica corrigida.
  }

  // Limpa a query string (senão ela fica pra sempre na barra de endereço) e
  // manda pra tela onde a mensagem faz sentido — recovery expirado pede pra
  // solicitar um novo link.
  window.history.replaceState(null, '', window.location.pathname);
  window.location.hash = '#/admin/esqueci-senha';
}

export function consumeAuthErrorMessage() {
  try {
    const message = sessionStorage.getItem(AUTH_ERROR_KEY);
    if (message) sessionStorage.removeItem(AUTH_ERROR_KEY);
    return message;
  } catch {
    return null;
  }
}
