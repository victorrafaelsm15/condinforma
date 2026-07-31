import { ListX, HelpCircle, Footprints, MessageSquareWarning } from 'lucide-react';
import { problems } from '../../data/landingContent';
import Reveal from './Reveal';

const ICONS = [ListX, HelpCircle, Footprints, MessageSquareWarning];
const TINTS = ['var(--amber-light)', 'var(--blue-light)', 'var(--blue-light)', 'var(--red-light)'];
const ICON_COLORS = ['var(--amber)', 'var(--blue)', 'var(--blue)', 'var(--red)'];

export default function ProblemSection() {
  return (
    <section className="section-pad" style={{ background: 'transparent' }}>
      <div className="container">
        <Reveal>
          <div style={{ maxWidth: 640, margin: '0 auto 48px', textAlign: 'center' }}>
            <span className="eyebrow" style={{ justifyContent: 'center', width: '100%' }}>O problema</span>
            <h2 style={{ fontSize: 'clamp(26px,3.2vw,36px)', fontWeight: 800, margin: '12px 0 12px', color: 'var(--on-navy-text)' }}>
              Você sabe se todas as tarefas foram realmente feitas?
            </h2>
            <p style={{ color: 'var(--on-navy-muted)', fontSize: 16.5, lineHeight: 1.65 }}>
              Sem um processo claro, tarefas podem ser esquecidas, a fiscalização depende de
              presença física, e fica difícil comprovar o que realmente foi executado.
            </p>
          </div>
        </Reveal>
        <div className="problems-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 18 }}>
          {problems.map((p, i) => {
            const Icon = ICONS[i];
            return (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="surface-card surface-card--hover" style={{ display: 'flex', gap: 16, padding: 22, height: '100%' }}>
                <span className="icon-tile" style={{ background: TINTS[i] }}>
                  <Icon size={20} color={ICON_COLORS[i]} />
                </span>
                <div>
                  <p className="font-display" style={{ fontWeight: 800, fontSize: 16, margin: '0 0 7px', color: 'var(--text)', letterSpacing: '-0.01em' }}>{p.title}</p>
                  <p style={{ fontSize: 14.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{p.text}</p>
                </div>
              </div>
            </Reveal>
            );
          })}
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
