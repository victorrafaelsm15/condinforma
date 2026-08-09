import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Modal, Stepper, Text, Button, TextInput, Group } from '@mantine/core';
import { Building2, DoorOpen, ListChecks, QrCode, PartyPopper, Sparkles, Lock, ArrowRight } from 'lucide-react';
import { condominiosStore, accountsStore } from '../../lib/stores';
import { logAudit } from '../../lib/auditLog';

// Wizard de boas-vindas — aparece sozinho pra conta nova (sem nenhum
// condomínio ainda) e fica acessível de novo por "Ver tutorial" em
// Configurações. Marca accounts.onboarding_completed = true tanto ao
// concluir quanto ao fechar manualmente, pra não insistir toda hora — quem
// quiser rever, reabre pelo botão.
export default function OnboardingWizard({
  opened, onClose, accountId, accountStatus, accountRole, hasCondominio, firstCondominio, onCondominioCreated,
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(hasCondominio ? 1 : 0);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdCondo, setCreatedCondo] = useState(firstCondominio || null);

  // Owner (dono da plataforma) nunca depende de assinatura — pra qualquer
  // outra conta, cadastrar condomínio exige status "ativo" (é o mesmo
  // critério do trigger check_condominio_limit no banco).
  const planActive = accountRole === 'owner' || accountStatus === 'ativo';

  // O componente fica montado o tempo todo (só o Modal abre/fecha via
  // "opened"), então o useState inicial acima só valeria pro PRIMEIRO
  // mount — que costuma acontecer antes da lista de condomínios terminar
  // de carregar. Resincroniza toda vez que o wizard é efetivamente
  // aberto, com os dados mais atuais.
  useEffect(() => {
    if (opened) {
      setStep(hasCondominio ? 1 : 0);
      setCreatedCondo(firstCondominio || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const finish = async () => {
    if (accountId) {
      try {
        await accountsStore.update(accountId, { onboarding_completed: true });
      } catch {
        // não bloqueia o fechamento do wizard por causa disso
      }
    }
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await condominiosStore.create({ name: name.trim() });
      logAudit({ action: 'condominio.criado', entityType: 'condominio', entityId: created.id, details: { name: created.name } });
      setCreatedCondo(created);
      onCondominioCreated?.();
      setStep(1);
    } catch {
      // sem tratamento elaborado aqui de propósito — se falhar (ex. limite
      // do plano), a pessoa ainda tem o fluxo normal do dashboard pra criar
      // com feedback completo depois de fechar o tutorial.
    } finally {
      setSaving(false);
    }
  };

  const goToCondominio = () => {
    const target = createdCondo?.id;
    finish();
    if (target) navigate(`/admin/condominios/${target}`);
  };

  return (
    <Modal opened={opened} onClose={finish} title="Bem-vindo ao Cond-Informa" size="lg" centered>
      <Stepper active={step} onStepClick={setStep} allowNextStepsSelect={false} size="sm" mb="lg">
        <Stepper.Step label="Condomínio" icon={<Building2 size={16} />}>
          <Group gap={12} mb="lg" wrap="nowrap" align="flex-start">
            <span className="icon-tile" style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--blue-light)', flexShrink: 0 }}>
              <Sparkles size={20} color="var(--blue)" />
            </span>
            <div>
              <Text fw={800} size="md">Bem-vindo(a) ao Cond-Informa!</Text>
              <Text size="sm" c="dimmed" mt={2}>Vamos te ajudar a configurar tudo em poucos passos.</Text>
            </div>
          </Group>

          {planActive ? (
            <>
              <Text size="sm" c="dimmed" mb="md">
                Tudo começa cadastrando o primeiro condomínio que você vai gerenciar por aqui.
              </Text>
              <TextInput
                label="Nome do condomínio"
                placeholder="Ex: Residencial Jardins"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                data-autofocus
                mb="md"
              />
              <Button fullWidth onClick={handleCreate} loading={saving}>Criar meu primeiro condomínio</Button>
            </>
          ) : (
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--amber-light)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Group gap={8} mb={6}>
                <Lock size={16} color="var(--amber)" style={{ flexShrink: 0 }} />
                <Text size="sm" fw={700} style={{ color: '#92620a' }}>Assine um plano para começar</Text>
              </Group>
              <Text size="sm" mb="md" style={{ color: '#92620a' }}>
                Pra cadastrar seu primeiro condomínio, sua conta precisa de uma assinatura ativa. Escolha um plano — leva menos de 2 minutos.
              </Text>
              <Button
                component={Link}
                to="/?scrollTo=planos"
                fullWidth
                className="btn-glow"
                style={{ boxShadow: 'var(--shadow-brand)' }}
                rightSection={<ArrowRight size={15} />}
              >
                Ver planos
              </Button>
            </div>
          )}
        </Stepper.Step>

        <Stepper.Step label="Ambientes" icon={<DoorOpen size={16} />}>
          <Text size="sm" c="dimmed" mb="md">
            Dentro do condomínio, cadastre os ambientes que vão ter checklist — elevador, portaria, academia, garagem, o que fizer sentido pro seu prédio.
          </Text>
          <Button fullWidth onClick={goToCondominio}>
            {createdCondo ? `Ir para ${createdCondo.name} e adicionar ambientes` : 'Ir para o condomínio'}
          </Button>
        </Stepper.Step>

        <Stepper.Step label="Checklist" icon={<ListChecks size={16} />}>
          <Text size="sm" c="dimmed" mb="md">
            Em cada ambiente, monte a lista de tarefas que precisam ser conferidas — é isso que o colaborador vê e marca ao executar.
          </Text>
          <Button fullWidth onClick={() => setStep(3)}>Entendi, continuar</Button>
        </Stepper.Step>

        <Stepper.Step label="QR Code" icon={<QrCode size={16} />}>
          <Text size="sm" c="dimmed" mb="md">
            Cada ambiente gera um QR Code próprio. Imprima e cole no local — o colaborador escaneia e executa o checklist na hora, sem precisar de login.
          </Text>
          <Button fullWidth onClick={() => setStep(4)}>Entendi, continuar</Button>
        </Stepper.Step>

        <Stepper.Completed>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <PartyPopper size={40} color="var(--blue)" style={{ marginBottom: 12 }} />
            <Text fw={700} mb={4}>Pronto! Acompanhe tudo por aqui.</Text>
            <Text size="sm" c="dimmed" mb="lg">
              Ocorrências, execuções e relatórios de todos os condomínios ficam disponíveis no painel a qualquer momento.
            </Text>
            <Button fullWidth onClick={finish}>Concluir tutorial</Button>
          </div>
        </Stepper.Completed>
      </Stepper>
    </Modal>
  );
}
