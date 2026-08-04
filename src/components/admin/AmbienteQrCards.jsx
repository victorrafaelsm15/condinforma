import { Text, Button } from '@mantine/core';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

// HashRouter (necessário no GitHub Pages, que não suporta fallback de SPA):
// as rotas ficam depois do "#", então o link precisa incluir o BASE_URL + "#/...".
export function getAmbienteQrUrls(ambienteId) {
  const baseUrl = window.location.origin + import.meta.env.BASE_URL;
  return {
    execUrl: `${baseUrl}#/ambiente/${ambienteId}/executar`,
    statusUrl: `${baseUrl}#/ambiente/${ambienteId}/status`,
  };
}

export function downloadQr(elId, filename) {
  const svg = document.getElementById(elId);
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const img = new window.Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    canvas.width = img.width + 40;
    canvas.height = img.height + 40;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 20, 20);
    URL.revokeObjectURL(url);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    a.click();
  };
  img.src = url;
}

// Os dois cartões de QR Code (execução + status público) de um ambiente.
// Usado tanto na aba "QR Codes" do ambiente quanto na página agregada de
// QR Codes do condomínio inteiro (pra reimprimir tudo de uma vez).
export default function AmbienteQrCards({ ambiente, size = 150, showDownload = true }) {
  const { execUrl, statusUrl } = getAmbienteQrUrls(ambiente.id);
  const idPrefix = `qr-${ambiente.id}`;

  const cards = [
    { id: `${idPrefix}-exec`, title: 'Execução do checklist', desc: 'Para o colaborador escanear no local', value: execUrl, file: `checklist-${ambiente.name}.png`, tint: 'var(--blue-light)', color: 'brand' },
    { id: `${idPrefix}-status`, title: 'Status público', desc: 'Para o morador consultar (sem login)', value: statusUrl, file: `status-${ambiente.name}.png`, tint: 'var(--green-light)', color: 'green' },
  ];

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      {cards.map((qr) => (
        <div key={qr.id} className="surface-card qr-print-card" style={{ padding: 26, textAlign: 'center', width: 240 }}>
          <Text fw={700} size="sm" mb={4}>{qr.title}</Text>
          <Text size="xs" c="dimmed" mb="md">{qr.desc}</Text>
          <div style={{ padding: 16, background: qr.tint, borderRadius: 16, display: 'inline-block' }}>
            <div style={{ background: '#fff', padding: 12, borderRadius: 10 }}>
              <QRCodeSVG id={qr.id} value={qr.value} size={size} fgColor="#10142c" />
            </div>
          </div>
          {showDownload && (
            <Button mt="md" size="xs" variant="light" color={qr.color} leftSection={<Download size={14} />} onClick={() => downloadQr(qr.id, qr.file)} className="no-print">
              Baixar QR Code
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
