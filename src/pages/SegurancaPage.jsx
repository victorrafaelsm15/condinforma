import { useEffect, useState } from 'react';
import { Text, PasswordInput, TextInput, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ShieldCheck, MessageCircle } from 'lucide-react';
import { getSession, signIn } from '../lib/authService';
import { supabase } from '../lib/supabaseClient';
import { accountsStore } from '../lib/stores';
import { getSubUsuarioInfo } from '../lib/subUsuario';
import { onlyDigits } from '../lib/whatsapp';

function WhatsAppSection() {
  const [accountId, setAccountId] = useState(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session?.user?.id) { setLoading(false); return; }
      // WhatsApp é da conta principal (o número do síndico), nunca do
      // login individual — sub-usuário nem consegue gravar aqui mesmo
      // (RLS de accounts só libera update quando id = auth.uid(), e o uid
      // do sub-usuário nunca é o id da conta dona), então a seção some pra
      // ele em vez de deixar salvar sem efeito nenhum.
      const subInfo = await getSubUsuarioInfo(session.user.id);
      if (subInfo) { setLoading(false); return; }
      setAccountId(session.user.id);
      const account = await accountsStore.getById(session.user.id);
      setWhatsapp(account?.whatsapp_phone || '');
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setError('');
    const digits = onlyDigits(whatsapp);
    if (digits.length < 10) {
      setError('Informe um WhatsApp válido, com DDD.');
      return;
    }
    setSaving(true);
    try {
      await accountsStore.update(accountId, { whatsapp_phone: digits });
      notifications.show({ color: 'green', message: 'WhatsApp de contato atualizado.' });
    } catch {
      setError('Não foi possível salvar agora. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !accountId) return null;

  return (
    <div className="surface-card" style={{ padding: 24, maxWidth: 420, marginTop: 20 }}>
      <Text fw={700} mb={4}>WhatsApp de contato</Text>
      <Text size="sm" c="dimmed" mb="md">
        Exibido no botão "Falar com o síndico" das páginas públicas de QR Code (colaborador e morador).
      </Text>
      <TextInput
        label="WhatsApp (com DDD)"
        placeholder="(00) 00000-0000"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.currentTarget.value)}
        mb="md"
      />
      {error && <Text size="sm" c="red" mb="md">{error}</Text>}
      <Button fullWidth leftSection={<MessageCircle size={16} />} onClick={handleSave} loading={saving}>
        Salvar WhatsApp
      </Button>
    </div>
  );
}

export default function SegurancaPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação não bate com a nova senha.');
      return;
    }

    setSaving(true);
    try {
      const session = await getSession();
      if (!session?.user?.email) {
        setError('Sessão inválida. Faça login novamente.');
        return;
      }

      // supabase.auth.updateUser() não exige a senha atual pra trocar a
      // senha de uma sessão já autenticada — reautentica manualmente aqui
      // (signInWithPassword com a senha atual informada) antes de
      // prosseguir, pra garantir que só quem realmente sabe a senha de
      // hoje consegue definir uma nova.
      const { error: reauthError } = await signIn(session.user.email, currentPassword);
      if (reauthError) {
        setError('Senha atual incorreta.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message || 'Não foi possível trocar a senha agora.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notifications.show({ color: 'green', message: 'Senha alterada com sucesso.' });
    } catch {
      setError('Não foi possível trocar a senha agora. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Text fw={800} size="1.6rem" className="font-display">Segurança</Text>
        <Text size="md" c="dimmed" mt={2}>Troque a senha de acesso da sua conta.</Text>
      </div>

      <div className="surface-card" style={{ padding: 24, maxWidth: 420 }}>
        <PasswordInput
          label="Senha atual"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.currentTarget.value)}
          mb="md"
          data-autofocus
        />
        <PasswordInput
          label="Nova senha"
          placeholder="Mínimo 6 caracteres"
          value={newPassword}
          onChange={(e) => setNewPassword(e.currentTarget.value)}
          mb="md"
        />
        <PasswordInput
          label="Confirmar nova senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          mb="md"
        />
        {error && <Text size="sm" c="red" mb="md">{error}</Text>}
        <Button fullWidth leftSection={<ShieldCheck size={16} />} onClick={handleSubmit} loading={saving}>
          Trocar senha
        </Button>
      </div>

      <WhatsAppSection />
    </div>
  );
}
