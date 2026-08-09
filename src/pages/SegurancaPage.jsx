import { useState } from 'react';
import { Text, PasswordInput, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ShieldCheck } from 'lucide-react';
import { getSession, signIn } from '../lib/authService';
import { supabase } from '../lib/supabaseClient';

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
    </div>
  );
}
