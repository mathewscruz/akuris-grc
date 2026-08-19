import { jsPDF } from 'jspdf';
import { RiscosStats } from '@/hooks/useRiscosStats';
import { loadAkurisLogo, addAkurisHeader, addAkurisFooter, addSectionTitle, drawProgressBar, drawTableHeader, formatLabel, AKURIS_COLORS } from '@/lib/pdf-utils';
import { riscosDialogs } from '@/i18n/modules/riscos-dialogs';
import type { Locale } from '@/contexts/LanguageContext';
import { intlLocale } from '@/lib/date-utils';

interface RiscoExport {
  nome: string;
  categoria?: { nome: string };
  nivel_risco_inicial: string;
  nivel_risco_residual?: string;
  status: string;
  /** Estado derivado dos tratamentos — o mesmo que a tabela mostra. */
  status_efetivo?: string;
  responsavel_nome?: string;
  data_proxima_revisao?: string;
}

export async function exportRiscosPDF(riscos: RiscoExport[], stats: RiscosStats | undefined, locale: Locale = 'pt') {
  const t = riscosDialogs[locale].riscosDialogs.exportPdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const logo = await loadAkurisLogo();
  let y = addAkurisHeader(doc, logo);

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(t.relatorioTitulo, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(AKURIS_COLORS.textLight);
  doc.text(t.geradoEm.replace('{data}', new Date().toLocaleDateString(intlLocale())).replace('{hora}', new Date().toLocaleTimeString('pt-BR')), pageWidth / 2, y, { align: 'center' });
  y += 12;

  // KPIs
  if (stats) {
    y = addSectionTitle(doc, t.resumoExecutivo, y, margin);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(AKURIS_COLORS.text);
    const kpis = [
      t.totalRiscos.replace('{total}', String(stats.total)),
      t.kpiNiveis.replace('{criticos}', String(stats.criticos)).replace('{altos}', String(stats.altos)).replace('{medios}', String(stats.medios)).replace('{baixos}', String(stats.baixos)),
      t.kpiAceitosTratados.replace('{aceitos}', String(stats.aceitos)).replace('{tratados}', String(stats.tratados)),
      t.kpiTratamentos.replace('{concluidos}', String(stats.tratamentos_concluidos)).replace('{andamento}', String(stats.tratamentos_andamento)).replace('{pendentes}', String(stats.tratamentos_pendentes)),
      t.kpiScore.replace('{score}', String(stats.scoreAtual)),
    ];
    kpis.forEach(kpi => {
      doc.text(kpi, margin + 8, y);
      y += 6;
    });

    // Score bar
    y += 2;
    drawProgressBar(doc, margin + 8, y, contentWidth - 16, 5, stats.scoreAtual, AKURIS_COLORS.primary);
    y += 12;
  }

  // Table
  y = addSectionTitle(doc, t.listaRiscos, y, margin);

  drawTableHeader(doc, [
    { text: t.colNome, x: margin + 2 },
    { text: t.colCategoria, x: margin + 62 },
    { text: t.colNivel, x: margin + 102 },
    { text: t.colResidual, x: margin + 125 },
    { text: t.colStatus, x: margin + 150 },
  ], y, margin, contentWidth);
  y += 5;

  doc.setFont('helvetica', 'normal');
  riscos.forEach((risco, i) => {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = addAkurisHeader(doc, logo);
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 247, 255);
      doc.rect(margin, y - 3.5, contentWidth, 5.5, 'F');
    }

    doc.setFontSize(7);
    doc.setTextColor(AKURIS_COLORS.text);
    doc.text(risco.nome.substring(0, 30), margin + 2, y);
    doc.text(risco.categoria?.nome?.substring(0, 20) || '-', margin + 62, y);
    // A coluna "Nível Inicial" recebia o residual: as duas colunas de nível
    // saíam iguais e a severidade inerente perdia-se no ficheiro.
    doc.text(formatLabel(risco.nivel_risco_inicial) || '-', margin + 102, y);
    doc.text(formatLabel(risco.nivel_risco_residual || '') || '-', margin + 125, y);
    // `status` é o que alguém escreveu; `status_efetivo` é o que os tratamentos
    // dizem. O ecrã mostra o segundo e o ficheiro imprimia o primeiro.
    doc.text(formatLabel(risco.status_efetivo ?? risco.status) || '-', margin + 150, y);
    y += 5.5;
  });

  addAkurisFooter(doc);
  doc.save('relatorio-riscos.pdf');
}

export function exportRiscosCSV(riscos: RiscoExport[], locale: Locale = 'pt') {
  const t = riscosDialogs[locale].riscosDialogs.exportPdf;
  const headers = [t.csvColNome, t.csvColCategoria, t.csvColNivelInicial, t.csvColNivelResidual, t.csvColStatus, t.csvColResponsavel, t.csvColProximaRevisao];
  const rows = riscos.map(r => [
    r.nome,
    r.categoria?.nome || '',
    formatLabel(r.nivel_risco_inicial),
    formatLabel(r.nivel_risco_residual || ''),
    formatLabel(r.status_efetivo ?? r.status),
    r.responsavel_nome || '',
    r.data_proxima_revisao || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `riscos-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
