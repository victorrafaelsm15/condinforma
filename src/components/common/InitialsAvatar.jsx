// Avatar circular com iniciais, cor derivada do nome/e-mail (hash simples
// numa paleta fixa) — pra sempre mostrar a mesma cor pra mesma pessoa sem
// precisar guardar isso em lugar nenhum.
const PALETTE = ['#3355e8', '#12b76a', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '?';
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return '?';
  if (trimmed.includes('@')) return trimmed[0].toUpperCase();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(nameOrEmail) {
  if (!nameOrEmail) return '#9ca3af';
  let hash = 0;
  for (let i = 0; i < nameOrEmail.length; i += 1) hash = nameOrEmail.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function InitialsAvatar({ name, size = 32, fontSize }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: colorFor(name), color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontSize: fontSize || Math.round(size * 0.4), fontWeight: 700, lineHeight: 1,
    }}>
      {getInitials(name)}
    </span>
  );
}
