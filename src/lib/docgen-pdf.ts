/** PDF editorial do DocGen. Usa o mesmo conteúdo estruturado do preview/DOCX. */
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { parseMarkdown, runsToPlain, type InlineRun, type MdNode } from './docgen-render';
import type { DocGenDocument, DocxLabels } from './docgen-docx';

export interface PdfOptions { empresaNome: string; labels: DocxLabels }
const MARGIN = 52;
const TOP = 80;
const FOOTER = 64;
const FONT = 'helvetica';
type Color = [number, number, number];
const INK: Color = [28, 35, 48];
const MUTED: Color = [91, 102, 119];
const ACCENT: Color = [101, 70, 219];
const RULE: Color = [222, 226, 234];

interface Ctx {
  pdf: jsPDF; y: number; width: number; height: number; contentWidth: number; bottom: number;
}
interface TextStyle {
  size: number; indent?: number; width?: number; color?: Color; boldAll?: boolean; leading?: number;
}
interface Fragment { text: string; style: string; font: string; width: number }
type Line = Fragment[];

// Keep Latin accents; normalize separators unsupported by PDF's standard fonts.
function printable(text: string): string {
  return String(text).replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u00ad\ufeff]/g, '');
}
function newPage(ctx: Ctx) { ctx.pdf.addPage(); ctx.y = TOP; }
function ensureSpace(ctx: Ctx, height: number) {
  if (ctx.y > TOP && ctx.y + height > ctx.bottom) newPage(ctx);
}

