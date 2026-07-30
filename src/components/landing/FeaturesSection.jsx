import { ClipboardCheck, Camera, Eye, AlertTriangle, BarChart3, Wrench } from 'lucide-react';
import { features, useCases } from '../../data/landingContent';
import Reveal from './Reveal';

const ICONS = [ClipboardCheck, Camera, Eye, AlertTriangle, BarChart3, Wrench];
const TINTS = ['var(--blue-light)', 'var(--green-light)', 'var(--blue-light)', 'var(--amber-light)', 'var(--blue-light)', 'var(--green-light)'];
const ICON_COLORS = ['var(--blue)', 'var(--green)', 'var(--blue)', 'var(--amber)', 'var(--blue)', 'var(--green)'];

export default function FeaturesSection() {
  return (
    <>
      <section className="section-pad" style={{ background: 'transparent' }}>
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 640, margin: '0 auto 48px', textAlign: 'center' }}>
              <span className="eyebrow" style={{ justifyContent: 'center', width: '100%' }}>Diferenciais</span>
              <h2 style={{ fontSize: 'clamp(26px,3.2vw,36px)', fontWeight: 800, margin: '12px 0 0', color: 'var(--on-navy-text)' }}>
                Mais controle e transparência em cada ambiente
              </h2>
            </div>
          </Reveal>
          <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
            {features.map((f, i) => {
              const Icon = ICONS[i];
              return (
                <Reveal key={f.title} delay={i * 0.06}>
                  <div className="surface-card surface-card--hover" style={{ padding: 24, height: '100%' }}>
                    <span className="icon-tile" style={{ background: TINTS[i], marginBottom: 14 }}>
                      <Icon size={22} color={ICON_COLORS[i]} />
                    </span>
                    <p className="font-display" style={{ fontWeight: 800, fontSize: 16, margin: '0 0 7px', color: 'var(--text)', letterSpacing: '-0.01em' }}>{f.title}</p>
                    <p style={{ fontSize: 14.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{f.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-pad" style={{ background: 'transparent' }}>
        <div className="container">
          <Reveal>
            <div style={{ maxWidth: 640, margin: '0 auto 48px', textAlign: 'center' }}>
              <span className="eyebrow" style={{ justifyContent: 'center', width: '100%' }}>Casos de uso</span>
              <h2 style={{ fontSize: 'clamp(26px,3.2vw,36px)', fontWeight: 800, margin: '12px 0 0', color: 'var(--on-navy-text)' }}>
                Feito para as rotinas reais do condomínio
              </h2>
            </div>
          </Reveal>
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 18 }}>
            {useCases.map((u, i) => (
              <Reveal key={u.title} delay={i * 0.06}>
                <div className="surface-card surface-card--hover" style={{ padding: 22, height: '100%' }}>
                  <p className="font-display" style={{ fontWeight: 800, fontSize: 16, margin: '0 0 7px', color: 'var(--text)', letterSpacing: '-0.01em' }}>{u.title}</p>
                  <p style={{ fontSize: 14.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{u.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <style>{`
        @media (max-width: 900px) {
          .responsive-grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
        @media (max-width: 600px) {
          .responsive-grid-3, .responsive-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
