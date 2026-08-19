import jsPDF from 'jspdf';
import type { AdherenceAssessment, PontoForte, PontoMelhoria } from './types';
import { format } from 'date-fns';
import { ptBR, type Locale } from 'date-fns/locale';
import { logger } from '@/lib/logger';
import { datePattern } from '@/lib/date-utils';

export async function exportAssessmentToPDF(
  assessment: AdherenceAssessment, 
  details?: any[],
  empresaLogoUrl?: string,
  t: (key: string, params?: Record<string, string | number>) => string = (key: string) => key,
  dateLocale: Locale = ptBR
) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 50;
  const marginY = 50;
  const contentWidth = pageWidth - 2 * marginX;
  let y = marginY;

  // Cores Executivas (tons neutros e profissionais)
  const colors = {
    primary: [31, 41, 55] as [number, number, number],      // Cinza escuro
    secondary: [107, 114, 128] as [number, number, number], // Cinza médio
    light: [156, 163, 175] as [number, number, number],     // Cinza claro
    success: [75, 85, 99] as [number, number, number],      // Cinza escuro (substitui verde)
    warning: [107, 114, 128] as [number, number, number],   // Cinza médio (substitui amarelo)
    error: [75, 85, 99] as [number, number, number],        // Cinza escuro (substitui vermelho)
    border: [229, 231, 235] as [number, number, number],    // Cinza muito claro
    highlight: [243, 244, 246] as [number, number, number], // Background cinza suave
  };

  // Helper para adicionar nova página se necessário
  const checkAddPage = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - marginY - 30) {
      pdf.addPage();
      y = marginY;
      return true;
    }
    return false;
  };

  // Helper para adicionar seção com título
  const addSection = (title: string, spacing = 20) => {
    checkAddPage(50);
    y += spacing;
    pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    pdf.setLineWidth(2);
    pdf.line(marginX, y, marginX + 60, y);
    y += 12;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.text(title, marginX, y);
    y += 15;
  };

  // Helper para carregar e adicionar logo
  const loadLogo = (): Promise<void> => {
    return new Promise((resolve) => {
      const logoUrl = empresaLogoUrl || '/akuris-logo.png';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const logoWidth = 120;
          const logoHeight = (img.height / img.width) * logoWidth;
          const logoX = (pageWidth - logoWidth) / 2;
          const logoY = 40;
          
          pdf.addImage(img, 'PNG', logoX, logoY, logoWidth, logoHeight);
          y = logoY + logoHeight + 20;
        } catch (error) {
          logger.error('Erro ao adicionar logo:', { error: error instanceof Error ? error.message : String(error) });
          y = 50;
        }
        resolve();
      };
      
      img.onerror = () => {
        logger.error('Erro ao carregar logo');
        y = 50;
        resolve();
      };
      
      img.src = logoUrl;
    });
  };

  // Carregar logo
  await loadLogo();

  // ========== CAPA EXECUTIVA ==========
  pdf.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.rect(0, y, pageWidth, 180 - (y - marginY), 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  const titleY = y + 50;
  pdf.text(t('gapAnalysis.adherenceUi.exportPdf.reportTitle'), pageWidth / 2, titleY, { align: 'center' });
  pdf.text(t('gapAnalysis.adherenceUi.exportPdf.reportTitleLine2'), pageWidth / 2, titleY + 30, { align: 'center' });
  
  y = 230;

  // Box com informações gerais
  const boxHeight = 120;
  checkAddPage(boxHeight + 40);
  pdf.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
  pdf.rect(marginX, y, contentWidth, boxHeight, 'F');
  pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  pdf.setLineWidth(1);
  pdf.rect(marginX, y, contentWidth, boxHeight, 'S');
  
  y += 25;
  pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(assessment.nome_analise, marginX + 20, y);
  
  y += 25;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  pdf.text(t('gapAnalysis.adherenceUi.exportPdf.frameworkLabel', { name: assessment.framework_nome, version: assessment.framework_versao || '' }), marginX + 20, y);
  
  y += 20;
  pdf.text(t('gapAnalysis.adherenceUi.exportPdf.documentLabel', { doc: assessment.documento_nome }), marginX + 20, y);
  
  y += 20;
  pdf.text(
    t('gapAnalysis.adherenceUi.exportPdf.dateLabel', { date: format(new Date(assessment.created_at), "dd 'de' MMMM 'de' yyyy", { locale: dateLocale }) }),
    marginX + 20,
    y
  );
  
  y += boxHeight - 65 + 20;

  // ========== RESULTADO GERAL ==========
  addSection(t('gapAnalysis.adherenceUi.exportPdf.execSummary'), 20);
  
  const resultLabel = assessment.resultado_geral === 'conforme' 
    ? t('gapAnalysis.adherenceUi.exportPdf.resultConforme') 
    : assessment.resultado_geral === 'nao_conforme' 
    ? t('gapAnalysis.adherenceUi.exportPdf.resultNaoConforme') 
    : t('gapAnalysis.adherenceUi.exportPdf.resultParcial');

  const resultBoxHeight = 90;
  checkAddPage(resultBoxHeight + 20);
  pdf.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
  pdf.rect(marginX, y, contentWidth, resultBoxHeight, 'F');
  pdf.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.setLineWidth(2);
  pdf.rect(marginX, y, contentWidth, resultBoxHeight, 'S');
  
  y += 30;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  pdf.text(t('gapAnalysis.adherenceUi.exportPdf.resultLabel'), marginX + 20, y);
  
  y += 25;
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  pdf.text(resultLabel, marginX + 20, y);
  
  pdf.setFontSize(32);
  pdf.text(`${assessment.percentual_conformidade}%`, contentWidth + marginX - 80, y);
  
  y += resultBoxHeight - 55 + 20;

  // Distribuição de Requisitos
  if (details && details.length > 0) {
    const distribuicao = {
      conforme: details.filter((d: any) => d.status_aderencia === 'conforme').length,
      parcial: details.filter((d: any) => d.status_aderencia === 'parcial').length,
      nao_conforme: details.filter((d: any) => d.status_aderencia === 'nao_conforme').length,
      nao_aplicavel: details.filter((d: any) => d.status_aderencia === 'nao_aplicavel').length,
    };

    y += 15;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    pdf.text(t('gapAnalysis.adherenceUi.exportPdf.distributionTitle'), marginX, y);
    y += 25;

    // Grid de estatísticas
    const statBoxWidth = (contentWidth - 30) / 4;
    const statBoxHeight = 70;
    const stats = [
      { label: t('gapAnalysis.adherenceUi.exportPdf.statConforme'), value: distribuicao.conforme, color: colors.success },
      { label: t('gapAnalysis.adherenceUi.exportPdf.statParcial'), value: distribuicao.parcial, color: colors.warning },
      { label: t('gapAnalysis.adherenceUi.exportPdf.statNaoConforme'), value: distribuicao.nao_conforme, color: colors.error },
      { label: t('gapAnalysis.adherenceUi.exportPdf.statNaoAplicavel'), value: distribuicao.nao_aplicavel, color: colors.light },
    ];

    stats.forEach((stat, index) => {
      const x = marginX + (statBoxWidth + 10) * index;
      
      pdf.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
      pdf.rect(x, y, statBoxWidth, statBoxHeight, 'F');
      pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      pdf.setLineWidth(1);
      pdf.rect(x, y, statBoxWidth, statBoxHeight, 'S');
      
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
      pdf.text(stat.value.toString(), x + statBoxWidth / 2, y + 35, { align: 'center' });
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      pdf.text(stat.label, x + statBoxWidth / 2, y + 55, { align: 'center' });
    });
    
    y += statBoxHeight + 30;
  }

  // ========== PONTOS FORTES ==========
  if (assessment.pontos_fortes && assessment.pontos_fortes.length > 0) {
    addSection(t('gapAnalysis.adherenceUi.exportPdf.strongPointsTitle', { count: assessment.pontos_fortes.length }));
    
    assessment.pontos_fortes.forEach((ponto: PontoForte, index: number) => {
      checkAddPage(70);
      
      pdf.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
      const boxStartY = y;
      const boxHeight = 60;
      pdf.rect(marginX, boxStartY, contentWidth, boxHeight, 'F');
      pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      pdf.setLineWidth(0.5);
      pdf.rect(marginX, boxStartY, contentWidth, boxHeight, 'S');
      
      y += 20;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text(`${index + 1}. ${ponto.titulo}`, marginX + 15, y);
      
      y += 18;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      const descLines = pdf.splitTextToSize(ponto.descricao, contentWidth - 30);
      descLines.slice(0, 2).forEach((line: string) => {
        pdf.text(line, marginX + 15, y);
        y += 12;
      });
      
      y = boxStartY + boxHeight + 10;
    });
    y += 10;
  }

  // ========== PONTOS DE MELHORIA ==========
  if (assessment.pontos_melhoria && assessment.pontos_melhoria.length > 0) {
    addSection(t('gapAnalysis.adherenceUi.exportPdf.improvementPointsTitle', { count: assessment.pontos_melhoria.length }));
    
    assessment.pontos_melhoria.forEach((ponto: PontoMelhoria, index: number) => {
      checkAddPage(75);
      
      const prioridadeColor: [number, number, number] = 
        ponto.prioridade === 'alta' ? colors.primary :
        ponto.prioridade === 'media' ? colors.secondary :
        colors.light;
      
      pdf.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
      const boxStartY = y;
      const boxHeight = 65;
      pdf.rect(marginX, boxStartY, contentWidth, boxHeight, 'F');
      pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      pdf.setLineWidth(0.5);
      pdf.rect(marginX, boxStartY, contentWidth, boxHeight, 'S');
      
      pdf.setFillColor(prioridadeColor[0], prioridadeColor[1], prioridadeColor[2]);
      pdf.rect(marginX, boxStartY, 4, boxHeight, 'F');
      
      y += 20;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text(`${index + 1}. ${ponto.titulo}`, marginX + 15, y);
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(prioridadeColor[0], prioridadeColor[1], prioridadeColor[2]);
      pdf.text(`[${ponto.prioridade.toUpperCase()}]`, contentWidth + marginX - 60, y);
      
      y += 18;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      const descLines = pdf.splitTextToSize(ponto.descricao, contentWidth - 30);
      descLines.slice(0, 2).forEach((line: string) => {
        pdf.text(line, marginX + 15, y);
        y += 12;
      });
      
      y = boxStartY + boxHeight + 10;
    });
    y += 10;
  }

  // ========== RECOMENDAÇÕES ==========
  if (assessment.recomendacoes && assessment.recomendacoes.length > 0) {
    addSection(t('gapAnalysis.adherenceUi.exportPdf.recommendationsTitle'));
    
    assessment.recomendacoes.forEach((rec: string) => {
      checkAddPage(35);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      
      pdf.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      pdf.circle(marginX + 5, y - 3, 2, 'F');
      
      const lines = pdf.splitTextToSize(rec, contentWidth - 20);
      lines.forEach((line: string) => {
        pdf.text(line, marginX + 15, y);
        y += 14;
      });
      
      y += 8;
    });
    y += 5;
  }

  // ========== ANÁLISE DETALHADA ==========
  if (assessment.analise_detalhada) {
    pdf.addPage();
    y = marginY;
    addSection(t('gapAnalysis.adherenceUi.exportPdf.fullAnalysisTitle'), 0);
    y += 10;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    const lines = pdf.splitTextToSize(assessment.analise_detalhada, contentWidth);
    lines.forEach((line: string) => {
      checkAddPage(12);
      pdf.text(line, marginX, y);
      y += 12;
    });
    y += 20;
  }

  // ========== ANÁLISE POR REQUISITO ==========
  if (details && details.length > 0) {
    pdf.addPage();
    y = marginY;
    addSection(t('gapAnalysis.adherenceUi.exportPdf.byRequirementTitle'), 0);
    y += 15;

    details.forEach((detail: any) => {
      checkAddPage(110);
      
      const statusColor: [number, number, number] = 
        detail.status_aderencia === 'conforme' ? colors.success :
        detail.status_aderencia === 'nao_conforme' ? colors.error :
        detail.status_aderencia === 'parcial' ? colors.warning :
        colors.light;

      pdf.setFillColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
      const boxStartY = y;
      const boxHeight = 95;
      pdf.rect(marginX, boxStartY, contentWidth, boxHeight, 'F');
      pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
      pdf.setLineWidth(0.5);
      pdf.rect(marginX, boxStartY, contentWidth, boxHeight, 'S');
      
      pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      pdf.rect(marginX, boxStartY, 3, boxHeight, 'F');
      
      y += 18;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text(`${detail.requisito_codigo}`, marginX + 12, y);
      
      pdf.setFont('helvetica', 'normal');
      const titleLines = pdf.splitTextToSize(detail.requisito_titulo, contentWidth - 100);
      pdf.text(titleLines[0], marginX + 80, y);
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      const statusText = detail.status_aderencia.toUpperCase().replace('_', ' ');
      pdf.text(statusText, contentWidth + marginX - 80, y);
      
      y += 18;
      
      if (detail.score_conformidade !== null) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        pdf.text(t('gapAnalysis.adherenceUi.exportPdf.scoreLabel', { score: detail.score_conformidade }), marginX + 12, y);
        y += 15;
      }
      
      if (detail.evidencias_encontradas) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.text(t('gapAnalysis.adherenceUi.exportPdf.evidenceLabel'), marginX + 12, y);
        y += 12;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        const evidLines = pdf.splitTextToSize(detail.evidencias_encontradas, contentWidth - 30);
        pdf.text(evidLines.slice(0, 1)[0], marginX + 12, y);
        y += 12;
      }
      
      if (detail.gaps_especificos) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        pdf.text(t('gapAnalysis.adherenceUi.exportPdf.gapsLabel'), marginX + 12, y);
        y += 12;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        const gapLines = pdf.splitTextToSize(detail.gaps_especificos, contentWidth - 30);
        pdf.text(gapLines.slice(0, 1)[0], marginX + 12, y);
      }
      
      y = boxStartY + boxHeight + 12;
    });
  }

  // ========== RODAPÉ ==========
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    pdf.setLineWidth(0.5);
    pdf.line(marginX, pageHeight - 35, pageWidth - marginX, pageHeight - 35);
    
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.light[0], colors.light[1], colors.light[2]);
    pdf.text(t('gapAnalysis.adherenceUi.exportPdf.pageFooter', { current: i, total: totalPages }), marginX, pageHeight - 20);
    pdf.text(
      t('gapAnalysis.adherenceUi.exportPdf.generatedOn', { date: format(new Date(), `${datePattern()} HH:mm`, { locale: dateLocale }) }),
      pageWidth - marginX,
      pageHeight - 20,
      { align: 'right' }
    );
    pdf.text(
      t('gapAnalysis.adherenceUi.exportPdf.footerTitle'),
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );
  }

  // Salvar PDF
  const fileName = `${assessment.nome_analise.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  pdf.save(fileName);
}
