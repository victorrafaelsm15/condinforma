import { steps } from '../../data/landingContent';
import Reveal from './Reveal';

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="section-pad" style={{ background: 'transparent', position: 'relative', overflow: 'hidden' }}>
      <div className="container" style={{ position: 'relative' }}>
        <Reveal>
          <div style={{ maxWidth: 640, margin: '0 auto 48px', textAlign: 'center' }}>
            <span className="eyebrow" style={{ justifyContent: 'center', width: '100%' }}>Como funciona</span>
            <h2 style={{ fontSize: 'clamp(26px,3.2vw,36px)', fontWeight: 800, margin: '12px 0 0', color: 'var(--on-navy-text)' }}>
              Em poucos passos, transforme ambientes físicos em pontos de controle digital
            </h2>
          </div>
        </Reveal>
        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 18, position: 'relative' }}>
          <div className="steps-connector" style={{
            position: 'absolute', top: 22, left: '12.5%', right: '12.5%', height: 2,
            background: 'repeating-linear-gradient(to right, var(--on-navy-border-strong) 0 8px, transparent 8px 16px)',
            zIndex: 0,
          }} />
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} style={{ position: 'relative', zIndex: 1 }}>
              <div className="surface-card surface-card--hover" style={{ padding: 24, height: '100%' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, background: 'var(--gradient-brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginBottom: 16,
                  boxShadow: 'var(--shadow-brand)',
                }}>
                  {i + 1}
                </div>
                <p className="font-display" style={{ fontWeight: 800, fontSize: 16, margin: '0 0 7px', color: 'var(--text)', letterSpacing: '-0.01em' }}>{s.title}</p>
                <p style={{ fontSize: 14.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .steps-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .steps-connector { display: none; }
        }
        @media (max-width: 520px) {
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
