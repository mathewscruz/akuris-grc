import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { loadAkurisLogo, addAkurisCover, addAkurisHeader, addAkurisFooter, addSectionTitle, drawProgressBar, drawTableHeader, formatLabel, AKURIS_COLORS } from '@/lib/pdf-utils';
import { getFrameworkConfig, getMaturityLevel } from '@/lib/framework-configs';
import { tGlobal } from '@/lib/i18n-global';
import { dateFnsLocale } from '@/lib/date-utils';

interface PillarScore {
  pillar: string;
  name: string;
  score: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  color: string;
}

interface CategoryScore {
  category: string;
  score: number;
  total: number;
  evaluated: number;
}

interface RequirementExport {
  codigo: string;
  titulo: string;
  categoria: string;
  conformity_status: string;
  peso: number | null;
  area_responsavel: string | null;
}

interface ExportFrameworkPDFParams {
  frameworkName: string;
  frameworkVersion: string;
  frameworkType: string;
  overallScore: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  pillarScores: PillarScore[];
  categoryScores: CategoryScore[];
  requirements: RequirementExport[];
  empresaNome?: string;
  maxScore: number;
}

function getScoreColor(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return AKURIS_COLORS.success;
  if (pct >= 60) return AKURIS_COLORS.primary;
  if (pct >= 40) return AKURIS_COLORS.warning;
  return AKURIS_COLORS.danger;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    conforme: tGlobal('sweepRiscos.gap.statusLabels.conforme'),
    parcial: tGlobal('sweepRiscos.gap.statusLabels.parcial'),
    nao_conforme: tGlobal('sweepRiscos.gap.statusLabels.naoConforme'),
    nao_aplicavel: tGlobal('sweepRiscos.gap.statusLabels.na'),
    nao_avaliado: tGlobal('sweepRiscos.gap.statusLabels.naoAvaliado'),
  };
  return map[status] || formatLabel(status);
}

