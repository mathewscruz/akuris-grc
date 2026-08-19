/**
 * DocGen — geração do PDF a partir do documento estruturado.
 *
 * Compartilha o AST de `docgen-render.ts` com o DOCX e o preview, de modo que
 * negrito inline, listas e tabelas saem formatados (e não como markdown cru).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseMarkdown, runsToPlain, type InlineRun, type MdNode } from './docgen-render';
import type { DocGenDocument, DocxLabels } from './docgen-docx';

import { formatarDiaParaDB } from '@/lib/date-utils';
export interface PdfOptions {
  empresaNome: string;
  labels: DocxLabels;
}

const MARGIN_X = 56;
const FONT = 'helvetica';

interface Ctx {
  pdf: jsPDF;
  y: number;
  pageWidth: number;
  pageHeight: number;
  maxWidth: number;
  bottom: number;
}

function newPage(ctx: Ctx) {
  ctx.pdf.addPage();
  ctx.y = 64;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > ctx.bottom) newPage(ctx);
}

/** Escreve runs com negrito/itálico inline, quebrando por largura. */
function writeRuns(ctx: Ctx, runs: InlineRun[], opts: { size: number; indent?: number; color?: [number, number, number]; boldAll?: boolean }) {
  const indent = opts.indent || 0;
  const startX = MARGIN_X + indent;
  const maxWidth = ctx.maxWidth - indent;
  const lineHeight = opts.size * 1.45;
  let x = startX;

  ctx.pdf.setFontSize(opts.size);
  ctx.pdf.setTextColor(...(opts.color || [32, 38, 48]));

  ensureSpace(ctx, lineHeight);

  runs.forEach((run) => {
    const bold = opts.boldAll || run.bold;
    const style = bold && run.italic ? 'bolditalic' : bold ? 'bold' : run.italic ? 'italic' : 'normal';
    ctx.pdf.setFont(run.code ? 'courier' : FONT, run.code && style === 'bolditalic' ? 'bold' : style);

    const words = run.text.split(/(\s+)/).filter((w) => w !== '');
    words.forEach((word) => {
      const w = ctx.pdf.getTextWidth(word);
      if (x + w > startX + maxWidth && word.trim()) {
        x = startX;
        ctx.y += lineHeight;
        ensureSpace(ctx, lineHeight);
      }
      if (x === startX && !word.trim()) return; // não inicia linha com espaço
      ctx.pdf.text(word, x, ctx.y);
      x += w;
    });
  });

  ctx.y += lineHeight;
  ctx.pdf.setFont(FONT, 'normal');
  ctx.pdf.setTextColor(32, 38, 48);
}

function renderTable(ctx: Ctx, header: InlineRun[][], rows: InlineRun[][][]) {
  const head = header.length ? [header.map((h) => runsToPlain(h))] : undefined;
  const body = rows.map((r) => r.map((c) => runsToPlain(c)));
  autoTable(ctx.pdf, {
    head,
    body,
    startY: ctx.y + 4,
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: { font: FONT, fontSize: 9, cellPadding: 5, lineColor: [208, 213, 221], lineWidth: 0.5, textColor: [32, 38, 48] },
    headStyles: { fillColor: [238, 241, 246], textColor: [16, 24, 40], fontStyle: 'bold' },
    theme: 'grid',
  });
  const finalY = (ctx.pdf as any).lastAutoTable?.finalY;
  ctx.y = (typeof finalY === 'number' ? finalY : ctx.y) + 16;
}

function renderNodes(ctx: Ctx, nodes: MdNode[], sectionNumber: number) {
  let subCount = 0;
  let subSubCount = 0;

  nodes.forEach((node) => {
    switch (node.type) {
      case 'heading': {
        ensureSpace(ctx, 46);
        ctx.y += 6;
        if (node.level === 2) {
          subCount += 1;
          subSubCount = 0;
          writeRuns(ctx, [{ text: `${sectionNumber}.${subCount} ${runsToPlain(node.runs)}` }], { size: 12, boldAll: true, color: [16, 24, 40] });
        } else if (node.level === 3) {
          subSubCount += 1;
          writeRuns(ctx, [{ text: `${sectionNumber}.${Math.max(subCount, 1)}.${subSubCount} ${runsToPlain(node.runs)}` }], { size: 11, boldAll: true, color: [52, 64, 84] });
        } else {
          writeRuns(ctx, node.runs, { size: 10.5, boldAll: true, color: [52, 64, 84] });
        }
        ctx.y += 2;
        break;
      }
      case 'paragraph':
        writeRuns(ctx, node.runs, { size: 10 });
        ctx.y += 4;
        break;
      case 'quote':
        writeRuns(ctx, node.runs.map((r) => ({ ...r, italic: true })), { size: 10, indent: 18, color: [71, 84, 103] });
        ctx.y += 4;
        break;
      case 'list':
        node.items.forEach((item, i) => {
          const marker = node.ordered ? `${i + 1}.` : ['•', '–', '·'][Math.min(item.level, 2)];
          writeRuns(ctx, [{ text: `${marker} ` }, ...item.runs], { size: 10, indent: 14 + item.level * 14 });
        });
        ctx.y += 6;
        break;
      case 'table':
        renderTable(ctx, node.header, node.rows);
        break;
    }
  });
}

