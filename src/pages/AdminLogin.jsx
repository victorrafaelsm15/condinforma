import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button, TextInput, PasswordInput, Text } from '@mantine/core';
import { ShieldCheck, Building2, QrCode, BarChart3 } from 'lucide-react';
import { login } from '../lib/authService';
import InstallAppButton from '../components/common/InstallAppButton';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  const onSubmit = async ({ email, password }) => {
    setError('');
    await new Promise((r) => setTimeout(r, 300));
    if (login(email, password)) navigate('/admin');
    else setError('E-mail ou senha incorretos.');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="login-grid">
      <div style={{
        background: 'var(--gradient-dark)', color: '#fff', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px',
      }} className="login-brand-panel">
        <div className="blob" style={{ width: 420, height: 420, top: -140, left: -140, background: 'radial-gradient(circle, rgba(124,108,246,0.45), transparent 70%)' }} />
        <div className="blob" style={{ width: 360, height: 360, bottom: -140, right: -100, background: 'radial-gradient(circle, rgba(51,85,232,0.4), transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 44, textTransform: 'uppercase' }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Building2 size={18} />
            </span>
            Cond-Informa
          </Link>
          <h1 style={{ fontSize: 'clamp(26px,3vw,34px)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px', maxWidth: 420 }}>
            O painel completo para gerir limpeza e manutenção do seu condomínio
          </h1>
          <p style={{ opacity: 0.72, fontSize: 15, lineHeight: 1.6, maxWidth: 380, marginBottom: 36 }}>
            Acompanhe checklists, ocorrências e relatórios de todos os ambientes em um só lugar.
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
            <Building2 size={20} color="var(--blue)" /> Cond-Informa
          </div>
          <div className="surface-card" style={{ padding: 36, textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, background: 'var(--blue-light)',
              color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <ShieldCheck size={24} />
            </div>
            <Text fw={800} size="lg">Painel do gestor</Text>
            <Text size="sm" c="dimmed" mb="lg">Entre com suas credenciais para continuar</Text>

            <form onSubmit={handleSubmit(onSubmit)} style={{ textAlign: 'left' }}>
              <TextInput label="E-mail" placeholder="voce@condinforma.com" {...register('email', { required: true })} />
              <PasswordInput label="Senha" placeholder="••••••••" mt="md" {...register('password', { required: true })} />
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
                Entrar
              </Button>
            </form>

            <InstallAppButton
              label="Instalar app no dispositivo"
              variant="default"
              fullWidth
              mt="md"
              size="sm"
            />
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
