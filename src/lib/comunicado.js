import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BLUE = [51, 85, 232];
const INK = [16, 20, 44];
const MUTED = [91, 97, 120];
const GREEN = [18, 183, 106];
const RED = [239, 68, 68];

function detectImageFormat(dataUri) {
  const match = /^data:image\/(\w+);/.exec(dataUri || '');
  const ext = (match?.[1] || 'jpeg').toUpperCase();
  return ext === 'JPG' ? 'JPEG' : ext;
}

function renderExecucaoPage(doc, { condominioName, ambienteName, execucao }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // Cabeçalho institucional
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('COND-INFORMA', marginX, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Comunicado de execução de manutenção/limpeza', marginX, 19);
  if (condominioName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(condominioName, pageWidth - marginX, 15, { align: 'right' });
  }

  let y = 40;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(ambienteName || 'Ambiente', marginX, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const dataHora = new Date(execucao.created_at).toLocaleString('pt-BR');
  doc.text(`Data/hora da execução: ${dataHora}`, marginX, y);
  y += 6;
  doc.text(`Responsável: ${execucao.executed_by || 'Não informado'}`, marginX, y);
  y += 6;
  doc.text(`Tarefas concluídas: ${execucao.completed_count} de ${execucao.total_count}`, marginX, y);
  y += 8;

  const items = Array.isArray(execucao.items) ? execucao.items : [];
  if (items.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['#', 'Tarefa', 'Status']],
      // Sem símbolos ✓/✗: as fontes padrão do jsPDF (WinAnsi) não têm esses
      // glifos e acabam quebrando o espaçamento do texto. Cor + palavra já
      // deixa o status claro.
      body: items.map((item, i) => [String(i + 1), item.task, item.done ? 'Concluída' : 'Não concluída']),
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 246, 252] },
      styles: { fontSize: 10, cellPadding: 4, textColor: INK },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 34 } },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const done = String(data.cell.raw) === 'Concluída';
          data.cell.styles.textColor = done ? GREEN : RED;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (execucao.free_text_note) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('Observação / registro livre:', marginX, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    const noteLines = doc.splitTextToSize(execucao.free_text_note, pageWidth - marginX * 2);
    doc.text(noteLines, marginX, y);
    y += noteLines.length * 5 + 8;
  }

  if (execucao.photo) {
    const imgFormat = detectImageFormat(execucao.photo);
    const maxW = 90;
    const maxH = 70;
    if (y + maxH > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    try {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text('Evidência fotográfica:', marginX, y);
      y += 5;
      doc.addImage(execucao.photo, imgFormat, marginX, y, maxW, maxH, undefined, 'FAST');
      y += maxH + 6;
    } catch {
      // formato de imagem não suportado pelo jsPDF — segue sem a foto
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `Gerado automaticamente por Cond-Informa em ${new Date().toLocaleString('pt-BR')}`,
    marginX,
    pageHeight - 10,
  );
}

/**
 * Gera um PDF de comunicado — uma página por execução, útil tanto para uma
 * única execução quanto para um período (várias execuções em sequência).
 */
export function generateComunicadoPdf({ condominioName, ambienteName, execucoes }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  execucoes.forEach((execucao, idx) => {
    if (idx > 0) doc.addPage();
    renderExecucaoPage(doc, { condominioName, ambienteName, execucao });
  });
  return doc;
}

export function downloadPdf(doc, filename) {
  doc.save(filename);
}

/**
 * Tenta compartilhar o PDF via Web Share API (funciona com WhatsApp no
 * celular); se o navegador não suportar compartilhamento de arquivos, cai
 * para o download comum.
 */
export async function sharePdf(doc, filename) {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename, text: 'Comunicado gerado pelo Cond-Informa' });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // qualquer outro erro de compartilhamento cai para download
    }
  }
  doc.save(filename);
  return 'downloaded';
}
