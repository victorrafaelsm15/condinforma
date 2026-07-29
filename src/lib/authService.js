// Login simples do painel do gestor/síndico.
// Pode ser sobrescrito por variáveis de ambiente no build (VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD).

// .trim() nas duas pontas: variáveis de ambiente coladas em formulários (ex.:
// Secrets do GitHub Actions) frequentemente carregam um "\n" ou espaço extra
// no final, o que quebraria a comparação exata sem isso.
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@condinforma.com').trim();
const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'condinforma2026').trim();

const SESSION_KEY = 'condinforma_admin_session';

export function login(email, password) {
  const ok = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password.trim() === ADMIN_PASSWORD;
  if (ok) sessionStorage.setItem(SESSION_KEY, '1');
  return ok;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}
