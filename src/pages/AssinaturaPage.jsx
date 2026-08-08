import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { Button, TextInput, PasswordInput, Text, SegmentedControl, Checkbox, Loader, Group } from '@mantine/core';
import { Check } from 'lucide-react';
import { plans } from '../data/landingContent';
import { signUp, getSession } from '../lib/authService';

function translateSignUpError(message) {
  if (message?.includes('User already registered')) {
    return 'Já existe uma conta com esse e-mail. Entre no painel pra assinar ou trocar de plano por lá.';
  }
  if (message?.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return message || 'Não foi possível criar sua conta. Tente novamente.';
}

const BILLING_OPTIONS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
  { value: 'BOLETO', label: 'Boleto' },
];

export default function AssinaturaPage() {
  const [searchParams] = useSearchParams();
  const planName = searchParams.get('plano');
  const plan = plans.find((p) => p.name === planName);

  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const {
    register, handleSubmit, control, watch, setError, formState: { isSubmitting, errors },
  } = useForm({ defaultValues: { billingType: 'PIX' } });
  const termsAccepted = watch('termsAccepted');

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setCheckingSession(false);
    });
  }, []);

  if (!plan) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
        <div className="surface-card" style={{ maxWidth: 420, padding: '40px 32px', textAlign: 'center' }}>
          <Text fw={800} size="lg" mb={8}>Plano não encontrado</Text>
          <Text c="dimmed" size="sm" mb="lg">Escolha um plano na página inicial para continuar.</Text>
          <Button component={Link} to="/#planos">Ver planos</Button>
        </div>
      </div>
    );
  }

  const onSubmit = async ({ name, email, cpfCnpj, phone, password, billingType, couponCode }) => {
    setErrorMsg('');
    try {
      let accessToken = session?.access_token;

      // Não logado: cria a conta (login do painel) antes de assinar. Logado
      // (fluxo de troca de plano vindo de Configurações): reaproveita a
      // sessão já existente e nem mostra os campos de senha.
      if (!session) {
        const { data: signUpData, error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setErrorMsg(translateSignUpError(signUpError.message));
          return;
        }
        if (!signUpData.session) {
          setErrorMsg('Conta criada, mas seu e-mail precisa ser confirmado antes de assinar. Confirme e depois entre no painel para assinar por lá.');
          return;
        }
        accessToken = signUpData.session.access_token;
      }

      const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe`;
      const res = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ planName, name, email, cpfCnpj, phone, billingType, couponCode: couponCode?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field === 'coupon') {
          setError('couponCode', { type: 'server', message: data.error });
          return;
        }
        setErrorMsg(data.error || 'Não foi possível iniciar a assinatura. Tente novamente.');
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setErrorMsg('Falha de conexão. Verifique sua internet e tente novamente.');
    }
  };

  if (checkingSession) {
    return <Group justify="center" py={100}><Loader color="brand" /></Group>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="assinar-grid">
      <div style={{
        background: 'var(--gradient-dark)', color: '#fff', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px',
      }} className="assinar-brand-panel">
        <div className="blob" style={{ width: 420, height: 420, top: -140, left: -140, background: 'radial-gradient(circle, rgba(124,108,246,0.45), transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 40, textTransform: 'uppercase' }}>
            <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 32, width: 'auto' }} />
            Cond-Informa
          </Link>
          <Text size="xs" fw={700} tt="uppercase" style={{ opacity: 0.7, letterSpacing: '0.06em' }}>Plano selecionado</Text>
          <Text fw={800} size="1.8rem" className="font-display" mt={6}>{plan.name}</Text>
          <Text size="sm" style={{ opacity: 0.72 }} mb={6}>{plan.tagline}</Text>
          <Text fw={800} size="2rem" className="font-display" mb={22}>
            R$ {plan.price}<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.7 }}>/mês</span>
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {plan.features.map((f) => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13.5, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, marginTop: 1, width: 17, height: 17, borderRadius: '50%',
                  background: 'rgba(18,183,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={10} color="#5eead4" strokeWidth={3} />
                </span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div className="assinar-mobile-brand" style={{ display: 'none', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 17, color: 'var(--blue-dark)', marginBottom: 20, justifyContent: 'center', textTransform: 'uppercase' }}>
            <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" style={{ height: 26, width: 'auto' }} /> Cond-Informa
          </div>
          <div className="surface-card" style={{ padding: 32 }}>
            <Text fw={800} size="lg" mb={4}>{session ? 'Confirmar assinatura' : 'Criar conta e assinar'}</Text>
            <Text size="sm" c="dimmed" mb="lg">
              {session
                ? `Você está trocando para o plano ${plan.name}.`
                : `Plano ${plan.name} — preencha seus dados para continuar.`}
            </Text>

            <form onSubmit={handleSubmit(onSubmit)}>
              <TextInput
                label="Nome completo"
                placeholder="Seu nome"
                mb="sm"
                error={errors.name && 'Informe seu nome'}
                {...register('name', { required: true })}
              />
              <TextInput
                label="E-mail"
                placeholder="voce@email.com"
                mb="sm"
                disabled={!!session}
                defaultValue={session?.user?.email || ''}
                error={errors.email && 'Informe um e-mail válido'}
                {...register('email', { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })}
              />
              <TextInput
                label="CPF ou CNPJ"
                placeholder="Somente números"
                mb="sm"
                error={errors.cpfCnpj && 'Informe um CPF ou CNPJ válido'}
                {...register('cpfCnpj', { required: true, minLength: 11 })}
              />
              <TextInput
                label="Telefone (com DDD)"
                placeholder="(00) 00000-0000"
                mb="sm"
                error={errors.phone && 'Informe um telefone válido'}
                {...register('phone', { required: true, minLength: 10 })}
              />

              {!session && (
                <>
                  <PasswordInput
                    label="Criar senha"
                    placeholder="Mínimo 6 caracteres"
                    mb="sm"
                    error={errors.password && 'A senha precisa ter pelo menos 6 caracteres'}
                    {...register('password', { required: true, minLength: 6 })}
                  />
                  <PasswordInput
                    label="Confirmar senha"
                    placeholder="Repita a senha"
                    mb="sm"
                    error={errors.confirmPassword && 'As senhas não coincidem'}
                    {...register('confirmPassword', { required: true, validate: (v) => v === watch('password') })}
                  />
                </>
              )}

              <Text size="sm" fw={600} mb={6} mt="sm">Forma de pagamento</Text>
              <Controller
                name="billingType"
                control={control}
                render={({ field }) => (
                  <SegmentedControl
                    {...field}
                    fullWidth
                    mb="sm"
                    data={BILLING_OPTIONS}
                  />
                )}
              />

              <TextInput
                label="Cupom de desconto (opcional)"
                placeholder="Ex: BEMVINDO20"
                mb="sm"
                error={errors.couponCode?.message}
                {...register('couponCode')}
              />

              {errorMsg && <Text c="red" size="sm" mb="sm">{errorMsg}</Text>}

              <Checkbox
                mt="md"
                mb="lg"
                label={(
                  <Text size="xs" c="dimmed">
                    Aceito os{' '}
                    <a href={`${import.meta.env.BASE_URL}#/termos`} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>Termos de Uso</a>
                    {' '}e a{' '}
                    <a href={`${import.meta.env.BASE_URL}#/privacidade`} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>Política de Privacidade</a>
                  </Text>
                )}
                {...register('termsAccepted', { required: true })}
              />

              <Button
                type="submit"
                fullWidth
                size="md"
                loading={isSubmitting}
                disabled={!termsAccepted}
                className="btn-glow"
                style={{ boxShadow: 'var(--shadow-brand)' }}
              >
                {session ? 'Confirmar e ir para pagamento' : 'Criar conta e ir para pagamento'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .assinar-grid { grid-template-columns: 1fr !important; }
          .assinar-brand-panel { display: none !important; }
          .assinar-mobile-brand { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
