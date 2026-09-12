import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, PasswordInput, Text, Loader, Group } from '@mantine/core';
import { KeyRound } from 'lucide-react';
import { getSession, updatePassword, signOut } from '../lib/authService';
import Seo from '../components/common/Seo';

export default function RedefinirSenhaPage() {
  const navigate = useNavigate();
  // 'loading' = ainda conferindo se o link trouxe uma sessão de recuperação
  // válida; 'ready' = sessão válida, mostra o formulário; 'invalid' = sem
  // sessão (link expirado, já usado, ou aberto sem vir do e-mail).
  const [status, setStatus] = useState('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    // getSession() aguarda internamente a troca do "?code=" da URL por uma
    // sessão de verdade (client PKCE, ver supabaseClient.js) antes de
    // devolver — não precisa de nenhum listener de evento separado pra
    // isso: se o link era válido, a sessão já vem pronta aqui.
    getSession().then((session) => {
      if (!mounted) return;
      setStatus(session ? 'ready' : 'invalid');
    });
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!newPassword || !confirmPassword) {
      setError('Preencha os dois campos.');
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
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) {
        setError(updateError.message || 'Não foi possível trocar a senha agora.');
        return;
      }
      // Encerra a sessão temporária de recuperação — o usuário confirma a
      // senha nova entrando de novo do zero, na tela de login.
      await signOut();
      navigate('/admin/login', { state: { passwordResetSuccess: true } });
    } catch {
      setError('Não foi possível trocar a senha agora. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <Seo title="Redefinir senha — Cond Informa" description="Defina uma nova senha de acesso ao painel do Cond Informa." path="/admin/redefinir-senha" />
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="surface-card" style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: 'var(--blue-light)',
            color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}
          >
            <KeyRound size={24} />
          </div>
          <Text fw={800} size="lg">Redefinir senha</Text>

          {status === 'loading' && (
            <Group justify="center" py={30}><Loader color="brand" size="sm" /></Group>
          )}

          {status === 'invalid' && (
            <>
              <Text size="sm" c="dimmed" mb="lg">
                Este link de redefinição é inválido ou já expirou. Solicite um novo link.
              </Text>
              <Button component={Link} to="/admin/esqueci-senha" fullWidth>Solicitar novo link</Button>
            </>
          )}

          {status === 'ready' && (
            <>
              <Text size="sm" c="dimmed" mb="lg">Escolha a nova senha da sua conta</Text>
              <div style={{ textAlign: 'left' }}>
                <PasswordInput
                  label="Nova senha"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.currentTarget.value)}
                  mb="md"
                  data-autofocus
                />
                <PasswordInput
                  label="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  mb="md"
                />
                {error && <Text c="red" size="sm" mb="md">{error}</Text>}
                <Button fullWidth size="md" loading={saving} onClick={handleSubmit} className="btn-glow" style={{ boxShadow: 'var(--shadow-brand)' }}>
                  Trocar senha
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
