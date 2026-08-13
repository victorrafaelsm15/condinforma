import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Mesma paleta institucional do comunicado.js (src/lib/comunicado.js) —
// mantém os dois PDFs do produto com a mesma identidade visual.
const BLUE = [51, 85, 232];
const INK = [16, 20, 44];
const MUTED = [91, 97, 120];

function renderHeader(doc, { escopoLabel, periodoLabel }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;

  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('COND-INFORMA', marginX, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Relatório de operação', marginX, 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(escopoLabel, pageWidth - marginX, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(periodoLabel, pageWidth - marginX, 19, { align: 'right' });

  return 40;
}

function renderFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `Gerado automaticamente por Cond-Informa em ${new Date().toLocaleString('pt-BR')}`,
    14,
    pageHeight - 10,
  );
}

/**
 * Gera o PDF de Relatórios — indicadores, ranking de ambientes, ranking
 * de itens de checklist e a série de execuções que compõe o gráfico
 * (como tabela, já que desenhar o gráfico em si no PDF não agrega nada
 * que os números já não digam).
 */
export function generateRelatorioPdf({
  escopoLabel,
  periodoLabel,
  execucoesIndicators,
  ocorrenciasIndicators,
  itemsIndicators,
  ambienteRanking,
  itemRanking,
  series,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 14;
  let y = renderHeader(doc, { escopoLabel, periodoLabel });

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Indicadores do período', marginX, y);
  y += 8;

  const taxaConclusao = itemsIndicators.total_itens
    ? Math.round((itemsIndicators.concluidos / itemsIndicators.total_itens) * 100)
    : null;
  const tempoMedio = ocorrenciasIndicators.tempo_medio_resolucao_horas;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'plain',
    body: [
      ['Total de execuções', String(execucoesIndicators.total_execucoes)],
      ['Taxa de conclusão de itens do checklist', taxaConclusao != null ? `${taxaConclusao}%` : '—'],
      ['Ocorrências abertas no período', String(ocorrenciasIndicators.abertas)],
      ['Ocorrências resolvidas no período', String(ocorrenciasIndicators.resolvidas)],
      ['Tempo médio de resolução', tempoMedio != null ? `${tempoMedio.toFixed(1)}h` : 'Sem dados suficientes'],
    ],
    styles: { fontSize: 10.5, cellPadding: 3, textColor: INK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
  });
  y = doc.lastAutoTable.finalY + 12;

  if (series?.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Execuções ao longo do período', marginX, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Data', 'Execuções']],
      body: series.map((s) => [new Date(s.bucket_date).toLocaleDateString('pt-BR'), String(s.total)]),
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 246, 252] },
      styles: { fontSize: 9.5, cellPadding: 3, textColor: INK },
      columnStyles: { 1: { halign: 'center', cellWidth: 40 } },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Ambientes com mais ocorrências', marginX, y);
  y += 6;
  if (ambienteRanking?.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Ambiente', 'Condomínio', 'Ocorrências']],
      body: ambienteRanking.map((r) => [r.ambiente_name, r.condominio_name, String(r.total)]),
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 246, 252] },
      styles: { fontSize: 9.5, cellPadding: 3, textColor: INK },
      columnStyles: { 2: { halign: 'center', cellWidth: 30 } },
    });
    y = doc.lastAutoTable.finalY + 12;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text('Nenhuma ocorrência registrada no período.', marginX, y);
    y += 12;
  }

  if (y > 230) { doc.addPage(); y = 20; }
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Itens de checklist mais problemáticos', marginX, y);
  y += 6;
  if (itemRanking?.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Tarefa', 'Ambiente', 'Ocorrências']],
      body: itemRanking.map((r) => [r.task, r.ambiente_name, String(r.total)]),
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 246, 252] },
      styles: { fontSize: 9.5, cellPadding: 3, textColor: INK },
      columnStyles: { 2: { halign: 'center', cellWidth: 30 } },
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text('Nenhuma ocorrência vinculada a um item de checklist no período.', marginX, y);
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    renderFooter(doc);
  }

  return doc;
}
