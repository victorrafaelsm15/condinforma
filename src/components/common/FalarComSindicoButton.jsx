import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';
import { MessageCircle } from 'lucide-react';
import { fetchSindicoWhatsapp, buildWhatsAppLink } from '../../lib/whatsapp';

// Botão "Falar com o síndico" das páginas públicas de QR Code
// (ExecutarChecklistPage / StatusPublicoPage) — some sozinho se o síndico
// ainda não cadastrou um WhatsApp (contas antigas, criadas antes deste
// campo existir).
export default function FalarComSindicoButton({ ambienteId }) {
  const [link, setLink] = useState(null);

  useEffect(() => {
    let active = true;
    fetchSindicoWhatsapp(ambienteId).then((phone) => {
      if (active) setLink(buildWhatsAppLink(phone));
    });
    return () => { active = false; };
  }, [ambienteId]);

  if (!link) return null;

  return (
    <Button
      component="a"
      href={link}
      target="_blank"
      rel="noreferrer"
      variant="outline"
      color="green"
      fullWidth
      size="md"
      leftSection={<MessageCircle size={16} />}
      mb={18}
      style={{ minHeight: 44 }}
    >
      Falar diretamente com o síndico
    </Button>
  );
}
