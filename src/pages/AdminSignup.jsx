import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button, TextInput, PasswordInput, Text } from '@mantine/core';
import { ShieldCheck, QrCode, BarChart3, MailCheck } from 'lucide-react';
import { signUp, signIn } from '../lib/authService';
import { accountsStore } from '../lib/stores';
import Seo from '../components/common/Seo';

function translateAuthError(message) {
  if (message?.includes('User already registered')) return 'Já existe uma conta com esse e-mail. Tente entrar.';
  if (message?.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (message?.includes('Unable to validate email address')) return 'Informe um e-mail válido.';
  return message || 'Não foi possível criar sua conta. Tente novamente.';
}

export default function AdminSignup() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { register, handleSubmit, watch, formState: { isSubmitting, errors } } = useForm();

  const onSubmit = async ({ email, password }) => {
    setError('');
    const { data, error: authError } = await signUp(email, password);
    if (authError) {
      // "Já registrado" pode ser alguém tentando de novo depois de uma
      // assinatura que falhou (conta criada no signUp, mas o pagamento
      // Asaas não completou — ver subscribe/index.ts) — a pessoa fica sem
      // conseguir se cadastrar de novo com o mesmo e-mail. Em vez de só
      // mostrar o erro, tenta entrar com a senha que ela ACABOU de digitar
      // aqui: só reaproveita a conta se a senha bater (nunca assume que
      // "e-mail já existe" seja a mesma pessoa) — se bater e a conta ainda
      // não tiver plano ativo, manda direto pra assinatura em vez de
      // travar num beco sem saída.
      if (authError.message?.includes('User already registered')) {
        const { data: loginData, error: loginError } = await signIn(email, password);
        if (!loginError && loginData.session) {
          const account = await accountsStore.getById(loginData.session.user.id);
          navigate(account && account.status !== 'ativo' ? '/assinar' : '/admin');
          return;
        }
      }
      setError(translateAuthError(authError.message));
      return;
    }
    // Se a confirmação por e-mail estiver ativada no projeto Supabase, o
    // signUp não devolve uma sessão ativa — o cliente precisa confirmar
    // o e-mail antes de conseguir entrar.
    if (data.session) navigate('/admin');
    else setAwaitingConfirmation(true);
  };

  if (awaitingConfirmation) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
        <div className="surface-card" style={{ maxWidth: 400, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'var(--blue-light)', color: 'var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
          }}>
            <MailCheck size={28} />
          </div>
          <Text fw={800} size="lg">Confirme seu e-mail</Text>
          <Text c="dimmed" size="sm" mt={8}>
            Enviamos um link de confirmação. Depois de confirmar, volte e entre com seu e-mail e senha.
          </Text>
          <Button component={Link} to="/admin/login" mt="xl" fullWidth variant="light">Ir para o login</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="login-grid">
      <Seo title="Criar conta — Cond Informa" description="Crie sua conta no Cond Informa e comece a organizar a limpeza e manutenção do seu condomínio com checklists digitais via QR Code." path="/admin/signup" />
      <div style={{
        background: 'var(--gradient-dark)', color: '#fff', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px',
      }} className="login-brand-panel">
        <div className="blob" style={{ width: 420, height: 420, top: -140, left: -140, background: 'radial-gradient(circle, rgba(124,108,246,0.45), transparent 70%)' }} />
        <div className="blob" style={{ width: 360, height: 360, bottom: -140, right: -100, background: 'radial-gradient(circle, rgba(51,85,232,0.4), transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 44, textTransform: 'uppercase' }}>
            <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 34, width: 'auto' }} />
            Cond Informa
          </Link>
          <h1 style={{ fontSize: 'clamp(26px,3vw,34px)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px', maxWidth: 420 }}>
            Crie sua conta e comece a organizar a limpeza e manutenção do seu condomínio
          </h1>
          <p style={{ opacity: 0.72, fontSize: 15, lineHeight: 1.6, maxWidth: 380, marginBottom: 36 }}>
            Cada conta tem seus próprios condomínios, ambientes e dados, completamente
            isolados de outros clientes.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: QrCode, text: 'QR Codes por ambiente, sem login para a equipe' },
              { icon: BarChart3, text: 'Relatórios e histórico de execuções em tempo real' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.12)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} />
                </span>
                <span style={{ fontSize: 13.5, opacity: 0.85 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div className="login-mobile-brand" style={{ display: 'none', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 17, color: 'var(--blue-dark)', marginBottom: 28, justifyContent: 'center', textTransform: 'uppercase' }}>
            <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 26, width: 'auto' }} /> Cond Informa
          </div>
          <div className="surface-card" style={{ padding: 36, textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, background: 'var(--blue-light)',
              color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <ShieldCheck size={24} />
            </div>
            <Text fw={800} size="lg">Criar conta</Text>
            <Text size="sm" c="dimmed" mb="lg">Cadastre-se para começar a usar o Cond Informa</Text>

            <form onSubmit={handleSubmit(onSubmit)} style={{ textAlign: 'left' }}>
              <TextInput
                label="E-mail"
                placeholder="voce@condinforma.com"
                error={errors.email && 'Informe um e-mail válido'}
                {...register('email', { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })}
              />
              <PasswordInput
                label="Senha"
                placeholder="Mínimo 6 caracteres"
                mt="md"
                error={errors.password && 'A senha precisa ter pelo menos 6 caracteres'}
                {...register('password', { required: true, minLength: 6 })}
              />
              <PasswordInput
                label="Confirmar senha"
                placeholder="Repita a senha"
                mt="md"
                error={errors.confirmPassword && 'As senhas não coincidem'}
                {...register('confirmPassword', { required: true, validate: (v) => v === watch('password') })}
              />
              {error && <Text c="red" size="sm" mt="sm">{error}</Text>}
              <Button
                type="submit"
                fullWidth
                mt="lg"
                size="md"
                loading={isSubmitting}
                className="btn-glow"
                style={{ boxShadow: 'var(--shadow-brand)' }}
              >
                Criar conta
              </Button>
            </form>

            <Text size="sm" c="dimmed" ta="center" mt="md">
              Já tem conta?{' '}
              <Link to="/admin/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Entrar</Link>
            </Text>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 860px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-brand-panel { display: none !important; }
          .login-mobile-brand { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
