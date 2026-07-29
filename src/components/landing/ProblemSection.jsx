import { AlertCircle } from 'lucide-react';
import { problems } from '../../data/landingContent';
import Reveal from './Reveal';

export default function ProblemSection() {
  return (
    <section className="section-pad" style={{ background: 'transparent' }}>
      <div className="container">
        <Reveal>
          <div style={{ maxWidth: 640, margin: '0 auto 48px', textAlign: 'center' }}>
            <span className="eyebrow" style={{ justifyContent: 'center', width: '100%' }}>O problema</span>
            <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, margin: '12px 0 12px', color: 'var(--on-navy-text)' }}>
              Você sabe se todas as tarefas foram realmente feitas?
            </h2>
            <p style={{ color: 'var(--on-navy-muted)', fontSize: 15.5, lineHeight: 1.6 }}>
              Sem um processo claro, tarefas podem ser esquecidas, a fiscalização depende de
              presença física, e fica difícil comprovar o que realmente foi executado.
            </p>
          </div>
        </Reveal>
        <div className="problems-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 18 }}>
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="surface-card surface-card--hover" style={{ display: 'flex', gap: 16, padding: 22, height: '100%' }}>
                <span className="icon-tile" style={{ background: 'var(--amber-light)' }}>
                  <AlertCircle size={20} color="var(--amber)" />
                </span>
                <div>
                  <p className="font-display" style={{ fontWeight: 800, fontSize: 15, margin: '0 0 6px', color: 'var(--text)', letterSpacing: '-0.01em' }}>{p.title}</p>
                  <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>{p.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .problems-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
