import { Link } from 'react-router-dom';
import { Text, Button } from '@mantine/core';
import { ArrowLeft } from 'lucide-react';
import Seo from '../components/common/Seo';

export default function PrivacidadePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px' }}>
      <Seo
        title="Política de Privacidade — Cond Informa"
        description="Como o Cond Informa coleta, usa e protege os dados pessoais de clientes, colaboradores e moradores que utilizam a plataforma."
        path="/privacidade"
      />
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Button component={Link} to="/" variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />} mb="lg">
          Voltar
        </Button>
        <Text fw={800} size="1.8rem" className="font-display" mb="md">Política de Privacidade</Text>
        <Text c="dimmed" size="sm" mb="xl">Última atualização: {new Date().toLocaleDateString('pt-BR')}</Text>
        <Text mb="md">
          Esta Política de Privacidade descreve como o Cond Informa coleta, usa e protege os dados
          pessoais de clientes, colaboradores e moradores que utilizam a plataforma.
        </Text>
        <Text mb="md">
          Esta página é um placeholder e será substituída pelo texto definitivo da Política de
          Privacidade em breve. Em caso de dúvidas sobre o tratamento dos seus dados, entre em
          contato pelo suporte dentro do painel.
        </Text>
      </div>
    </div>
  );
}
