import jsPDF from 'jspdf';
import { svgToPngDataUrl } from '../components/admin/AmbienteQrCards';

const BLUE = [51, 85, 232];
const GREEN = [18, 183, 106];
const INK = [16, 20, 44];
const MUTED = [91, 97, 120];

const CARD_COLOR = { brand: BLUE, green: GREEN };

const MARGIN_X = 14;
const CARD_W = 87;
const CARD_GAP = 8;
const CARD_H = 88;
const HEADER_H = 26;
// Painel branco do QR: ancorado a uma distância fixa do TOPO e do FUNDO do
// card (CARD_PAD nos dois lados), em vez de empilhado a partir do texto —
// senão a sobra colorida embaixo do QR varia (ou desaparece) conforme o
// texto acima muda de tamanho. Com os dois lados fixos, a margem colorida
// fica sempre igual em cima e embaixo, por construção.
const CARD_PAD = 8;
const QR_SIZE = 42;
const QR_PANEL_PAD = 4;
const QR_PANEL_SIZE = QR_SIZE + QR_PANEL_PAD * 2;

// Logo convertida pra data URL uma vez só e cacheada — jsPDF.addImage não
// aceita uma URL direto, precisa de data URL/base64. Duas variantes, como no
// resto do site (ver LandingFooter/AdminLogin): branca pro cabeçalho (fundo
// azul) e navy pro rodapé (fundo branco da página) — a navy sumiria contra o
// azul, e a branca sumiria contra o branco.
const logoCache = {};
function getLogoDataUrl(variant) {
  if (!logoCache[variant]) {
    const file = variant === 'white' ? 'logo-icon-white.png' : 'logo-icon.png';
    logoCache[variant] = new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), ratio: img.width / img.height });
      };
      img.onerror = reject;
      img.src = `${import.meta.env.BASE_URL}${file}`;
    });
  }
  return logoCache[variant];
}

function drawBrandHeader(doc, logo) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageWidth, HEADER_H, 'F');

  const logoH = 12;
  const logoW = logoH * logo.ratio;
  const logoY = (HEADER_H - logoH) / 2;
  doc.addImage(logo.dataUrl, 'PNG', MARGIN_X, logoY, logoW, logoH);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COND INFORMA', MARGIN_X + logoW + 6, HEADER_H / 2 + 2);
}

function drawBrandFooter(doc, logo, y) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoH = 9;
  const logoW = logoH * logo.ratio;
  const totalW = logoW + 4 + 34; // logo + gap + texto (largura aproximada)
  const startX = (pageWidth - totalW) / 2;

  doc.addImage(logo.dataUrl, 'PNG', startX, y - logoH + 2, logoW, logoH);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('COND INFORMA', startX + logoW + 4, y);
}

function drawMetaBlock(doc, y, { userEmail, generatedAt, total }) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Gerado por: ${userEmail || 'não identificado'}`, MARGIN_X, y);
  doc.text(`Data/hora: ${generatedAt}`, MARGIN_X, y + 5);
  doc.text(`Total de QR Codes: ${total}`, MARGIN_X, y + 10);
  return y + 16;
}

function drawCard(doc, x, y, card) {
  const color = CARD_COLOR[card.color];
  doc.setFillColor(...color);
  doc.roundedRect(x, y, CARD_W, CARD_H, 4, 4, 'F');

  const centerX = x + CARD_W / 2;
  let cy = y + CARD_PAD + 4;

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(card.ambienteName, centerX, cy, { align: 'center' });
  cy += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(card.title, centerX, cy, { align: 'center' });
  cy += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const descLines = doc.splitTextToSize(card.desc, CARD_W - 14);
  doc.text(descLines, centerX, cy, { align: 'center' });

  // Painel branco com o QR Code — ancorado à distância CARD_PAD do fundo do
  // card, igual à distância do texto até o topo, pra sobra colorida ficar
  // simétrica em cima e embaixo independente do tamanho do texto acima.
  const panelX = centerX - QR_PANEL_SIZE / 2;
  const panelY = y + CARD_H - CARD_PAD - QR_PANEL_SIZE;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(panelX, panelY, QR_PANEL_SIZE, QR_PANEL_SIZE, 3, 3, 'F');
  doc.addImage(card.qrDataUrl, 'PNG', panelX + QR_PANEL_PAD, panelY + QR_PANEL_PAD, QR_SIZE, QR_SIZE);
}

/**
 * Gera o PDF de QR Codes — mesmo padrão visual (card colorido completo,
 * título/subtítulo, nome do ambiente e o QR Code) tanto pra 1 selecionado
 * quanto pra vários, porque os dois casos passam pela mesma função.
 *
 * sections: [{ ambienteName, cards: [{ id (svg element id), title, desc,
 *   color: 'blue'|'green', filenameSlug }] }]
 */
export async function generateQrCodesPdf({ condominioName, sections, userEmail }) {
  const [logoWhite, logoNavy] = await Promise.all([getLogoDataUrl('white'), getLogoDataUrl('navy')]);

  // Extrai o PNG de cada QR a partir do <svg> já renderizado na tela —
  // evita gerar o QR de novo (mesma fonte de verdade pra tela e PDF).
  const cardsWithImages = [];
  for (const section of sections) {
    const cards = [];
    for (const card of section.cards) {
      // eslint-disable-next-line no-await-in-loop
      const qrDataUrl = await svgToPngDataUrl(card.id, 8);
      cards.push({ ...card, ambienteName: section.ambienteName, qrDataUrl });
    }
    cardsWithImages.push({ ambienteName: section.ambienteName, cards });
  }

  const totalQrCount = cardsWithImages.reduce((sum, s) => sum + s.cards.length, 0);
  const generatedAt = new Date().toLocaleString('pt-BR');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  drawBrandHeader(doc, logoWhite);

  let y = HEADER_H + 14;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`QR Codes: ${condominioName || ''}`, MARGIN_X, y);
  y += 8;

  y = drawMetaBlock(doc, y, { userEmail, generatedAt, total: totalQrCount });

  const sectionLabelH = 6;
  const sectionGap = 10;

  cardsWithImages.forEach((section) => {
    const sectionH = sectionLabelH + CARD_H;
    if (y + sectionH > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(section.ambienteName, MARGIN_X, y);
    y += sectionLabelH + 2;

    section.cards.forEach((card, i) => {
      const x = MARGIN_X + i * (CARD_W + CARD_GAP);
      drawCard(doc, x, y, card);
    });
    y += CARD_H + sectionGap;
  });

  // Rodapé institucional só no final do documento (última página).
  const footerY = pageHeight - 14;
  if (y > footerY - 6) {
    doc.addPage();
  }
  drawBrandFooter(doc, logoNavy, footerY);

  return { doc, pageWidth, pageHeight };
}

export function downloadQrCodesPdf(doc, filename) {
  doc.save(filename);
}
