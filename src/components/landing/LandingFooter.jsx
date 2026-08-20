import { Button } from '@mantine/core';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import { scrollToSection } from '../../lib/scrollToSection';

export default function LandingFooter() {
  return (
    <>
      <section style={{ padding: '80px 0', background: 'var(--gradient-dark)', color: '#fff', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="blob" style={{ width: 440, height: 440, top: -180, left: '20%', background: 'radial-gradient(circle, rgba(51,85,232,0.45), transparent 70%)' }} />
        <div className="blob" style={{ width: 380, height: 380, bottom: -160, right: '15%', background: 'radial-gradient(circle, rgba(124,108,246,0.4), transparent 70%)' }} />
        <div className="container" style={{ position: 'relative' }}>
          <Reveal>
            <h2 style={{ fontSize: 'clamp(26px,3.2vw,38px)', fontWeight: 800, margin: '0 0 14px' }}>
              Comece hoje a organizar a limpeza e a manutenção com QR Code
            </h2>
            <p style={{ opacity: 0.78, fontSize: 16.5, marginBottom: 28, maxWidth: 500, margin: '0 auto 28px' }}>
              Basta imprimir os QR Codes dos ambientes e começar.
            </p>
            <Button component="a" href="#planos" onClick={scrollToSection('planos')} size="lg" color="green" rightSection={<ArrowRight size={17} />}
              className="btn-glow" style={{ boxShadow: '0 16px 40px rgba(18,183,106,0.35)' }}>
              Assinar agora
            </Button>
          </Reveal>
        </div>
      </section>

      <footer style={{ background: '#080b22', color: 'rgba(255,255,255,0.6)', padding: '40px 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>
            <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 26, width: 'auto' }} />
            Cond Informa
          </div>
          <span style={{ fontSize: 12.5 }}>© {new Date().getFullYear()} <span style={{ textTransform: 'uppercase' }}>Cond Informa</span>. Todos os direitos reservados.</span>
        </div>
      </footer>
    </>
  );
}