/** Measure before painting: even long URLs/identifiers wrap without losing text. */
function wrapRuns(pdf: jsPDF, runs: InlineRun[], opts: TextStyle, width: number): Line[] {
  const lines: Line[] = [];
  let line: Line = [];
  let used = 0;
  const flush = () => {
    while (line.length && !line[line.length - 1].text.trim()) line.pop();
    if (line.length) lines.push(line);
    line = []; used = 0;
  };
  pdf.setFontSize(opts.size);
  for (const run of runs) {
    const bold = opts.boldAll || run.bold;
    const style = bold && run.italic ? 'bolditalic' : bold ? 'bold' : run.italic ? 'italic' : 'normal';
    const font = run.code ? 'courier' : FONT;
    pdf.setFont(font, style);
    for (const token of printable(run.text).split(/(\s+)/).filter(Boolean)) {
      const whitespace = !token.trim();
      const text = whitespace ? ' ' : token;
      if (whitespace && !line.length) continue;
      const tokenWidth = pdf.getTextWidth(text);
      if (used + tokenWidth > width && line.length) flush();
      if (whitespace && !line.length) continue;
      if (tokenWidth <= width) {
        line.push({ text, style, font, width: tokenWidth });
        used += tokenWidth;
      } else {
        // Normal words stay intact. Only an overlong token uses character wrapping.
        for (const char of Array.from(text)) {
          const charWidth = pdf.getTextWidth(char);
          if (used + charWidth > width && line.length) flush();
          line.push({ text: char, style, font, width: charWidth });
          used += charWidth;
        }
      }
    }
  }
  flush();
  return lines;
}
function paintLine(ctx: Ctx, line: Line, x: number, y: number, opts: TextStyle) {
  ctx.pdf.setFontSize(opts.size).setTextColor(...(opts.color || INK));
  // Real spans improve PDF text selection, instead of one text object per word.
  const spans: Fragment[] = [];
  for (const part of line) {
    const last = spans[spans.length - 1];
    if (last && last.style === part.style && last.font === part.font) {
      last.text += part.text; last.width += part.width;
    } else spans.push({ ...part });
  }
  for (const span of spans) {
    ctx.pdf.setFont(span.font, span.style).text(span.text, x, y);
    x += span.width;
  }
}
function linesFor(ctx: Ctx, runs: InlineRun[], opts: TextStyle) {
  return wrapRuns(ctx.pdf, runs, opts, opts.width ?? ctx.contentWidth - (opts.indent || 0));
}
function writeRuns(ctx: Ctx, runs: InlineRun[], opts: TextStyle, marker?: string) {
  const lines = linesFor(ctx, runs, opts);
  const leading = opts.leading || opts.size * 1.55;
  let offset = 0;
  while (offset < lines.length) {
    const remaining = lines.length - offset;
    let capacity = Math.floor((ctx.bottom - ctx.y) / leading);
    // A 3-line paragraph must not split 1+2 or 2+1; larger paragraphs
    // leave at least two lines on either side of a page break.
    if (capacity < Math.min(remaining, 2) || (remaining === 3 && capacity === 2)) {
      newPage(ctx);
      capacity = Math.floor((ctx.bottom - ctx.y) / leading);
    }
    let count = Math.min(remaining, capacity);
    if (remaining - count === 1 && count > 2) count -= 1;
    lines.slice(offset, offset + count).forEach((line, i) => {
      if (marker && offset + i === 0) {
        ctx.pdf.setFont(FONT, 'normal').setFontSize(opts.size).setTextColor(...MUTED);
        ctx.pdf.text(marker, MARGIN + (opts.indent || 0) - 8, ctx.y, { align: 'right' });
      }
      paintLine(ctx, line, MARGIN + (opts.indent || 0), ctx.y, opts);
      ctx.y += leading;
    });
    offset += count;
    if (offset < lines.length) newPage(ctx);
  }
}
function renderTable(ctx: Ctx, header: InlineRun[][], rows: InlineRun[][][]) {
  ensureSpace(ctx, 68);
  const columns = Math.max(header.length, ...rows.map(row => row.length), 1);
  const plain = (row: InlineRun[][]) => Array.from({ length: columns }, (_, i) => printable(runsToPlain(row[i] || [])));
  autoTable(ctx.pdf, {
    head: header.length ? [plain(header)] : undefined,
    body: rows.map(plain),
    startY: ctx.y,
    margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: FOOTER },
    styles: {
      font: FONT, fontSize: 9.25, cellPadding: 7, overflow: 'linebreak',
      textColor: INK, lineColor: RULE, lineWidth: 0.35, valign: 'top',
    },
    headStyles: { fillColor: [241, 239, 249], textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    theme: 'grid', showHead: 'everyPage', rowPageBreak: 'avoid',
  });
  const finalY = (ctx.pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  ctx.y = (finalY ?? ctx.y) + 24;
}
function headingIdentity(text: string) {
  return text.replace(/^\s*\d+(?:\.\d+)*[.)]?\s+/, '').trim().toLocaleLowerCase();
}
function sectionTitle(name: string, number: number) {
  // Preserve existing numbering: references inside a policy must not change.
  return /^\s*\d+(?:\.\d+)*[.)]?\s+/.test(name) ? name : number + '. ' + name;
}
function renderNodes(ctx: Ctx, nodes: MdNode[], sectionName: string) {
  nodes.forEach((node, index) => {
    switch (node.type) {
      case 'heading': {
        // Models often repeat the section's title as the first Markdown heading.
        if (index === 0 && headingIdentity(runsToPlain(node.runs)) === headingIdentity(sectionName)) break;
        const opts = { size: node.level === 2 ? 12 : 11, boldAll: true, color: INK };
        ensureSpace(ctx, linesFor(ctx, node.runs, opts).length * opts.size * 1.55 + 50);
        ctx.y += 8;
        writeRuns(ctx, node.runs, opts);
        ctx.y += 4;
        break;
      }
      case 'paragraph':
        writeRuns(ctx, node.runs, { size: 10.5 }); ctx.y += 7; break;
      case 'quote':
        writeRuns(ctx, node.runs.map(run => ({ ...run, italic: true })), { size: 10.5, indent: 18, color: MUTED });
        ctx.y += 9; break;
      case 'list':
        node.items.forEach((item, i) => {
          writeRuns(ctx, item.runs, { size: 10.5, indent: 18 + item.level * 16 }, node.ordered ? (i + 1) + '.' : '•');
          ctx.y += 3;
        });
        ctx.y += 6; break;
      case 'table': renderTable(ctx, node.header, node.rows); break;
    }
  });
}

/** Decorative assets must never prevent downloading the document. */
async function loadLogo(url: string): Promise<Uint8Array | null> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 3000);
  try {
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch { return null; } finally { clearTimeout(timeout); }
}
function fitLabel(pdf: jsPDF, value: string, width: number): string {
  const text = printable(value).replace(/\s+/g, ' ').trim();
  if (pdf.getTextWidth(text) <= width) return text;
  let result = '';
  for (const char of Array.from(text)) {
    if (pdf.getTextWidth(result + char + '...') > width) break;
    result += char;
  }
  return result.trimEnd() + '...';
}
interface Entry {
  title: string; page?: number; targetY?: number;
  placements: Array<{ page: number; y: number; height: number }>;
}

