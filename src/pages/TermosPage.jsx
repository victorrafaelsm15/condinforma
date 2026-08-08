import { Link } from 'react-router-dom';
import { Text, Button } from '@mantine/core';
import { ArrowLeft } from 'lucide-react';

export default function TermosPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Button component={Link} to="/" variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />} mb="lg">
          Voltar
        </Button>
        <Text fw={800} size="1.8rem" className="font-display" mb="md">Termos de Uso</Text>
        <Text c="dimmed" size="sm" mb="xl">Última atualização: {new Date().toLocaleDateString('pt-BR')}</Text>
        <Text mb="md">
          Estes Termos de Uso regem o acesso e uso da plataforma Cond-Informa. Ao criar uma conta
          e assinar um dos planos, você concorda com as condições descritas aqui.
        </Text>
        <Text mb="md">
          Esta página é um placeholder e será substituída pelo texto definitivo dos Termos de Uso
          em breve. Em caso de dúvidas sobre o uso da plataforma, entre em contato pelo suporte
          dentro do painel.
        </Text>
      </div>
    </div>
  );
}
