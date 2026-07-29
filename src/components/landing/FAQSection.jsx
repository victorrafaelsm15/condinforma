import { Accordion } from '@mantine/core';
import { faqItems } from '../../data/landingContent';
import Reveal from './Reveal';

export default function FAQSection() {
  return (
    <section id="faq" className="section-pad" style={{ background: 'transparent' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="eyebrow" style={{ justifyContent: 'center', width: '100%' }}>Perguntas frequentes</span>
            <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, margin: '12px 0 0', color: 'var(--on-navy-text)' }}>
              Dúvidas frequentes antes de assinar
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <Accordion
            variant="separated"
            radius="lg"
            styles={{
              item: { border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' },
              control: { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: 800, fontSize: 15, padding: '18px 20px', color: 'var(--text)', letterSpacing: '-0.01em' },
              panel: { fontSize: 14, color: 'var(--text-muted)' },
              content: { paddingBottom: 18 },
            }}
          >
            {faqItems.map((item, i) => (
              <Accordion.Item key={item.q} value={`item-${i}`}>
                <Accordion.Control>{item.q}</Accordion.Control>
                <Accordion.Panel>{item.a}</Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
