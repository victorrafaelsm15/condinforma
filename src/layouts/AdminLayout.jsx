import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, ActionIcon, Menu } from '@mantine/core';
import { LogOut, Building2, AlertTriangle, BarChart3, Users, Menu as MenuIcon } from 'lucide-react';
import { signOut, getSession } from '../lib/authService';
import { accountsStore } from '../lib/stores';

const BASE_NAV_ITEMS = [
  { to: '/admin', label: 'Condomínios', icon: Building2, color: 'brand', match: (p) => p === '/admin' || p.startsWith('/admin/condominios') },
  { to: '/admin/ocorrencias', label: 'Ocorrências', icon: AlertTriangle, color: 'red', match: (p) => p.startsWith('/admin/ocorrencias') },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3, color: 'yellow', match: (p) => p.startsWith('/admin/relatorios') },
];

const OWNER_NAV_ITEM = {
  to: '/admin/assinantes', label: 'Assinantes', icon: Users, color: 'violet', match: (p) => p.startsWith('/admin/assinantes'),
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) return;
      const account = await accountsStore.getById(session.user.id);
      setIsOwner(account?.role === 'owner');
    })();
  }, []);

  const navItems = isOwner ? [...BASE_NAV_ITEMS, OWNER_NAV_ITEM] : BASE_NAV_ITEMS;

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const isActive = (item) => item.match(location.pathname);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50,
      }} className="admin-header">
        <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16.5, color: 'var(--blue-dark)', textTransform: 'uppercase' }}>
          <span style={{
            width: 32, height: 32, borderRadius: 9, background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Building2 size={17} color="#fff" />
          </span>
          Cond-Informa
        </Link>

        <nav className="admin-nav-full">
          {navItems.map((item) => (
            <Button
              key={item.to}
              component={Link}
              to={item.to}
              variant="filled"
              color={item.color}
              leftSection={<item.icon size={15} />}
              style={isActive(item) ? { boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.55)' } : undefined}
            >
              {item.label}
            </Button>
          ))}
          <Button variant="filled" color="gray" leftSection={<LogOut size={14} />} onClick={handleLogout} ml={8}>
            Sair
          </Button>
        </nav>

        <div className="admin-nav-mobile">
          <Menu shadow="md" width={210} position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="light" color="gray" size="lg" radius="xl" aria-label="Abrir menu">
                <MenuIcon size={19} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {navItems.map((item) => (
                <Menu.Item
                  key={item.to}
                  component={Link}
                  to={item.to}
                  leftSection={<item.icon size={16} />}
                  color={isActive(item) ? 'blue' : undefined}
                  fw={isActive(item) ? 700 : 500}
                >
                  {item.label}
                </Menu.Item>
              ))}
              <Menu.Divider />
              <Menu.Item leftSection={<LogOut size={16} />} color="red" onClick={handleLogout}>
                Sair
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>
      <main style={{ padding: '32px 28px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <Outlet />
      </main>
      <style>{`
        .admin-nav-full { display: flex; gap: 8px; align-items: center; }
        .admin-nav-mobile { display: none; }
        @media (max-width: 900px) {
          .admin-header { padding-left: 18px; padding-right: 18px; }
          .admin-nav-full { display: none; }
          .admin-nav-mobile { display: flex; }
        }
      `}</style>
    </div>
  );
}
