import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollArea, TextInput, ActionIcon, Text, Loader } from '@mantine/core';
import { Send, Headphones } from 'lucide-react';
import { sendSupportMessage } from '../lib/supportChat';

const GREETING = 'Oi! Eu sou o assistente de suporte do Cond-Informa. Posso ajudar com dúvidas sobre planos, funcionalidades ou como usar o painel. No que posso ajudar?';

export default function SupportChat({ opened, onClose }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const viewportRef = useRef(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const reply = await sendSupportMessage(nextMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Não consegui responder agora, tente novamente em instantes.',
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Headphones size={16} color="var(--blue)" />
          <Text fw={700} size="sm">Falar com o suporte</Text>
        </div>
      )}
      centered
      size="md"
      padding="lg"
    >
      <ScrollArea h={380} viewportRef={viewportRef} mb="sm" offsetScrollbars>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--blue)' : 'var(--bg-soft)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                borderRadius: 14,
                borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
                padding: '9px 13px',
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: 'var(--bg-soft)',
                borderRadius: 14,
                borderBottomLeftRadius: 4,
                padding: '9px 13px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Loader size={12} color="var(--text-muted)" />
              <Text size="xs" c="dimmed">digitando...</Text>
            </div>
          )}
        </div>
      </ScrollArea>

      <div style={{ display: 'flex', gap: 8 }}>
        <TextInput
          placeholder="Digite sua pergunta..."
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          style={{ flex: 1 }}
          autoFocus
        />
        <ActionIcon size={36} radius="md" onClick={handleSend} disabled={sending || !input.trim()} aria-label="Enviar mensagem">
          <Send size={16} />
        </ActionIcon>
      </div>
    </Modal>
  );
}
