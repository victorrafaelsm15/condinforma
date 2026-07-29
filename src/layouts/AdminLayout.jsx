import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@mantine/core';
import { LogOut, Building2, AlertTriangle } from 'lucide-react';
import { logout } from '../lib/authService';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path) => (path === '/admin' ? location.pathname === '/admin' || location.pathname.startsWith('/admin/condominios') : location.pathname.startsWith(path));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16.5, color: 'var(--blue-dark)' }}>
          <span style={{
            width: 32, height: 32, borderRadius: 9, background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={17} color="#fff" />
          </span>
          Cond-Informa
        </Link>
        <nav style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Link to="/admin" className="admin-nav-link" style={{
            color: isActive('/admin') ? 'var(--blue)' : 'var(--text-muted)',
            background: isActive('/admin') ? 'var(--blue-light)' : 'transparent',
          }}>
            Condomínios
          </Link>
          <Link to="/admin/ocorrencias" className="admin-nav-link" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: isActive('/admin/ocorrencias') ? 'var(--blue)' : 'var(--text-muted)',
            background: isActive('/admin/ocorrencias') ? 'var(--blue-light)' : 'transparent',
          }}>
            <AlertTriangle size={15} /> Ocorrências
          </Link>
          <Button variant="subtle" color="gray" size="xs" leftSection={<LogOut size={14} />} onClick={handleLogout} ml={8}>
            Sair
          </Button>
        </nav>
      </header>
      <main style={{ padding: '32px 28px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <Outlet />
      </main>
      <style>{`
        .admin-nav-link {
          font-size: 14px; font-weight: 600; padding: 8px 14px; border-radius: 10px;
          transition: all 0.2s var(--ease);
        }
        .admin-nav-link:hover { color: var(--blue); background: var(--blue-light); }
      `}</style>
    </div>
  );
}
