/**
 * PacoteAuditoriaPDF — entrega pronta para terceiros (item 5 do plano
 * "menos interações").
 *
 * Um clique na página do framework gera o PDF que o auditor pede: capa,
 * resumo executivo, a situação de cada requisito com a contagem de
 * evidências ligadas e os planos de ação ainda abertos.
 *
 * Os dados são os mesmos já mostrados na tela — nenhum número inventado,
 * nenhum dado de outra empresa (tudo filtrado por `empresa_id`).
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import {
  loadAkurisLogo,
  addAkurisCover,
  addAkurisHeader,
  addAkurisFooter,
  addSectionTitle,
  drawTableHeader,
  formatLabel,
  AKURIS_COLORS,
} from '@/lib/pdf-utils';
import { tGlobal } from '@/lib/i18n-global';
import { dateFnsLocale } from '@/lib/date-utils';

export interface PacoteRequisito {
  codigo: string;
  titulo: string;
  categoria: string;
  conformity_status: string;
  evidencias: number;
}

export interface PacotePlano {
  titulo: string;
  responsavel: string;
  prazo: string | null;
  prioridade: string;
  status: string;
}

export interface PacoteAuditoriaParams {
  frameworkName: string;
  frameworkVersion: string;
  empresaNome: string;
  overallScore: number;
  requisitos: PacoteRequisito[];
  planosAbertos: PacotePlano[];
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

export async function exportPacoteAuditoriaPDF(params: PacoteAuditoriaParams) {
  const { frameworkName, frameworkVersion, empresaNome, overallScore, requisitos, planosAbertos } = params;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const logo = await loadAkurisLogo();

  let yPos = 0;
  const checkPage = (space: number = 20) => {
    if (yPos + space > pageHeight - 25) {
      doc.addPage();
      yPos = addAkurisHeader(doc, logo);
    }
  };

  // === CAPA ===
  addAkurisCover(
    doc,
    logo,
    `${tGlobal('pacoteAuditoria.titulo')}\n${frameworkName} ${frameworkVersion}`,
    tGlobal('pacoteAuditoria.subtitulo'),
    {
      empresa: empresaNome,
      data: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: dateFnsLocale() }),
    },
  );

  // === RESUMO ===
  doc.addPage();
  yPos = addAkurisHeader(doc, logo);
  yPos = addSectionTitle(doc, tGlobal('pacoteAuditoria.resumo'), yPos, margin);

  const contagens = {
    conforme: requisitos.filter((r) => r.conformity_status === 'conforme').length,
    parcial: requisitos.filter((r) => r.conformity_status === 'parcial').length,
    naoConforme: requisitos.filter((r) => r.conformity_status === 'nao_conforme').length,
    naoAvaliado: requisitos.filter((r) => r.conformity_status === 'nao_avaliado').length,
  };
  const comEvidencia = requisitos.filter((r) => r.evidencias > 0).length;

  doc.setFillColor(AKURIS_COLORS.background);
  doc.setDrawColor(AKURIS_COLORS.border);
  doc.roundedRect(margin, yPos, contentWidth, 30, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.text(`${overallScore.toFixed(0)}%`, margin + 8, yPos + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(AKURIS_COLORS.textLight);
  doc.text(
    tGlobal('sweepRiscos.gap.pdf.conformesParciaisNaoConformes', {
      conforme: contagens.conforme,
      parcial: contagens.parcial,
      naoConforme: contagens.naoConforme,
    }),
    margin + 8,
    yPos + 21,
  );
  doc.text(
    `${tGlobal('pacoteAuditoria.colEvidencias')}: ${comEvidencia}/${requisitos.length} · ${tGlobal('pacoteAuditoria.secPlanos')}: ${planosAbertos.length}`,
    margin + 8,
    yPos + 27,
  );
  yPos += 40;

  // === REQUISITOS ===
  yPos = addSectionTitle(doc, tGlobal('pacoteAuditoria.secRequisitos'), yPos, margin);
  const colX = {
    codigo: margin,
    titulo: margin + 24,
    status: margin + 128,
    evidencias: margin + 158,
  };
  drawTableHeader(doc, [
    { text: tGlobal('pacoteAuditoria.colCodigo'), x: colX.codigo },
    { text: tGlobal('pacoteAuditoria.colTitulo'), x: colX.titulo },
    { text: tGlobal('pacoteAuditoria.colStatus'), x: colX.status },
    { text: tGlobal('pacoteAuditoria.colEvidencias'), x: colX.evidencias },
  ], yPos, margin, contentWidth);
  yPos += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const req of requisitos) {
    checkPage(8);
    doc.setTextColor(AKURIS_COLORS.text);
    doc.text(req.codigo || '—', colX.codigo, yPos);
    const titulo = doc.splitTextToSize(req.titulo, 100);
    doc.text(titulo[0], colX.titulo, yPos);
    doc.text(statusLabel(req.conformity_status), colX.status, yPos);
    doc.text(req.evidencias > 0 ? String(req.evidencias) : tGlobal('pacoteAuditoria.evidenciasNone'), colX.evidencias, yPos);
    yPos += 5.5;
    doc.setDrawColor(AKURIS_COLORS.border);
    doc.setLineWidth(0.1);
    doc.line(margin, yPos - 2, margin + contentWidth, yPos - 2);
  }

  // === PLANOS EM ABERTO ===
  checkPage(30);
  yPos += 6;
  yPos = addSectionTitle(doc, tGlobal('pacoteAuditoria.secPlanos'), yPos, margin);

  if (planosAbertos.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text(tGlobal('pacoteAuditoria.semplans') || tGlobal('pacoteAuditoria.semPlanos'), margin, yPos);
    yPos += 8;
  } else {
    const planoX = {
      titulo: margin,
      responsavel: margin + 84,
      prazo: margin + 122,
      prioridade: margin + 148,
    };
    drawTableHeader(doc, [
      { text: tGlobal('pacoteAuditoria.colPlano'), x: planoX.titulo },
      { text: tGlobal('pacoteAuditoria.colResponsavel'), x: planoX.responsavel },
      { text: tGlobal('pacoteAuditoria.colPrazo'), x: planoX.prazo },
      { text: tGlobal('pacoteAuditoria.colPrioridade'), x: planoX.prioridade },
    ], yPos, margin, contentWidth);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const plano of planosAbertos) {
      checkPage(8);
      doc.setTextColor(AKURIS_COLORS.text);
      const titulo = doc.splitTextToSize(plano.titulo, 80);
      doc.text(titulo[0], planoX.titulo, yPos);
      doc.text(plano.responsavel || '—', planoX.responsavel, yPos);
      doc.text(plano.prazo ? format(new Date(plano.prazo), 'dd/MM/yyyy') : '—', planoX.prazo, yPos);
      doc.text(formatLabel(plano.prioridade || ''), planoX.prioridade, yPos);
      yPos += 5.5;
      doc.setDrawColor(AKURIS_COLORS.border);
      doc.setLineWidth(0.1);
      doc.line(margin, yPos - 2, margin + contentWidth, yPos - 2);
    }
  }

  addAkurisFooter(doc);
  const nomeArquivo = `pacote-auditoria-${frameworkName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}
