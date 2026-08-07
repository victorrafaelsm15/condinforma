import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ActionIcon } from '@mantine/core';
import { ShieldCheck } from 'lucide-react';
import { scrollToSection } from '../../lib/scrollToSection';
import InstallAppButton from '../common/InstallAppButton';

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: scrolled ? 'rgba(10,14,39,0.78)' : 'rgba(10,14,39,0.28)',
        backdropFilter: 'blur(14px) saturate(180%)',
        borderBottom: scrolled ? '1px solid var(--on-navy-border)' : '1px solid transparent',
        boxShadow: scrolled ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
        transition: 'all 0.3s var(--ease)',
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 18, color: '#fff', textTransform: 'uppercase' }}>
          <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 34, width: 'auto' }} />
          Cond-Informa
        </Link>
        <nav style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="#como-funciona" onClick={scrollToSection('como-funciona')} className="nav-link">Como funciona</a>
          <a href="#planos" onClick={scrollToSection('planos')} className="nav-link">Planos</a>
          <a href="#faq" onClick={scrollToSection('faq')} className="nav-link">Dúvidas</a>
          <InstallAppButton
            label="Instalar app"
            variant="subtle"
            size="sm"
            className="header-install-btn"
            styles={{ root: { color: '#fff' } }}
          />
          <Button component={Link} to="/admin/login" variant="subtle" size="sm" ml={6} className="header-manager-btn header-manager-btn--full" styles={{ root: { color: '#fff' } }}>Painel do gestor</Button>
          <ActionIcon
            component={Link}
            to="/admin/login"
            variant="subtle"
            size="lg"
            radius="xl"
            className="header-manager-btn--icon"
            style={{ color: '#fff' }}
            aria-label="Painel do gestor"
          >
            <ShieldCheck size={19} />
          </ActionIcon>
          <Button component="a" href="#planos" onClick={scrollToSection('planos')} size="sm" className="btn-glow header-cta-btn">Assinar agora</Button>
        </nav>
      </div>
      <style>{`
        .nav-link {
          font-size: 14px; font-weight: 600; color: var(--on-navy-muted);
          padding: 8px 12px; border-radius: 8px; transition: all 0.2s var(--ease);
        }
        .nav-link:hover { color: #fff; background: var(--on-navy-chip-bg); }
        .header-manager-btn--icon { display: none; }
        @media (max-width: 860px) {
          .nav-link { display: none; }
        }
        @media (max-width: 480px) {
          .header-manager-btn--full { display: none; }
          .header-manager-btn--icon { display: inline-flex; }
          .header-cta-btn { padding-left: 12px; padding-right: 12px; font-size: 13px; }
          .header-install-btn { padding-left: 10px; padding-right: 10px; }
          .header-install-btn .install-btn-label { display: none; }
        }
      `}</style>
    </header>
  );
}