export async function buildDocGenPdfBlob(doc: DocGenDocument, options: PdfOptions): Promise<Blob> {
  const { empresaNome, labels } = options;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', putOnlyUsedFonts: true });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const ctx: Ctx = { pdf, y: TOP, width, height, contentWidth: width - MARGIN * 2, bottom: height - FOOTER };
  const title = doc.titulo?.trim() || 'Documento';
  const classification = String(doc.metadados?.classificacao || 'Interno');
  pdf.setProperties({ title, author: empresaNome, subject: classification, creator: 'Akuris DocGen' });
  pdf.setDisplayMode('fullwidth', 'continuous', 'UseOutlines');

  // Full original title, proportional logo and metadata with measured placement.
  pdf.setFillColor(...ACCENT).rect(0, 0, 7, height, 'F');
  pdf.setFont(FONT, 'bold').setFontSize(9).setTextColor(...MUTED);
  pdf.text('AKURIS / DOCGEN', width - MARGIN, TOP, { align: 'right' });
  if (doc.metadados?.logo_url) {
    const logo = await loadLogo(doc.metadados.logo_url);
    if (logo) {
      try {
        const properties = pdf.getImageProperties(logo);
        const requested = Number.parseFloat(doc.metadados.logo_altura);
        const maxHeight = Number.isFinite(requested) ? Math.min(64, Math.max(24, requested)) : 48;
        const scale = Math.min(180 / properties.width, maxHeight / properties.height);
        pdf.addImage(logo, properties.fileType, MARGIN, 62, properties.width * scale, properties.height * scale);
      } catch { /* Corrupt/unsupported image: keep the document downloadable. */ }
    }
  }
  ctx.y = 168;
  writeRuns(ctx, [{ text: empresaNome }], { size: 12, color: MUTED });
  ctx.y = Math.max(ctx.y + 38, 236);
  let titleSize = 30;
  while (titleSize > 20 && linesFor(ctx, [{ text: title }], { size: titleSize, boldAll: true }).length * titleSize * 1.22 > 300) titleSize -= 1;
  writeRuns(ctx, [{ text: title }], { size: titleSize, boldAll: true, leading: titleSize * 1.22 });
  ctx.y += 22;
  ensureSpace(ctx, 22);
  pdf.setFillColor(...ACCENT).rect(MARGIN, ctx.y, 64, 3, 'F');
  ctx.y += 45;
  const metadata = [labels.versaoText, labels.emissionDateText, labels.classificationText];
  const metaOpts = { size: 10, indent: 18, width: ctx.contentWidth - 36, color: MUTED };
  const metaHeight = metadata.reduce((sum, text) => sum + linesFor(ctx, [{ text }], metaOpts).length * 15.5 + 8, 0) + 24;
  ensureSpace(ctx, metaHeight);
  if (metaHeight < ctx.bottom - TOP) {
    ctx.y = Math.max(ctx.y, ctx.bottom - metaHeight - 25);
    pdf.setFillColor(246, 247, 250).roundedRect(MARGIN, ctx.y - 16, ctx.contentWidth, metaHeight, 5, 5, 'F');
  }
  metadata.forEach(text => { writeRuns(ctx, [{ text }], metaOpts); ctx.y += 8; });

  const sections = doc.secoes || [];
  const glossary = (doc.glossario || []).filter(item => item?.termo);
  const history = (doc.historico_versoes || []).filter(item => item?.versao);
  const coverage = (doc.coverage_map || []).filter(item => item?.requirement_codigo);
  const appendices = [glossary.length ? labels.glossary : '', history.length ? labels.versionHistory : '', coverage.length ? labels.coverage : ''].filter(Boolean);
  const entries: Entry[] = [...sections.map(section => section.nome || labels.section), ...appendices]
    .map((name, i) => ({ title: sectionTitle(name, i + 1), placements: [] }));

  // Reserve the entire TOC first; every row records its own TOC page and target.
  const startSummary = () => {
    newPage(ctx);
    writeRuns(ctx, [{ text: labels.summary }], { size: 24, boldAll: true });
    ctx.y += 20;
  };
  if (entries.length) startSummary();
  const tocStyle = { size: 11, width: ctx.contentWidth - 48, color: INK };
  for (const entry of entries) {
    const lines = linesFor(ctx, [{ text: entry.title }], tocStyle);
    let lineIndex = 0;
    while (lineIndex < lines.length) {
      if (ctx.y + Math.min(lines.length - lineIndex, 2) * 18 + 18 > ctx.bottom) startSummary();
      const startY = ctx.y;
      const capacity = Math.max(1, Math.floor((ctx.bottom - ctx.y - 18) / 18));
      const chunk = lines.slice(lineIndex, lineIndex + capacity);
      chunk.forEach(line => { paintLine(ctx, line, MARGIN, ctx.y, tocStyle); ctx.y += 18; });
      entry.placements.push({ page: pdf.getNumberOfPages(), y: startY, height: chunk.length * 18 });
      pdf.setDrawColor(...RULE).setLineWidth(0.4).line(MARGIN, ctx.y + 2, width - MARGIN, ctx.y + 2);
      ctx.y += 18;
      lineIndex += chunk.length;
    }
  }
  if (entries.length) newPage(ctx);
  let entryIndex = 0;
  const startSection = () => {
    const entry = entries[entryIndex++];
    const opts = { size: 16, boldAll: true, color: INK };
    const titleHeight = linesFor(ctx, [{ text: entry.title }], opts).length * 24.8;
    ensureSpace(ctx, titleHeight + 86);
    if (ctx.y > TOP) ctx.y += 16;
    entry.page = pdf.getNumberOfPages();
    entry.targetY = ctx.y - 16;
    pdf.outline.add(null, printable(entry.title), { pageNumber: entry.page });
    pdf.setDrawColor(...RULE).setLineWidth(0.5).line(MARGIN, ctx.y - 16, width - MARGIN, ctx.y - 16);
    pdf.setDrawColor(...ACCENT).setLineWidth(2).line(MARGIN, ctx.y - 16, MARGIN + 32, ctx.y - 16);
    writeRuns(ctx, [{ text: entry.title }], opts);
    ctx.y += 12;
  };
  sections.forEach(section => {
    startSection();
    renderNodes(ctx, parseMarkdown(section.conteudo || ''), section.nome || labels.section);
  });
  const cells = (values: unknown[]) => values.map(value => [{ text: String(value ?? '') }]);
  if (glossary.length) {
    startSection();
    renderTable(ctx, cells([labels.glossaryTerm, labels.glossaryDefinition]), glossary.map(item => cells([item.termo, item.definicao])));
  }
  if (history.length) {
    startSection();
    renderTable(ctx, cells([labels.versionCol, labels.dateCol, labels.authorCol, labels.descriptionCol]),
      history.map(item => cells([item.versao, item.data, item.autor, item.descricao])));
  }
  if (coverage.length) {
    startSection();
    renderTable(ctx, cells([labels.requirementCol, labels.sectionsCol, labels.evidenceCol]), coverage.map(item => cells([
      item.requirement_codigo + (item.requirement_titulo ? ' - ' + item.requirement_titulo : ''),
      (item.section_indexes || []).map(index => index + 1).join(', '),
      item.evidencia, // Never truncate evidence in an exported record.
    ])));
  }
  for (const entry of entries) {
    for (const placement of entry.placements) {
      pdf.setPage(placement.page);
      pdf.setFont(FONT, 'bold').setFontSize(11).setTextColor(...ACCENT);
      pdf.text(String(entry.page), width - MARGIN, placement.y, { align: 'right' });
      pdf.link(MARGIN, placement.y - 12, ctx.contentWidth, placement.height + 8, { pageNumber: entry.page, top: entry.targetY });
    }
  }

  // Independent columns prevent long titles/names/classifications from colliding.
  // Only these repeated running labels abbreviate; full values remain on the cover.
  const total = pdf.getNumberOfPages();
  for (let page = 2; page <= total; page += 1) {
    pdf.setPage(page);
    pdf.setFont(FONT, 'normal').setFontSize(8.5).setTextColor(...MUTED);
    pdf.text(fitLabel(pdf, title, ctx.contentWidth - 124), MARGIN, 37);
    pdf.text(fitLabel(pdf, classification, 106), width - MARGIN, 37, { align: 'right' });
    pdf.setDrawColor(...RULE).setLineWidth(0.5).line(MARGIN, 49, width - MARGIN, 49);
    pdf.line(MARGIN, height - 46, width - MARGIN, height - 46);
    const footer = [empresaNome, 'v' + (doc.versao || '1.0')].filter(Boolean).join(' / ');
    pdf.text(fitLabel(pdf, footer, ctx.contentWidth - 150), MARGIN, height - 29);
    pdf.text(labels.footerPage + ' ' + page + ' ' + labels.of + ' ' + total, width - MARGIN, height - 29, { align: 'right' });
  }
  return pdf.output('blob');
}
