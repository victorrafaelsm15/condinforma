import { Text, Button } from '@mantine/core';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Check } from 'lucide-react';

// HashRouter (necessário no GitHub Pages, que não suporta fallback de SPA):
// as rotas ficam depois do "#", então o link precisa incluir o BASE_URL + "#/...".
export function getAmbienteQrUrls(ambienteId) {
  const baseUrl = window.location.origin + import.meta.env.BASE_URL;
  return {
    execUrl: `${baseUrl}#/ambiente/${ambienteId}/executar`,
    statusUrl: `${baseUrl}#/ambiente/${ambienteId}/status`,
  };
}

// Serializa o <svg> do QR Code (renderizado pelo qrcode.react) pra um PNG em
// canvas, com uma margem branca ao redor (câmera de celular precisa dessa
// "quiet zone" pra decodificar direito). Usado tanto pro download individual
// (downloadQr abaixo) quanto pela exportação em PDF (qrCodesPdf.js), que
// reaproveita os mesmos <svg> já renderizados na tela em vez de gerar o QR
// de novo.
export function svgToPngDataUrl(elId, padding = 20) {
  return new Promise((resolve, reject) => {
    const svg = document.getElementById(elId);
    if (!svg) { reject(new Error(`SVG #${elId} não encontrado.`)); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const img = new window.Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Falha ao carregar SVG #${elId}.`)); };
    img.src = url;
  });
}

export function downloadQr(elId, filename) {
  svgToPngDataUrl(elId).then((pngUrl) => {
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    a.click();
  });
}

// Definição dos 2 cartões de um ambiente — extraída à parte pra ser
// reaproveitada também pela exportação em PDF (qrCodesPdf.js), sem duplicar
// título/descrição/cor num segundo lugar.
export function getAmbienteQrCardDefs(ambiente) {
  const { execUrl, statusUrl } = getAmbienteQrUrls(ambiente.id);
  const idPrefix = `qr-${ambiente.id}`;
  return [
    {
      id: `${idPrefix}-exec`,
      title: 'Execução do checklist',
      desc: 'Para o colaborador escanear no local',
      value: execUrl,
      file: `checklist-${ambiente.name}.png`,
      background: 'var(--gradient-brand)',
      color: 'brand',
    },
    {
      id: `${idPrefix}-status`,
      title: 'Status público',
      desc: 'Para o morador consultar (sem login)',
      value: statusUrl,
      file: `status-${ambiente.name}.png`,
      background: 'linear-gradient(135deg, #12b76a 0%, #0a7d47 100%)',
      color: 'green',
    },
  ];
}

// Os dois cartões de QR Code (execução + status público) de um ambiente.
// Usado tanto na aba "QR Codes" do ambiente quanto na página agregada de
// QR Codes do condomínio inteiro (pra reimprimir tudo de uma vez).
export default function AmbienteQrCards({ ambiente, size = 150, showDownload = true, selectable = false, selectedIds, onToggle }) {
  const cards = getAmbienteQrCardDefs(ambiente);

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      {cards.map((qr) => {
        const isSelected = selectedIds?.has(qr.id);
        return (
        <div
          key={qr.id}
          className={`qr-print-card qr-card${isSelected ? ' selected' : ''}`}
          style={{ padding: 26, textAlign: 'center', width: 240, background: qr.background, borderRadius: 'var(--radius-lg)', border: 'none', position: 'relative' }}
        >
          {selectable && (
            <button
              type="button"
              onClick={() => onToggle(qr.id)}
              aria-label={isSelected ? 'Desmarcar QR Code' : 'Marcar QR Code'}
              aria-pressed={isSelected}
              className="no-print"
              style={{
                position: 'absolute', top: 12, left: 12, width: 22, height: 22, borderRadius: '50%',
                cursor: 'pointer', padding: 0, zIndex: 1,
                border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.7)',
                background: isSelected ? '#fff' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s var(--ease)',
              }}
            >
              {isSelected && <Check size={13} color={qr.color === 'brand' ? 'var(--blue)' : 'var(--green)'} strokeWidth={3} />}
            </button>
          )}
          <Text fw={700} size="sm" mb={4} c="#fff">{qr.title}</Text>
          <Text size="xs" mb="md" c="rgba(255,255,255,0.8)">{qr.desc}</Text>
          {/* Fundo do QR Code em si continua branco — QR colorido de ponta a
              ponta perde contraste entre os módulos e fica ilegível pra câmera. */}
          <div style={{ padding: 16, background: '#fff', borderRadius: 16, display: 'inline-block' }}>
            <QRCodeSVG id={qr.id} value={qr.value} size={size} fgColor="#10142c" />
          </div>
          {showDownload && (
            <Button mt="md" size="xs" variant="white" color={qr.color} leftSection={<Download size={14} />} onClick={() => downloadQr(qr.id, qr.file)} className="no-print">
              Baixar QR Code
            </Button>
          )}
        </div>
        );
      })}
    </div>
  );
}
