import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button, TextInput, Text } from '@mantine/core';
import { KeyRound } from 'lucide-react';
import { requestPasswordReset } from '../lib/authService';
import Seo from '../components/common/Seo';

// redirectTo aponta pra dentro do próprio HashRouter — window.location.origin
// + BASE_URL garante que funciona igual em qualquer domínio onde o site
// estiver publicado (Vercel, GitHub Pages, domínio próprio), sem precisar
// hardcodar host nenhum aqui.
function buildRedirectTo() {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/admin/redefinir-senha`;
}

export default function EsqueciSenhaPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  const onSubmit = async ({ email }) => {
    setError('');
    const { error: resetError } = await requestPasswordReset(email, buildRedirectTo());
    // Mensagem de sucesso é sempre a mesma, exista ou não esse e-mail na
    // base — evita que essa tela vire um jeito de descobrir quais e-mails
    // têm conta cadastrada. Só um erro de verdade (fora do ar, e-mail mal
    // formado, rate limit) cai no branch de erro.
    if (resetError) {
      setError('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
      return;
    }
    setSent(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <Seo title="Esqueci minha senha — Cond Informa" description="Redefina a senha de acesso ao painel do Cond Informa." path="/admin/esqueci-senha" />
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="surface-card" style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: 'var(--blue-light)',
            color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}
          >
            <KeyRound size={24} />
          </div>
          <Text fw={800} size="lg">Esqueci minha senha</Text>
          <Text size="sm" c="dimmed" mb="lg">Informe seu e-mail para receber um link de redefinição</Text>

          {sent ? (
            <Text size="sm" mb="lg">
              Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes. Confira também a caixa de spam.
            </Text>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} style={{ textAlign: 'left' }}>
              <TextInput
                label="E-mail"
                placeholder="voce@condinforma.com"
                data-autofocus
                {...register('email', { required: true })}
              />
              {error && <Text c="red" size="sm" mt="sm">{error}</Text>}
              <Button type="submit" fullWidth mt="lg" size="md" loading={isSubmitting} className="btn-glow" style={{ boxShadow: 'var(--shadow-brand)' }}>
                Enviar link de redefinição
              </Button>
            </form>
          )}

          <Text size="sm" c="dimmed" ta="center" mt="md">
            <Link to="/admin/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Voltar para o login</Link>
          </Text>
        </div>
      </div>
    </div>
  );
}
