import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { loadAkurisLogo, addAkurisCover, addAkurisHeader, addAkurisFooter, AKURIS_COLORS } from '@/lib/pdf-utils';
import { tGlobal } from '@/lib/i18n-global';
import { dateFnsLocale } from '@/lib/date-utils';

interface SoAItem {
  codigo: string;
  titulo: string;
  categoria: string;
  aplicavel: boolean;
  justificativa: string;
  conformity_status: string;
  responsavel: string | null;
  evidencias_count: number;
}

interface SoAStats {
  total: number;
  aplicavel: number;
  naoAplicavel: number;
  conforme: number;
  parcial: number;
  naoConforme: number;
  naoAvaliado: number;
}

interface ExportSoAPDFParams {
  frameworkName: string;
  frameworkVersion: string;
  empresaNome: string;
  items: SoAItem[];
  stats: SoAStats;
}

function getStatusLabels(): Record<string, string> {
  return {
    conforme: tGlobal('sweepRiscos.gap.statusLabels.conforme'),
    parcial: tGlobal('sweepRiscos.gap.statusLabels.parcial'),
    nao_conforme: tGlobal('sweepRiscos.gap.statusLabels.naoConforme'),
    nao_aplicavel: tGlobal('sweepRiscos.gap.statusLabels.na'),
    nao_avaliado: tGlobal('sweepRiscos.gap.statusLabels.naoAvaliado'),
  };
}

export async function exportSoAPDF(params: ExportSoAPDFParams) {
  const { frameworkName, frameworkVersion, empresaNome, items, stats } = params;
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const logo = await loadAkurisLogo();
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;

  // Cover
  addAkurisCover(
    doc,
    logo,
    tGlobal('sweepRiscos.gap.pdf.soaDeclaracao'),
    `${frameworkName} ${frameworkVersion}`,
    { empresa: empresaNome, data: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: dateFnsLocale() }) }
  );

  // Summary page
  doc.addPage('a4', 'landscape');
  let yPos = addAkurisHeader(doc, logo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(tGlobal('sweepRiscos.gap.pdf.soaResumo'), margin, yPos + 8);
  yPos += 16;

  // Stats boxes
  const boxWidth = contentWidth / 4;
  const statItems = [
    { label: tGlobal('sweepRiscos.gap.pdf.soaTotal'), value: String(stats.total), color: AKURIS_COLORS.text },
    { label: tGlobal('sweepRiscos.gap.pdf.soaAplicaveis'), value: String(stats.aplicavel), color: AKURIS_COLORS.primary },
    { label: tGlobal('sweepRiscos.gap.pdf.soaNaoAplicaveis'), value: String(stats.naoAplicavel), color: AKURIS_COLORS.textLight },
    { label: tGlobal('sweepRiscos.gap.pdf.soaConformes'), value: String(stats.conforme), color: AKURIS_COLORS.success },
  ];

  statItems.forEach((stat, i) => {
    const x = margin + i * boxWidth;
    doc.setFillColor(AKURIS_COLORS.background);
    doc.roundedRect(x, yPos, boxWidth - 4, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text(stat.label, x + 4, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(stat.color);
    doc.text(stat.value, x + 4, yPos + 14);
  });
  yPos += 26;

  // Table header
  const colWidths = [22, 80, 22, 30, 35, 15, contentWidth - 204];
  const headers = [
    tGlobal('sweepRiscos.gap.pdf.colCodigo'),
    tGlobal('sweepRiscos.gap.pdf.colRequisito'),
    tGlobal('sweepRiscos.gap.pdf.soaColAplic'),
    tGlobal('sweepRiscos.gap.pdf.colStatus'),
    tGlobal('sweepRiscos.gap.pdf.soaColResponsavel'),
    tGlobal('sweepRiscos.gap.pdf.soaColEvid'),
    tGlobal('sweepRiscos.gap.pdf.soaColJustificativa'),
  ];

  const drawHeader = (y: number) => {
    doc.setFillColor(AKURIS_COLORS.primary);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#FFFFFF');
    let xPos = margin + 2;
    headers.forEach((h, i) => {
      doc.text(h, xPos, y + 5.5);
      xPos += colWidths[i];
    });
    return y + 10;
  };

  yPos = drawHeader(yPos);

  // Table rows
  items.forEach((item, idx) => {
    if (yPos > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage('a4', 'landscape');
      yPos = addAkurisHeader(doc, logo);
      yPos = drawHeader(yPos);
    }

    const rowColor = idx % 2 === 0 ? '#FFFFFF' : AKURIS_COLORS.background;
    doc.setFillColor(rowColor);
    doc.rect(margin, yPos - 3, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(AKURIS_COLORS.text);

    let xPos = margin + 2;
    doc.text(item.codigo.substring(0, 12), xPos, yPos + 1);
    xPos += colWidths[0];

    // O titulo tambem quebra em vez de cortar: um nome de controlo cortado
    // aos 47 caracteres deixa o auditor sem saber de que controlo se trata.
    doc.text(doc.splitTextToSize(item.titulo, colWidths[1] - 4), xPos, yPos + 1);
    xPos += colWidths[1];

    doc.text(item.aplicavel ? tGlobal('sweepRiscos.gap.pdf.soaSim') : tGlobal('sweepRiscos.gap.pdf.soaNao'), xPos, yPos + 1);
    xPos += colWidths[2];

    doc.text(getStatusLabels()[item.conformity_status] || item.conformity_status, xPos, yPos + 1);
    xPos += colWidths[3];

    doc.text((item.responsavel || '-').substring(0, 20), xPos, yPos + 1);
    xPos += colWidths[4];

    doc.text(String(item.evidencias_count), xPos, yPos + 1);
    xPos += colWidths[5];

    /*
      A justificativa cabe inteira, e a linha cresce com ela.

      Estava `substring(0, 40)`. As justificativas que o assistente de escopo
      redige tem 400 a 900 caracteres, portanto sairiam como "A organizacao nao
      ocupa nem controla q" — sem reticencias sequer. E este e' o documento que
      o auditor de ISO 27001 abre PRIMEIRO: quanto melhor o texto redigido,
      mais se perdia.

      `splitTextToSize` ja e' usado no ExportFrameworkPDF, no mesmo directorio.
    */
    const linhasJust = doc.splitTextToSize(item.justificativa || '-', colWidths[6] - 4);
    doc.text(linhasJust, xPos, yPos + 1);

    // A altura da linha passa a ser a da celula mais alta, senao o texto de uma
    // invade a seguinte.
    const alturaLinha = Math.max(7, linhasJust.length * 3 + 4);
    yPos += alturaLinha;
  });

  // Footer on all pages
  addAkurisFooter(doc);

  doc.save(`SoA_${frameworkName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}
