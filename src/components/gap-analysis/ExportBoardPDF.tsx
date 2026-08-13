import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadAkurisLogo, addAkurisCover, addAkurisHeader, addAkurisFooter, addSectionTitle, drawProgressBar, AKURIS_COLORS } from '@/lib/pdf-utils';
import { getFrameworkConfig, getMaturityLevel } from '@/lib/framework-configs';

interface BoardPDFParams {
  frameworkName: string;
  frameworkVersion: string;
  frameworkType: string;
  overallScore: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  pillarScores: Array<{ pillar: string; name: string; score: number; totalRequirements: number; evaluatedRequirements: number; color: string }>;
  categoryScores: Array<{ category: string; score: number; total: number; evaluated: number }>;
  requirements: Array<{ codigo: string; titulo: string; categoria: string; conformity_status: string; peso: number | null; area_responsavel: string | null }>;
  empresaNome?: string;
  scoreType: 'decimal' | 'percentage';
  maxScore: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale?: string;
}

function getScoreColor(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return AKURIS_COLORS.success;
  if (pct >= 60) return AKURIS_COLORS.primary;
  if (pct >= 40) return AKURIS_COLORS.warning;
  return AKURIS_COLORS.danger;
}

export async function exportBoardPDF(params: BoardPDFParams) {
  const {
    frameworkName, frameworkVersion, frameworkType,
    overallScore, totalRequirements, evaluatedRequirements,
    pillarScores, requirements, empresaNome = '',
    scoreType, maxScore, t, locale
  } = params;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const logo = await loadAkurisLogo();
  const formatScore = (s: number) => scoreType === 'percentage' ? `${s.toFixed(0)}%` : s.toFixed(1);
  const fwConfig = getFrameworkConfig(frameworkName, frameworkType);

  // ========== PAGE 1: COVER ==========
  addAkurisCover(doc, logo, t('fin.pdfBoard.coverTitle', { framework: `${frameworkName} ${frameworkVersion}` }), t('fin.pdfBoard.coverSubtitle'), {
    empresa: empresaNome,
    data: format(new Date(), locale === 'en' ? 'MMMM d, yyyy' : "dd 'de' MMMM 'de' yyyy", locale === 'en' ? undefined : { locale: ptBR })
  });

  // ========== PAGE 2: EXECUTIVE SUMMARY ==========
  doc.addPage();
  let yPos = addAkurisHeader(doc, logo);

  yPos = addSectionTitle(doc, t('fin.pdfBoard.execSummary'), yPos, margin);

  // Score highlight box
  const scoreColor = getScoreColor(overallScore, maxScore);
  doc.setFillColor(AKURIS_COLORS.background);
  doc.setDrawColor(AKURIS_COLORS.border);
  doc.roundedRect(margin, yPos, contentWidth, 45, 3, 3, 'FD');

  // Large score circle
  doc.setFillColor(scoreColor);
  doc.circle(margin + 30, yPos + 22, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(formatScore(overallScore), margin + 30, yPos + 25, { align: 'center' });

  // Score context
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(t('fin.pdfBoard.overallIndex'), margin + 56, yPos + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(AKURIS_COLORS.textLight);
  const progressPct = totalRequirements > 0 ? Math.round((evaluatedRequirements / totalRequirements) * 100) : 0;
  doc.text(t('fin.pdfBoard.evaluatedOf', { avaliados: evaluatedRequirements, total: totalRequirements, pct: progressPct }), margin + 56, yPos + 22);

  // Progress bar
  drawProgressBar(doc, margin + 56, yPos + 26, contentWidth - 66, 6, progressPct, scoreColor);

  // Maturity level
  if (fwConfig) {
    const maturity = getMaturityLevel(overallScore, fwConfig);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(AKURIS_COLORS.primary);
    doc.text(t('fin.pdfBoard.maturity', { nivel: maturity.level, nome: maturity.name }), margin + 56, yPos + 40);
  }
  yPos += 55;

  // Status distribution
  const conforme = requirements.filter(r => r.conformity_status === 'conforme').length;
  const parcial = requirements.filter(r => r.conformity_status === 'parcial').length;
  const naoConforme = requirements.filter(r => r.conformity_status === 'nao_conforme').length;
  const naoAvaliado = requirements.filter(r => r.conformity_status === 'nao_avaliado' || !r.conformity_status).length;
  const naoAplicavel = requirements.filter(r => r.conformity_status === 'nao_aplicavel').length;

  yPos = addSectionTitle(doc, t('fin.pdfBoard.distribution'), yPos, margin);

  const statBoxWidth = contentWidth / 5;
  const stats = [
    { label: t('fin.pdfBoard.conformes'), value: conforme, color: AKURIS_COLORS.success },
    { label: t('fin.pdfBoard.parciais'), value: parcial, color: AKURIS_COLORS.warning },
    { label: t('fin.pdfBoard.naoConformes'), value: naoConforme, color: AKURIS_COLORS.danger },
    { label: t('fin.pdfBoard.naoAvaliados'), value: naoAvaliado, color: AKURIS_COLORS.textLight },
    { label: 'N/A', value: naoAplicavel, color: AKURIS_COLORS.border },
  ];

  stats.forEach((stat, i) => {
    const x = margin + i * statBoxWidth;
    doc.setFillColor(AKURIS_COLORS.background);
    doc.roundedRect(x + 1, yPos, statBoxWidth - 2, 22, 2, 2, 'F');
    // Color bar on top
    doc.setFillColor(stat.color);
    doc.rect(x + 1, yPos, statBoxWidth - 2, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(stat.color);
    doc.text(String(stat.value), x + statBoxWidth / 2, yPos + 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text(stat.label, x + statBoxWidth / 2, yPos + 19, { align: 'center' });
  });
  yPos += 30;

  // Parecer executivo
  yPos = addSectionTitle(doc, t('fin.pdfBoard.opinion'), yPos, margin);
  doc.setFillColor(AKURIS_COLORS.background);
  doc.roundedRect(margin, yPos, contentWidth, 35, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(AKURIS_COLORS.text);

  const scorePct = maxScore > 0 ? (overallScore / maxScore) * 100 : 0;
  let parecer = '';
  if (scorePct >= 80) {
    parecer = t('fin.pdfBoard.parecerAlto', { score: formatScore(overallScore), framework: frameworkName, itens: naoConforme + parcial });
  } else if (scorePct >= 60) {
    parecer = t('fin.pdfBoard.parecerMedio', { score: formatScore(overallScore), framework: frameworkName, nc: naoConforme, parcial });
  } else if (scorePct >= 40) {
    parecer = t('fin.pdfBoard.parecerBaixo', { score: formatScore(overallScore), framework: frameworkName, nc: naoConforme, parcial });
  } else {
    parecer = t('fin.pdfBoard.parecerCritico', { score: formatScore(overallScore), framework: frameworkName });
  }

  const parecerLines = doc.splitTextToSize(parecer, contentWidth - 8);
  doc.text(parecerLines, margin + 4, yPos + 7);
  yPos += 43;

  // ========== PAGE 3: SCORES BY DOMAIN ==========
  doc.addPage();
  yPos = addAkurisHeader(doc, logo);

  yPos = addSectionTitle(doc, t('fin.pdfBoard.byDomain'), yPos, margin);

  if (pillarScores.length > 0) {
    // Horizontal bar chart
    const barHeight = 10;
    const maxBars = Math.min(pillarScores.length, 20);
    const sortedPillars = [...pillarScores].sort((a, b) => a.score - b.score);

    sortedPillars.slice(0, maxBars).forEach((p, i) => {
      if (yPos + barHeight + 4 > pageHeight - 25) {
        doc.addPage();
        yPos = addAkurisHeader(doc, logo);
      }

      const pct = maxScore > 0 ? (p.score / maxScore) * 100 : 0;
      const pColor = getScoreColor(p.score, maxScore);

      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(AKURIS_COLORS.text);
      const nameStr = p.name.length > 45 ? p.name.substring(0, 42) + '...' : p.name;
      doc.text(nameStr, margin, yPos + 4);

      // Bar
      const barY = yPos + 6;
      drawProgressBar(doc, margin, barY, contentWidth - 25, 5, pct, pColor);

      // Score value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(pColor);
      doc.text(formatScore(p.score), margin + contentWidth - 20, barY + 4);

      yPos += barHeight + 5;
    });
  }

  // ========== PAGE 4: TOP NON-CONFORMITIES ==========
  doc.addPage();
  yPos = addAkurisHeader(doc, logo);

  yPos = addSectionTitle(doc, t('fin.pdfBoard.topNc'), yPos, margin);

  const nonCompliant = requirements
    .filter(r => r.conformity_status === 'nao_conforme')
    .sort((a, b) => (b.peso || 1) - (a.peso || 1))
    .slice(0, 10);

  if (nonCompliant.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(AKURIS_COLORS.success);
    doc.text(t('fin.pdfBoard.noNc'), margin, yPos + 5);
    yPos += 15;
  } else {
    // Table header
    doc.setFillColor(AKURIS_COLORS.danger);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor('#FFFFFF');
    doc.text('#', margin + 3, yPos + 5.5);
    doc.text(t('fin.pdfBoard.codigo'), margin + 10, yPos + 5.5);
    doc.text(t('fin.pdfBoard.requisito'), margin + 35, yPos + 5.5);
    doc.text(t('fin.pdfBoard.categoria'), margin + 120, yPos + 5.5);
    doc.text(t('fin.pdfBoard.peso'), margin + contentWidth - 15, yPos + 5.5);
    yPos += 10;

    nonCompliant.forEach((req, i) => {
      if (yPos + 8 > pageHeight - 25) {
        doc.addPage();
        yPos = addAkurisHeader(doc, logo);
      }

      const rowColor = i % 2 === 0 ? '#FFFFFF' : AKURIS_COLORS.background;
      doc.setFillColor(rowColor);
      doc.rect(margin, yPos - 3, contentWidth, 7, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(AKURIS_COLORS.text);
      doc.text(String(i + 1), margin + 3, yPos + 1);
      doc.setTextColor(AKURIS_COLORS.danger);
      doc.text(req.codigo || '', margin + 10, yPos + 1);
      doc.setTextColor(AKURIS_COLORS.text);
      const truncTitle = req.titulo.length > 50 ? req.titulo.substring(0, 47) + '...' : req.titulo;
      doc.text(truncTitle, margin + 35, yPos + 1);
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text((req.categoria || '').substring(0, 18), margin + 120, yPos + 1);
      doc.text(String(req.peso || 1), margin + contentWidth - 12, yPos + 1);
      yPos += 7;
    });
  }

  yPos += 10;

  // Also show top partial
  const partialReqs = requirements
    .filter(r => r.conformity_status === 'parcial')
    .sort((a, b) => (b.peso || 1) - (a.peso || 1))
    .slice(0, 5);

  if (partialReqs.length > 0) {
    if (yPos + 30 > pageHeight - 25) {
      doc.addPage();
      yPos = addAkurisHeader(doc, logo);
    }
    yPos = addSectionTitle(doc, t('fin.pdfBoard.partialItems'), yPos, margin);

    doc.setFillColor(AKURIS_COLORS.warning);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor('#FFFFFF');
    doc.text(t('fin.pdfBoard.codigo'), margin + 3, yPos + 5.5);
    doc.text(t('fin.pdfBoard.requisito'), margin + 28, yPos + 5.5);
    doc.text(t('fin.pdfBoard.categoria'), margin + 120, yPos + 5.5);
    yPos += 10;

    partialReqs.forEach((req, i) => {
      const rowColor = i % 2 === 0 ? '#FFFFFF' : AKURIS_COLORS.background;
      doc.setFillColor(rowColor);
      doc.rect(margin, yPos - 3, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(AKURIS_COLORS.warning);
      doc.text(req.codigo || '', margin + 3, yPos + 1);
      doc.setTextColor(AKURIS_COLORS.text);
      const truncTitle = req.titulo.length > 55 ? req.titulo.substring(0, 52) + '...' : req.titulo;
      doc.text(truncTitle, margin + 28, yPos + 1);
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text((req.categoria || '').substring(0, 18), margin + 120, yPos + 1);
      yPos += 7;
    });
  }

  // ========== PAGE 5: STRATEGIC RECOMMENDATIONS ==========
  doc.addPage();
  yPos = addAkurisHeader(doc, logo);

  yPos = addSectionTitle(doc, t('fin.pdfBoard.recs'), yPos, margin);

  const recommendations: string[] = [];

  if (naoConforme > 0) {
    recommendations.push(t('fin.pdfBoard.rec1', { nc: naoConforme }));
  }
  if (parcial > 0) {
    recommendations.push(t('fin.pdfBoard.rec2', { n: recommendations.length + 1, parcial }));
  }
  if (naoAvaliado > 0) {
    recommendations.push(t('fin.pdfBoard.rec3', { n: recommendations.length + 1, na: naoAvaliado }));
  }

  // Domain-specific recommendations
  const weakDomains = [...pillarScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .filter(p => p.score < maxScore * 0.6);

  if (weakDomains.length > 0) {
    recommendations.push(t('fin.pdfBoard.rec4', { n: recommendations.length + 1, dominios: weakDomains.map(d => d.name.substring(0, 30)).join(', ') }));
  }

  recommendations.push(t('fin.pdfBoard.rec5', { n: recommendations.length + 1 }));
  recommendations.push(t('fin.pdfBoard.rec6', { n: recommendations.length + 1 }));
  recommendations.push(t('fin.pdfBoard.rec7', { n: recommendations.length + 1 }));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(AKURIS_COLORS.text);

  recommendations.forEach(rec => {
    if (yPos + 15 > pageHeight - 25) {
      doc.addPage();
      yPos = addAkurisHeader(doc, logo);
    }
    const lines = doc.splitTextToSize(rec, contentWidth - 8);
    doc.setFillColor(AKURIS_COLORS.background);
    const boxH = lines.length * 5 + 6;
    doc.roundedRect(margin, yPos, contentWidth, boxH, 2, 2, 'F');
    doc.setFillColor(AKURIS_COLORS.primary);
    doc.rect(margin, yPos, 3, boxH, 'F');
    doc.text(lines, margin + 7, yPos + 5);
    yPos += boxH + 4;
  });

  // Next steps box
  yPos += 5;
  if (yPos + 30 > pageHeight - 25) {
    doc.addPage();
    yPos = addAkurisHeader(doc, logo);
  }
  yPos = addSectionTitle(doc, t('fin.pdfBoard.nextSteps'), yPos, margin);
  doc.setFillColor(AKURIS_COLORS.background);
  doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(AKURIS_COLORS.text);
  const nextSteps = t('fin.pdfBoard.nextStepsText');
  const nsLines = doc.splitTextToSize(nextSteps, contentWidth - 8);
  doc.text(nsLines, margin + 4, yPos + 6);

  // Footer
  addAkurisFooter(doc);

  const fileName = `Board_${frameworkName.replace(/[\/\\:]/g, '_')}_${empresaNome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
