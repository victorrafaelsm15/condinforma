import { Button } from '@mantine/core';
import { Check } from 'lucide-react';
import { plans } from '../../data/landingContent';
import Reveal from './Reveal';

export default function PricingSection() {
  return (
    <section id="planos" className="section-pad" style={{ background: 'transparent', position: 'relative', overflow: 'hidden' }}>
      <div className="blob" style={{ width: 560, height: 560, top: '10%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(51,85,232,0.22), transparent 70%)' }} />
      <div className="container" style={{ position: 'relative' }}>
        <Reveal>
          <div style={{ maxWidth: 640, margin: '0 auto 48px', textAlign: 'center' }}>
            <span className="eyebrow" style={{ justifyContent: 'center', width: '100%' }}>Planos e assinaturas</span>
            <h2 style={{ fontSize: 'clamp(26px,3.2vw,36px)', fontWeight: 800, margin: '12px 0 10px', color: 'var(--on-navy-text)' }}>
              Escolha o plano ideal para a sua operação
            </h2>
            <p style={{ color: 'var(--on-navy-muted)', fontSize: 16 }}>
              Planos mensais para síndicos, administradoras e condomínios que querem controlar
              rotinas de limpeza, zeladoria e vistorias com QR Code.
            </p>
          </div>
        </Reveal>

        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 22 }}>
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.08}>
              <div
                className={plan.highlight ? '' : 'surface-card surface-card--hover'}
                style={{
                  background: plan.highlight ? 'var(--gradient-dark)' : '#fff',
                  color: plan.highlight ? '#fff' : 'var(--text)',
                  border: plan.highlight ? '1px solid rgba(147,133,255,0.4)' : undefined,
                  borderRadius: 'var(--radius-lg)',
                  padding: 30,
                  position: 'relative',
                  height: '100%',
                  boxShadow: plan.highlight ? '0 0 0 1px rgba(255,255,255,0.06), 0 30px 70px rgba(0,0,0,0.55), 0 0 70px rgba(124,108,246,0.28)' : undefined,
                  transform: plan.highlight ? 'scale(1.04)' : undefined,
                  overflow: 'hidden',
                }}
              >
                {plan.highlight && (
                  <div className="blob" style={{ width: 260, height: 260, top: -100, right: -80, background: 'radial-gradient(circle, rgba(124,108,246,0.5), transparent 70%)' }} />
                )}
                {plan.highlight && (
                  <span style={{
                    position: 'absolute', top: 20, right: 20,
                    background: 'var(--green)', color: '#fff', fontSize: 11, fontWeight: 700,
                    padding: '5px 12px', borderRadius: 100, zIndex: 1,
                  }}>
                    Mais recomendado
                  </span>
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <p className="font-display" style={{ fontWeight: 800, fontSize: 20, margin: '4px 0 4px', letterSpacing: '-0.01em' }}>{plan.name}</p>
                  <p style={{ fontSize: 12.5, opacity: 0.75, margin: '0 0 20px' }}>{plan.tagline}</p>
                  <p className="font-display" style={{ fontSize: 34, fontWeight: 800, margin: '0 0 22px', letterSpacing: '-0.02em' }}>
                    R$ {plan.price}<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.7 }}>/mês</span>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 26 }}>
                    {plan.features.map((f) => (
                      <div key={f} style={{ display: 'flex', gap: 8, fontSize: 14.5, alignItems: 'flex-start' }}>
                        <span style={{
                          flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: '50%',
                          background: plan.highlight ? 'rgba(18,183,106,0.25)' : 'var(--green-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={11} color={plan.highlight ? '#5eead4' : 'var(--green)'} strokeWidth={3} />
                        </span>
                        {f}
                      </div>
                    ))}
                  </div>
                  <Button
                    fullWidth
                    size="md"
                    className={plan.highlight ? 'btn-glow' : ''}
                    variant={plan.highlight ? 'white' : 'filled'}
                    color={plan.highlight ? 'dark' : 'brand'}
                    style={plan.highlight ? { boxShadow: '0 10px 30px rgba(0,0,0,0.25)' } : { boxShadow: 'var(--shadow-brand)' }}
                  >
                    Assinar {plan.name}
                  </Button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <p style={{ fontSize: 14, color: 'var(--on-navy-muted)' }}>
              Operações acima de 10 condomínios: <strong style={{ color: 'var(--on-navy-text)' }}>Enterprise</strong>, sob consulta, com condições personalizadas.
            </p>
            <Button variant="white" mt="xs">Falar com especialista</Button>
          </div>
        </Reveal>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .pricing-grid { grid-template-columns: 1fr !important; max-width: 420px; margin: 0 auto; }
        }
      `}</style>
    </section>
  );
}
