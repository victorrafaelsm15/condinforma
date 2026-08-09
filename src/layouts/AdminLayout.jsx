import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, ActionIcon, Menu } from '@mantine/core';
import { Settings, Building2, AlertTriangle, BarChart3, Users, Menu as MenuIcon } from 'lucide-react';
import { signOut, getSession } from '../lib/authService';
import { accountsStore } from '../lib/stores';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import ConfiguracoesDrawer from '../components/admin/ConfiguracoesDrawer';
import PushPermissionBanner from '../components/admin/PushPermissionBanner';

const BASE_NAV_ITEMS = [
  { to: '/admin', label: 'Condomínios', icon: Building2, color: 'brand', match: (p) => p === '/admin' || p.startsWith('/admin/condominios') },
  { to: '/admin/ocorrencias', label: 'Ocorrências', icon: AlertTriangle, color: 'red', match: (p) => p.startsWith('/admin/ocorrencias') },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3, color: 'yellow', match: (p) => p.startsWith('/admin/relatorios') },
];

const OWNER_NAV_ITEM = {
  to: '/admin/usuarios', label: 'Usuários', icon: Users, color: 'violet', match: (p) => p.startsWith('/admin/usuarios'),
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOwner, setIsOwner] = useState(false);
  const [isSubUsuario, setIsSubUsuario] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Estado retraído/expandido da sidebar de desktop, lembrado entre
  // visitas. Ao passar o mouse por cima retraída, expande temporariamente
  // (sidebarHovered) sem mexer na preferência manual (sidebarExpanded).
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('admin-sidebar-expanded');
    return saved === null ? true : saved === 'true';
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const showSidebarLabels = sidebarExpanded || sidebarHovered;

  const toggleSidebar = () => {
    setSidebarExpanded((prev) => {
      localStorage.setItem('admin-sidebar-expanded', String(!prev));
      return !prev;
    });
  };

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) return;
      const subInfo = await getSubUsuarioInfo(session.user.id);
      setIsSubUsuario(!!subInfo);
      if (!subInfo) {
        const account = await accountsStore.getById(session.user.id);
        setIsOwner(account?.role === 'owner');
      }
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
          <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 30, width: 'auto' }} />
          Cond-Informa
        </Link>

        <Button variant="filled" color="gray" leftSection={<Settings size={14} />} onClick={() => setSettingsOpen(true)} className="admin-settings-btn">
          Configurações
        </Button>

        <div className="admin-nav-mobile">
          <Menu shadow="md" width={220} position="bottom-end" withinPortal opened={mobileMenuOpen} onChange={setMobileMenuOpen}>
            <Menu.Target>
              <ActionIcon variant="light" color="gray" size="lg" radius="xl" aria-label="Abrir menu">
                <MenuIcon size={19} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {/* Botões de verdade (não Menu.Item) pra herdar exatamente as
                  mesmas cores de fundo preenchidas usadas na sidebar de
                  desktop — a prop color do Menu.Item só tinge o texto, não
                  preenche o fundo. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
                {navItems.map((item) => (
                  <Button
                    key={item.to}
                    component={Link}
                    to={item.to}
                    variant="filled"
                    color={item.color}
                    fullWidth
                    justify="flex-start"
                    leftSection={<item.icon size={15} />}
                    onClick={() => setMobileMenuOpen(false)}
                    style={isActive(item) ? { boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.55)' } : undefined}
                  >
                    {item.label}
                  </Button>
                ))}
                <Button
                  variant="filled"
                  color="gray"
                  fullWidth
                  justify="flex-start"
                  leftSection={<Settings size={15} />}
                  onClick={() => { setMobileMenuOpen(false); setSettingsOpen(true); }}
                >
                  Configurações
                </Button>
              </div>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      <PushPermissionBanner />

      <div className="admin-body">
        {/* O "slot" reserva o espaço fixo (collapsed ou expanded, só via
            clique) no layout flex. A sidebar em si é sticky e pode ficar
            visualmente mais larga que o slot no hover (sem overflow:hidden
            no pai), sobrepondo o conteúdo em vez de empurrá-lo, o que evita
            o conteúdo "pulando" toda hora que o mouse passa por cima. */}
        <div className="admin-sidebar-slot" style={{ width: sidebarExpanded ? 224 : 68 }}>
          <aside
            className={`admin-sidebar${showSidebarLabels ? '' : ' admin-sidebar--collapsed'}`}
            onMouseEnter={() => !sidebarExpanded && setSidebarHovered(true)}
            onMouseLeave={() => setSidebarHovered(false)}
          >
          <ActionIcon
            variant="light"
            color="gray"
            radius="xl"
            size="lg"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? 'Recolher menu' : 'Expandir menu'}
            className="admin-sidebar-toggle"
            style={{ alignSelf: showSidebarLabels ? 'flex-end' : 'center' }}
          >
            <MenuIcon size={17} />
          </ActionIcon>
          {navItems.map((item) => (
            <Button
              key={item.to}
              component={Link}
              to={item.to}
              variant="filled"
              color={item.color}
              fullWidth
              justify={showSidebarLabels ? 'flex-start' : 'center'}
              size="md"
              px={showSidebarLabels ? undefined : 0}
              leftSection={showSidebarLabels ? <item.icon size={17} /> : undefined}
              title={showSidebarLabels ? undefined : item.label}
              style={isActive(item) ? { boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.55)' } : undefined}
            >
              {showSidebarLabels ? item.label : <item.icon size={18} />}
            </Button>
          ))}
          </aside>
        </div>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>

      <ConfiguracoesDrawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
        isSubUsuario={isSubUsuario}
      />

      <style>{`
        .admin-nav-mobile { display: none; }
        .admin-body { display: flex; align-items: flex-start; }
        .admin-sidebar-slot { flex-shrink: 0; transition: width 0.16s var(--ease); }
        .admin-sidebar {
          display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
          width: 224px; padding: 16px 14px; position: sticky; top: 65px;
          height: calc(100vh - 65px); overflow-x: hidden; overflow-y: auto;
          border-right: 1px solid var(--border);
          transition: width 0.16s var(--ease);
          z-index: 40;
          background: var(--bg);
        }
        .admin-sidebar--collapsed { width: 68px; }
        .admin-sidebar-toggle { flex-shrink: 0; margin-bottom: 4px; }
        .admin-main { flex: 1; min-width: 0; padding: 32px 28px 60px; max-width: 1100px; }
        @media (max-width: 900px) {
          .admin-header { padding-left: 18px; padding-right: 18px; }
          .admin-sidebar { display: none; }
          .admin-nav-mobile { display: flex; }
          .admin-settings-btn { display: none; }
        }
      `}</style>
    </div>
  );
}
