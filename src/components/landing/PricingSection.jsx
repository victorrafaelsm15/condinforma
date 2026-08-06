import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Modal, TextInput, PasswordInput, Text } from '@mantine/core';
import { Check } from 'lucide-react';
import { plans } from '../../data/landingContent';
import { signUp } from '../../lib/authService';
import Reveal from './Reveal';

function translateSignUpError(message) {
  if (message?.includes('User already registered')) {
    return 'Já existe uma conta com esse e-mail. Entre no painel pra assinar por lá, ou use outro e-mail.';
  }
  if (message?.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return message || 'Não foi possível criar sua conta. Tente novamente.';
}

export default function PricingSection() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const { register, handleSubmit, reset, watch, formState: { isSubmitting, errors } } = useForm();

  const openModal = (planName) => {
    setErrorMsg('');
    reset();
    setSelectedPlan(planName);
  };

  const onSubmit = async ({ name, email, cpfCnpj, phone, password }) => {
    setErrorMsg('');
    try {
      // Cria a conta (Supabase Auth) primeiro — o cliente já sai daqui com
      // login pronto, sem precisar de um segundo cadastro depois de pagar.
      const { data: signUpData, error: signUpError } = await signUp(email, password);
      if (signUpError) {
        setErrorMsg(translateSignUpError(signUpError.message));
        return;
      }
      if (!signUpData.session) {
        setErrorMsg('Conta criada, mas seu e-mail precisa ser confirmado antes de assinar. Confirme e depois entre no painel para assinar por lá.');
        return;
      }

      // Chama a Edge Function do Supabase diretamente (o site é estático no
      // GitHub Pages — não tem "backend próprio" pra receber esse POST). A
      // função valida esse token pra saber a qual conta vincular a
      // assinatura — não confiamos num accountId solto no corpo do request.
      const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe`;
      const res = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${signUpData.session.access_token}`,
        },
        body: JSON.stringify({ planName: selectedPlan, name, email, cpfCnpj, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Não foi possível iniciar a assinatura. Tente novamente.');
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setErrorMsg('Falha de conexão. Verifique sua internet e tente novamente.');
    }
  };

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
                    onClick={() => openModal(plan.name)}
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

      <Modal opened={!!selectedPlan} onClose={() => setSelectedPlan(null)} title={`Assinar plano ${selectedPlan || ''}`} centered>
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
          <PasswordInput
            label="Crie uma senha"
            placeholder="Mínimo 6 caracteres"
            mb="sm"
            error={errors.password && 'A senha precisa ter pelo menos 6 caracteres'}
            {...register('password', { required: true, minLength: 6 })}
          />
          <PasswordInput
            label="Confirmar senha"
            placeholder="Repita a senha"
            mb="md"
            error={errors.confirmPassword && 'As senhas não coincidem'}
            {...register('confirmPassword', { required: true, validate: (v) => v === watch('password') })}
          />
          {errorMsg && <Text c="red" size="sm" mb="sm">{errorMsg}</Text>}
          <Text size="xs" c="dimmed" mb="md">
            Essa senha já será o login do seu painel de gestor. Depois de criar a conta, você
            será redirecionado para a página segura do Asaas para concluir o pagamento via Pix, boleto ou cartão.
          </Text>
          <Button type="submit" fullWidth loading={isSubmitting} className="btn-glow" style={{ boxShadow: 'var(--shadow-brand)' }}>
            Continuar para pagamento
          </Button>
        </form>
      </Modal>
    </section>
  );
}
