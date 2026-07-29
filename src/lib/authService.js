// Login simples do painel do gestor/síndico.
// Pode ser sobrescrito por variáveis de ambiente no build (VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD).

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@condinforma.com';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'condinforma2026';

const SESSION_KEY = 'condinforma_admin_session';

export function login(email, password) {
  const ok = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
  if (ok) sessionStorage.setItem(SESSION_KEY, '1');
  return ok;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}
