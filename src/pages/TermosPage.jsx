import { Link } from 'react-router-dom';
import { Text, Button } from '@mantine/core';
import { ArrowLeft } from 'lucide-react';
import { termosSections } from '../data/landingContent';
import Seo from '../components/common/Seo';

export default function TermosPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px' }}>
      <Seo
        title="Termos de Uso — Cond-Informa"
        description="Termos de Uso e Condições Gerais de Contratação da plataforma Cond-Informa."
        path="/termos"
      />
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Button component={Link} to="/" variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />} mb="lg">
          Voltar
        </Button>
        <Text fw={800} size="1.8rem" className="font-display" mb={4}>Termos de Uso e Condições Gerais de Contratação</Text>
        <Text c="dimmed" size="sm" mb="xl">Cond-Informa</Text>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {termosSections.map((section) => (
            <section key={section.number}>
              <Text fw={800} size="md" className="font-display" mb={10} style={{ color: 'var(--text)' }}>
                {section.number}. {section.title}
              </Text>
              {section.paragraphs?.map((p, i) => (
                <Text key={i} size="sm" c="var(--text-muted)" mb={10} style={{ lineHeight: 1.7 }}>
                  {p}
                </Text>
              ))}
              {section.list && (
                <ul style={{ margin: '0 0 10px', paddingLeft: 22 }}>
                  {section.list.map((item, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      <Text size="sm" c="var(--text-muted)" style={{ lineHeight: 1.7 }}>{item}</Text>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
