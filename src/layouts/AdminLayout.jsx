import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, ActionIcon, Menu, Text, Group, Loader } from '@mantine/core';
import {
  Settings, Building2, AlertTriangle, BarChart3, Users, Menu as MenuIcon, QrCode, UserPlus, History, Lock, LogOut,
  Wallet,
} from 'lucide-react';
import { signOut, getSession } from '../lib/authService';
import { accountsStore } from '../lib/stores';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import ConfiguracoesDrawer from '../components/admin/ConfiguracoesDrawer';
import PushPermissionBanner from '../components/admin/PushPermissionBanner';
import Seo from '../components/common/Seo';

// Nenhum item da sidebar tem cor própria (de propósito — substitui
// qualquer pedido antigo de cor individual por item): ícone e texto
// sempre usam var(--text), só o item ativo ganha um fundo neutro
// (var(--bg-soft)) pra indicar estado, sem tingir nada.
const BASE_NAV_ITEMS = [
  { to: '/admin', label: 'Condomínios', icon: Building2, match: (p) => p === '/admin' || p.startsWith('/admin/condominios') },
  { to: '/admin/qrcodes', label: 'QR Codes', icon: QrCode, match: (p) => p.startsWith('/admin/qrcodes') || /^\/admin\/condominios\/[^/]+\/qrcodes/.test(p) },
  { to: '/admin/ocorrencias', label: 'Ocorrências', icon: AlertTriangle, match: (p) => p.startsWith('/admin/ocorrencias') },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3, match: (p) => p.startsWith('/admin/relatorios') },
];

// Sub-usuário nunca gerencia outros sub-usuários nem vê a auditoria da
// conta principal — mesmo critério que já existia dentro do Drawer de
// Configurações, só que agora como itens de sidebar em vez de seções.
const PRINCIPAL_NAV_ITEMS = [
  { to: '/admin/financeiro', label: 'Financeiro', icon: Wallet, match: (p) => p.startsWith('/admin/financeiro') },
  { to: '/admin/sub-usuarios', label: 'Sub-usuários', icon: UserPlus, match: (p) => p.startsWith('/admin/sub-usuarios') },
  { to: '/admin/auditoria', label: 'Auditoria', icon: History, match: (p) => p.startsWith('/admin/auditoria') },
];

const OWNER_NAV_ITEM = {
  to: '/admin/usuarios', label: 'Usuários', icon: Users, match: (p) => p.startsWith('/admin/usuarios'),
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOwner, setIsOwner] = useState(false);
  const [isSubUsuario, setIsSubUsuario] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
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
      if (!session) { setCheckingAccess(false); return; }
      const subInfo = await getSubUsuarioInfo(session.user.id);
      setIsSubUsuario(!!subInfo);
      // O bloqueio depende do status da conta PRINCIPAL, mesmo pra
      // sub-usuário — o acesso dele é inteiramente derivado da assinatura
      // de quem o convidou, então se ela está inativa, ele fica bloqueado
      // igual, sem ter conta própria pra verificar.
      const relevantAccountId = subInfo ? subInfo.account_id : session.user.id;
      const account = await accountsStore.getById(relevantAccountId);
      if (!subInfo) setIsOwner(account?.role === 'owner');
      setBlocked(account?.role !== 'owner' && !account?.bypass_limits && account?.status === 'inativo');
      setCheckingAccess(false);
    })();
  }, []);

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(!isSubUsuario ? PRINCIPAL_NAV_ITEMS : []),
    ...(isOwner ? [OWNER_NAV_ITEM] : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const isActive = (item) => item.match(location.pathname);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Seo title="Painel — Cond Informa" noindex path={location.pathname} />
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50,
      }} className="admin-header">
        <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16.5, color: 'var(--blue-dark)', textTransform: 'uppercase' }}>
          <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 30, width: 'auto' }} />
          Cond Informa
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`admin-nav-item${isActive(item) ? ' admin-nav-item--active' : ''}`}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                ))}
                <button
                  type="button"
                  className="admin-nav-item"
                  onClick={() => { setMobileMenuOpen(false); setSettingsOpen(true); }}
                >
                  <Settings size={16} />
                  <span>Configurações</span>
                </button>
              </div>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      {!blocked && <PushPermissionBanner />}

      {checkingAccess ? (
        <Group justify="center" py={100}><Loader color="brand" /></Group>
      ) : blocked ? (
        <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 20px' }}>
          <div className="surface-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--amber-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <Lock size={30} color="var(--amber)" />
            </div>
            <Text fw={800} size="lg">Assinatura inativa</Text>
            <Text size="sm" c="dimmed" mt={10}>
              Sua assinatura está inativa (pagamento pendente ou cancelada). O painel administrativo fica bloqueado
              até a regularização, mas a execução de checklists e o registro de ocorrências pelo QR Code continuam
              funcionando normalmente — nada do que já foi feito é perdido.
            </Text>
            <Button
              component={Link}
              to="/?scrollTo=planos"
              mt="xl"
              fullWidth
              className="btn-glow"
              style={{ boxShadow: 'var(--shadow-brand)' }}
            >
              Ver planos e regularizar
            </Button>
            <Button mt="sm" fullWidth variant="subtle" color="gray" leftSection={<LogOut size={15} />} onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>
      ) : (
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
            <Link
              key={item.to}
              to={item.to}
              title={showSidebarLabels ? undefined : item.label}
              className={`admin-nav-item${isActive(item) ? ' admin-nav-item--active' : ''}${showSidebarLabels ? '' : ' admin-nav-item--collapsed'}`}
            >
              <item.icon size={showSidebarLabels ? 17 : 18} />
              {showSidebarLabels && <span>{item.label}</span>}
            </Link>
          ))}
          </aside>
        </div>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
      )}

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
        /* Item de navegação sem cor própria — ícone/texto sempre var(--text),
           só um fundo neutro (var(--bg-soft)) indica hover/ativo. Mesma
           classe serve pros Link da sidebar de desktop e do menu mobile, e
           pro <button> de "Configurações" no mobile (reset de aparência
           nativa de botão pra ficar idêntico aos Links ao lado). */
        .admin-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          color: var(--text); text-decoration: none;
          font-weight: 600; font-size: 14px; font-family: inherit;
          border: none; background: transparent; cursor: pointer;
          width: 100%; text-align: left; flex-shrink: 0;
          transition: background 0.15s var(--ease);
        }
        .admin-nav-item svg { flex-shrink: 0; }
        .admin-nav-item:hover { background: var(--bg-soft); }
        .admin-nav-item--active { background: var(--bg-soft); }
        .admin-nav-item--collapsed { justify-content: center; padding: 10px 0; }
        .admin-main { flex: 1; min-width: 0; padding: 32px 28px 60px; max-width: 1100px; }
        @media (max-width: 900px) {
          .admin-header { padding-left: 18px; padding-right: 18px; }
          .admin-sidebar { display: none; }
          .admin-nav-mobile { display: flex; }
          .admin-settings-btn { display: none; }
          /* .admin-sidebar-slot reserva a largura (224px/68px) via style
             inline controlado por JS (sidebarExpanded), que a media query
             acima não alcança — sem isto, o slot continua ocupando esse
             espaço mesmo com a sidebar escondida, espremendo o <main> numa
             faixa estreita e empurrando o conteúdo pra fora da tela. */
          .admin-sidebar-slot { display: none; }
          .admin-main { padding: 20px 16px 40px; }
        }
      `}</style>
    </div>
  );
}