/** Mesmo prazo do DOCX: logo é decorativo, não pode pendurar a exportação. */
const LOGO_TIMEOUT_MS = 3000;

async function logoDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const abortar = new AbortController();
  const prazo = setTimeout(() => abortar.abort(), LOGO_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: abortar.signal });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('logo'));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format: blob.type.includes('png') ? 'PNG' : 'JPEG' };
  } catch {
    return null;
  } finally {
    clearTimeout(prazo);
  }
}

export async function buildDocGenPdfBlob(doc: DocGenDocument, options: PdfOptions): Promise<Blob> {
  const { empresaNome, labels } = options;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const ctx: Ctx = {
    pdf,
    y: 64,
    pageWidth,
    pageHeight,
    maxWidth: pageWidth - MARGIN_X * 2,
    bottom: pageHeight - 72,
  };

  const titulo = doc.titulo || 'Documento';
  const versao = doc.versao || '1.0';
  const dataCriacao = doc.data_criacao || formatarDiaParaDB(new Date());
  const classificacao = doc.metadados?.classificacao || 'Interno';
  const logoUrl: string | undefined = doc.metadados?.logo_url;
  const logoAltura = parseInt(doc.metadados?.logo_altura || '48', 10);

  // ===== CAPA =====
  if (logoUrl) {
    const logo = await logoDataUrl(logoUrl);
    if (logo) {
      const logoW = Math.round(logoAltura * 2);
      pdf.addImage(logo.dataUrl, logo.format, (pageWidth - logoW) / 2, 96, logoW, logoAltura);
    }
  }
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(16, 24, 40);
  const tituloLines = pdf.splitTextToSize(titulo, ctx.maxWidth);
  let capaY = pageHeight / 2 - 40;
  tituloLines.forEach((line: string) => {
    pdf.text(line, pageWidth / 2, capaY, { align: 'center' });
    capaY += 30;
  });
  pdf.setDrawColor(117, 82, 255);
  pdf.setLineWidth(2);
  pdf.line(pageWidth / 2 - 40, capaY + 6, pageWidth / 2 + 40, capaY + 6);
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(71, 84, 103);
  pdf.text(empresaNome, pageWidth / 2, capaY + 34, { align: 'center' });
  pdf.setFontSize(10.5);
  pdf.text(labels.versaoText, pageWidth / 2, pageHeight - 160, { align: 'center' });
  pdf.text(labels.emissionDateText, pageWidth / 2, pageHeight - 144, { align: 'center' });
  pdf.text(labels.classificationText, pageWidth / 2, pageHeight - 128, { align: 'center' });

  // ===== SUMÁRIO (páginas preenchidas no fim) =====
  pdf.addPage();
  const tocPage = pdf.getNumberOfPages();
  ctx.y = 64;
  writeRuns(ctx, [{ text: labels.summary }], { size: 16, boldAll: true, color: [16, 24, 40] });
  ctx.y += 8;

  const tocEntries: Array<{ label: string; y: number; page?: number }> = [];
  const secoes = doc.secoes || [];
  secoes.forEach((s, i) => {
    ensureSpace(ctx, 18);
    const label = `${i + 1}. ${s.nome || labels.section}`;
    tocEntries.push({ label, y: ctx.y });
    writeRuns(ctx, [{ text: label }], { size: 10.5, color: [52, 64, 84] });
  });

  const appendixTitles: string[] = [];
  const glossario = (doc.glossario || []).filter((g) => g?.termo);
  const historico = (doc.historico_versoes || []).filter((h) => h?.versao);
  const coverage = (doc.coverage_map || []).filter((c) => c?.requirement_codigo);
  if (glossario.length) appendixTitles.push(labels.glossary);
  if (historico.length) appendixTitles.push(labels.versionHistory);
  if (coverage.length) appendixTitles.push(labels.coverage);
  appendixTitles.forEach((titleText, i) => {
    ensureSpace(ctx, 18);
    const label = `${secoes.length + i + 1}. ${titleText}`;
    tocEntries.push({ label, y: ctx.y });
    writeRuns(ctx, [{ text: label }], { size: 10.5, color: [52, 64, 84] });
  });

  // ===== SEÇÕES =====
  let entryIdx = 0;
  secoes.forEach((secao, idx) => {
    pdf.addPage();
    ctx.y = 64;
    tocEntries[entryIdx] && (tocEntries[entryIdx].page = pdf.getNumberOfPages());
    entryIdx += 1;
    writeRuns(ctx, [{ text: `${idx + 1}. ${secao.nome || labels.section}` }], { size: 15, boldAll: true, color: [16, 24, 40] });
    pdf.setDrawColor(117, 82, 255);
    pdf.setLineWidth(1.5);
    pdf.line(MARGIN_X, ctx.y - 6, MARGIN_X + 48, ctx.y - 6);
    ctx.y += 10;
    renderNodes(ctx, parseMarkdown(secao.conteudo || ''), idx + 1);
  });

  const startAppendix = (titleText: string, number: number) => {
    pdf.addPage();
    ctx.y = 64;
    tocEntries[entryIdx] && (tocEntries[entryIdx].page = pdf.getNumberOfPages());
    entryIdx += 1;
    writeRuns(ctx, [{ text: `${number}. ${titleText}` }], { size: 15, boldAll: true, color: [16, 24, 40] });
    ctx.y += 6;
  };

  let appendixNumber = secoes.length;
  if (glossario.length) {
    appendixNumber += 1;
    startAppendix(labels.glossary, appendixNumber);
    renderTable(
      ctx,
      [[{ text: labels.glossaryTerm }], [{ text: labels.glossaryDefinition }]],
      glossario.map((g) => [[{ text: String(g.termo || '') }], [{ text: String(g.definicao || '') }]]),
    );
  }
  if (historico.length) {
    appendixNumber += 1;
    startAppendix(labels.versionHistory, appendixNumber);
    renderTable(
      ctx,
      [[{ text: labels.versionCol }], [{ text: labels.dateCol }], [{ text: labels.authorCol }], [{ text: labels.descriptionCol }]],
      historico.map((h) => [
        [{ text: String(h.versao || '') }],
        [{ text: String(h.data || '') }],
        [{ text: String(h.autor || '') }],
        [{ text: String(h.descricao || '') }],
      ]),
    );
  }
  if (coverage.length) {
    appendixNumber += 1;
    startAppendix(labels.coverage, appendixNumber);
    renderTable(
      ctx,
      [[{ text: labels.requirementCol }], [{ text: labels.sectionsCol }], [{ text: labels.evidenceCol }]],
      coverage.map((c) => [
        [{ text: `${c.requirement_codigo}${c.requirement_titulo ? ` — ${c.requirement_titulo}` : ''}` }],
        [{ text: (c.section_indexes || []).map((i) => String(i + 1)).join(', ') }],
        [{ text: String(c.evidencia || '').slice(0, 240) }],
      ]),
    );
  }

  // ===== Números de página no sumário =====
  pdf.setPage(tocPage);
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(52, 64, 84);
  tocEntries.forEach((entry) => {
    if (!entry.page) return;
    pdf.text(String(entry.page), pageWidth - MARGIN_X, entry.y, { align: 'right' });
  });

  // ===== Cabeçalho e rodapé em todas as páginas (menos a capa) =====
  const total = pdf.getNumberOfPages();
  for (let p = 2; p <= total; p += 1) {
    pdf.setPage(p);
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(152, 162, 179);
    pdf.text(`${titulo} · ${classificacao}`, pageWidth - MARGIN_X, 36, { align: 'right' });
    pdf.text(
      `${empresaNome} · v${versao} · ${labels.footerPage} ${p} ${labels.of} ${total}`,
      pageWidth / 2,
      pageHeight - 32,
      { align: 'center' },
    );
    pdf.setDrawColor(233, 236, 241);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN_X, 44, pageWidth - MARGIN_X, 44);
  }

  return pdf.output('blob');
}