export async function exportFrameworkPDF(params: ExportFrameworkPDFParams) {
  const {
    frameworkName, frameworkVersion, frameworkType,
    overallScore, totalRequirements, evaluatedRequirements,
    pillarScores, categoryScores, requirements,
    empresaNome = tGlobal('sweepRiscos.gap.pdf.empresaPadrao'), maxScore
  } = params;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Load logo
  const logo = await loadAkurisLogo();

  const checkPage = (space: number = 20) => {
    if (yPos + space > pageHeight - 25) {
      doc.addPage();
      yPos = addAkurisHeader(doc, logo);
    }
  };

  const formatScore = (s: number) => `${s.toFixed(0)}%`;
  const formattedType = formatLabel(frameworkType);

  // === COVER PAGE ===
  addAkurisCover(doc, logo, `${tGlobal('sweepRiscos.gap.pdf.relatorioConformidade')}\n${frameworkName} ${frameworkVersion}`, tGlobal('sweepRiscos.gap.pdf.tipoLabel', { tipo: formattedType }), {
    empresa: empresaNome,
    data: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: dateFnsLocale() })
  });

  // === PAGE 2: Score Overview ===
  doc.addPage();
  let yPos = addAkurisHeader(doc, logo);

  // Info box removed — data already on cover page

  // === SCORE GERAL ===
  yPos = addSectionTitle(doc, tGlobal('sweepRiscos.gap.pdf.resultadoGeral'), yPos, margin);
  const scoreColor = getScoreColor(overallScore, maxScore);

  doc.setFillColor(AKURIS_COLORS.background);
  doc.setDrawColor(AKURIS_COLORS.border);
  doc.roundedRect(margin, yPos, contentWidth, 35, 2, 2, 'FD');

  // Score circle
  doc.setFillColor(scoreColor);
  doc.circle(margin + 22, yPos + 17.5, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(formatScore(overallScore), margin + 22, yPos + 20, { align: 'center' });

  // Progress text
  const progressPct = totalRequirements > 0 ? Math.round((evaluatedRequirements / totalRequirements) * 100) : 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(tGlobal('sweepRiscos.gap.pdf.requisitosAvaliadosPct', { evaluated: evaluatedRequirements, total: totalRequirements, pct: progressPct }), margin + 42, yPos + 11);

  // Progress bar
  drawProgressBar(doc, margin + 42, yPos + 16, contentWidth - 52, 5, progressPct, scoreColor);

  // Non-compliant + partial counts
  const nonCompliant = requirements.filter(r => r.conformity_status === 'nao_conforme').length;
  const partial = requirements.filter(r => r.conformity_status === 'parcial').length;
  const conforme = requirements.filter(r => r.conformity_status === 'conforme').length;

  doc.setFontSize(9);
  doc.setTextColor(AKURIS_COLORS.textLight);
  doc.text(tGlobal('sweepRiscos.gap.pdf.conformesParciaisNaoConformes', { conforme, parcial: partial, naoConforme: nonCompliant }), margin + 42, yPos + 30);
  yPos += 43;

  // === MATURITY LEVEL ===
  const fwConfig = getFrameworkConfig(frameworkName, frameworkType);
  if (fwConfig) {
    const maturity = getMaturityLevel(overallScore, fwConfig);
    doc.setFillColor(AKURIS_COLORS.background);
    doc.setDrawColor(AKURIS_COLORS.border);
    doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(AKURIS_COLORS.primary);
    doc.text(tGlobal('sweepRiscos.gap.pdf.nivelMaturidade', { level: maturity.level, name: maturity.name }), margin + 4, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text(maturity.description, margin + 4, yPos + 11);
    yPos += 20;
  }

  // === SCORES POR CATEGORIA (with bar charts) ===
  if (pillarScores.length > 0) {
    yPos = addSectionTitle(doc, tGlobal('sweepRiscos.gap.pdf.pontuacaoCategoria'), yPos, margin);

    pillarScores.forEach(p => {
      checkPage(14);
      const pct = maxScore > 0 ? (p.score / maxScore) * 100 : 0;
      const pColor = getScoreColor(p.score, maxScore);

      // Name
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(AKURIS_COLORS.text);
      const nameStr = p.name.length > 50 ? p.name.substring(0, 50) + '...' : p.name;
      doc.text(nameStr, margin, yPos);

      // Score value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(pColor);
      doc.text(formatScore(p.score), margin + contentWidth - 15, yPos);

      // Bar
      drawProgressBar(doc, margin, yPos + 2, contentWidth - 20, 3, pct, pColor);

      // Count
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text(`${p.evaluatedRequirements}/${p.totalRequirements}`, margin + contentWidth, yPos + 4, { align: 'right' });

      yPos += 11;
    });
    yPos += 5;
  }

  // === ITENS NÃO CONFORMES ===
  const nonCompliantReqs = requirements.filter(r => r.conformity_status === 'nao_conforme' || r.conformity_status === 'parcial');
  if (nonCompliantReqs.length > 0) {
    checkPage(30);
    yPos = addSectionTitle(doc, tGlobal('sweepRiscos.gap.pdf.itensAtencao'), yPos, margin);

    drawTableHeader(doc, [
      { text: tGlobal('sweepRiscos.gap.pdf.colCodigo'), x: margin + 2 },
      { text: tGlobal('sweepRiscos.gap.pdf.colRequisito'), x: margin + 25 },
      { text: tGlobal('sweepRiscos.gap.pdf.colCategoria'), x: margin + 110 },
      { text: tGlobal('sweepRiscos.gap.pdf.colStatus'), x: margin + 145 },
    ], yPos, margin, contentWidth);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    nonCompliantReqs.forEach((req, i) => {
      checkPage(7);

      // Zebra striping
      if (i % 2 === 0) {
        doc.setFillColor(248, 247, 255);
        doc.rect(margin, yPos - 3.5, contentWidth, 5.5, 'F');
      }

      doc.setFontSize(7);
      doc.setTextColor(AKURIS_COLORS.primary);
      doc.text(req.codigo || '', margin + 2, yPos);
      doc.setTextColor(AKURIS_COLORS.text);
      const tl = doc.splitTextToSize(req.titulo, 80);
      doc.text(tl[0], margin + 25, yPos);
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text((req.categoria || '').substring(0, 20), margin + 110, yPos);
      doc.setTextColor(req.conformity_status === 'nao_conforme' ? AKURIS_COLORS.danger : AKURIS_COLORS.warning);
      doc.text(statusLabel(req.conformity_status), margin + 145, yPos);
      yPos += 5.5;
    });
    yPos += 5;
  }

  // === TODOS OS REQUISITOS ===
  checkPage(30);
  yPos = addSectionTitle(doc, tGlobal('sweepRiscos.gap.pdf.todosRequisitos'), yPos, margin);

  drawTableHeader(doc, [
    { text: tGlobal('sweepRiscos.gap.pdf.colCodigo'), x: margin + 2 },
    { text: tGlobal('sweepRiscos.gap.pdf.colRequisito'), x: margin + 25 },
    { text: tGlobal('sweepRiscos.gap.pdf.colStatus'), x: margin + 140 },
  ], yPos, margin, contentWidth);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  requirements.forEach((req, i) => {
    checkPage(6);

    // Zebra striping
    if (i % 2 === 0) {
      doc.setFillColor(248, 247, 255);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, yPos - 3.5, contentWidth, 5, 'F');

    doc.setFontSize(7);
    doc.setTextColor(AKURIS_COLORS.primary);
    doc.text(req.codigo || '', margin + 2, yPos);
    doc.setTextColor(AKURIS_COLORS.text);
    const tl = doc.splitTextToSize(req.titulo, 110);
    doc.text(tl[0], margin + 25, yPos);

    const sc = req.conformity_status === 'conforme' ? AKURIS_COLORS.success
      : req.conformity_status === 'nao_conforme' ? AKURIS_COLORS.danger
      : req.conformity_status === 'parcial' ? AKURIS_COLORS.warning
      : AKURIS_COLORS.textLight;
    doc.setTextColor(sc);
    doc.text(statusLabel(req.conformity_status), margin + 140, yPos);
    yPos += 5;
  });

  // Add footer to all pages (skip cover page)
  addAkurisFooter(doc);

  const fileName = `${frameworkName.replace(/[\/\\:]/g, '_')}_${empresaNome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
