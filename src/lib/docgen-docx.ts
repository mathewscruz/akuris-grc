/**
 * DocGen — geração do DOCX a partir do documento estruturado.
 *
 * Usa o AST de `docgen-render.ts`, de modo que negrito, listas e tabelas
 * escritas pela IA viram elementos nativos do Word (e não texto com `**` e `|`).
 */
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  LevelFormat,
  TableOfContents,
  VerticalAlign,
} from 'docx';
import { parseMarkdown, runsToPlain, type InlineRun, type MdNode } from './docgen-render';

import { formatarDiaParaDB } from '@/lib/date-utils';
export interface DocGenDocument {
  titulo?: string;
  versao?: string;
  data_criacao?: string;
  secoes?: Array<{ nome?: string; conteudo?: string }>;
  metadados?: Record<string, any>;
  glossario?: Array<{ termo?: string; definicao?: string }>;
  historico_versoes?: Array<{ versao?: string; data?: string; autor?: string; descricao?: string }>;
  coverage_map?: Array<{ requirement_codigo?: string; requirement_titulo?: string; section_indexes?: number[]; evidencia?: string }>;
}

export interface DocxLabels {
  summary: string;
  section: string;
  versaoText: string;
  emissionDateText: string;
  classificationText: string;
  footerPage: string;
  of: string;
  glossary: string;
  glossaryTerm: string;
  glossaryDefinition: string;
  versionHistory: string;
  versionCol: string;
  dateCol: string;
  authorCol: string;
  descriptionCol: string;
  coverage: string;
  requirementCol: string;
  sectionsCol: string;
  evidenceCol: string;
}

export interface DocxOptions {
  empresaNome: string;
  labels: DocxLabels;
}

/** Largura útil com margens de 1080 twips (0,75") em A4. */
const CONTENT_WIDTH = 9026;
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'D0D5DD' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

function toRuns(runs: InlineRun[], base: { size?: number; color?: string } = {}): TextRun[] {
  const list = runs.length ? runs : [{ text: '' }];
  return list.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        ...(r.code ? { font: 'Consolas' } : {}),
        ...(base.size ? { size: base.size } : {}),
        ...(base.color ? { color: base.color } : {}),
      }),
  );
}

function cell(runs: InlineRun[], width: number, opts: { headerRow?: boolean } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    ...(opts.headerRow ? { shading: { fill: 'EEF1F6', type: ShadingType.CLEAR, color: 'auto' } } : {}),
    children: [
      new Paragraph({
        children: toRuns(
          opts.headerRow ? runs.map((r) => ({ ...r, bold: true })) : runs,
          { size: 20 },
        ),
      }),
    ],
  });
}

function buildTable(header: InlineRun[][], rows: InlineRun[][][]): Table {
  const cols = Math.max(header.length, ...rows.map((r) => r.length), 1);
  const colWidth = Math.floor(CONTENT_WIDTH / cols);
  const widths = Array.from({ length: cols }, () => colWidth);

  const pad = (row: InlineRun[][]) => {
    const copy = row.slice(0, cols);
    while (copy.length < cols) copy.push([{ text: '' }]);
    return copy;
  };

  const tableRows: TableRow[] = [];
  if (header.length) {
    tableRows.push(new TableRow({
      tableHeader: true,
      children: pad(header).map((c, i) => cell(c, widths[i], { headerRow: true })),
    }));
  }
  rows.forEach((r) => {
    tableRows.push(new TableRow({ children: pad(r).map((c, i) => cell(c, widths[i])) }));
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: tableRows,
  });
}

/** Converte o AST de uma seção em elementos docx. */
function renderNodes(nodes: MdNode[], sectionNumber: number): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  let subCount = 0;
  let subSubCount = 0;

  nodes.forEach((node) => {
    switch (node.type) {
      case 'heading': {
        if (node.level === 2) {
          subCount += 1;
          subSubCount = 0;
          out.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            children: toRuns([{ text: `${sectionNumber}.${subCount} `, bold: true }, ...node.runs.map((r) => ({ ...r, bold: true }))]),
          }));
        } else if (node.level === 3) {
          subSubCount += 1;
          out.push(new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
            children: toRuns([
              { text: `${sectionNumber}.${Math.max(subCount, 1)}.${subSubCount} `, bold: true },
              ...node.runs.map((r) => ({ ...r, bold: true })),
            ]),
          }));
        } else {
          out.push(new Paragraph({
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 160, after: 80 },
            children: toRuns(node.runs.map((r) => ({ ...r, bold: true }))),
          }));
        }
        break;
      }
      case 'paragraph':
        out.push(new Paragraph({
          spacing: { after: 140, line: 300 },
          alignment: AlignmentType.JUSTIFIED,
          children: toRuns(node.runs),
        }));
        break;
      case 'quote':
        out.push(new Paragraph({
          spacing: { after: 140, line: 300 },
          indent: { left: 480 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: '7552FF', space: 8 } },
          children: toRuns(node.runs.map((r) => ({ ...r, italic: true }))),
        }));
        break;
      case 'list':
        node.items.forEach((item) => {
          out.push(new Paragraph({
            numbering: { reference: node.ordered ? 'docgen-ordered' : 'docgen-bullets', level: Math.min(item.level, 2) },
            spacing: { after: 80, line: 288 },
            children: toRuns(item.runs),
          }));
        });
        break;
      case 'table':
        out.push(buildTable(node.header, node.rows));
        out.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        break;
    }
  });

  return out;
}

/**
 * O logo é decorativo: se a URL não responder, o documento sai sem ele.
 * Sem este prazo, um `fetch` pendurado (bucket fora do ar, DNS que não
 * responde) trava a exportação para sempre — o utilizador clica em exportar
 * e fica com o spinner na tela indefinidamente.
 */
const LOGO_TIMEOUT_MS = 3000;

async function fetchLogo(url: string): Promise<ArrayBuffer | null> {
  const abortar = new AbortController();
  const prazo = setTimeout(() => abortar.abort(), LOGO_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: abortar.signal });
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(prazo);
  }
}

export async function buildDocGenDocxBlob(doc: DocGenDocument, options: DocxOptions): Promise<Blob> {
  const { empresaNome, labels } = options;
  const titulo = doc.titulo || 'Documento';
  const versao = doc.versao || '1.0';
  const dataCriacao = doc.data_criacao || formatarDiaParaDB(new Date());
  const classificacao = doc.metadados?.classificacao || 'Interno';
  const logoUrl: string | undefined = doc.metadados?.logo_url;
  const logoAltura = parseInt(doc.metadados?.logo_altura || '48', 10);
  const logoPosicao = doc.metadados?.logo_posicao || 'centro';

  const children: Array<Paragraph | Table | TableOfContents> = [];

  // ===== CAPA =====
  if (logoUrl) {
    const buf = await fetchLogo(logoUrl);
    if (buf) {
      children.push(new Paragraph({
        alignment:
          logoPosicao === 'direita' ? AlignmentType.RIGHT
            : logoPosicao === 'esquerda' ? AlignmentType.LEFT
              : AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new ImageRun({ data: buf, transformation: { width: Math.round(logoAltura * 2), height: logoAltura } })],
      }));
    }
  }

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 3200, after: 240 },
    children: [new TextRun({ text: titulo, bold: true, size: 52 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: empresaNome, size: 28, color: '475467' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2400, after: 60 },
    children: [new TextRun({ text: labels.versaoText, size: 22, color: '475467' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: labels.emissionDateText, size: 22, color: '475467' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: labels.classificationText, size: 22, color: '475467' })],
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ===== SUMÁRIO (TOC nativo + fallback textual) =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
    children: [new TextRun({ text: labels.summary, bold: true })],
  }));
  children.push(new TableOfContents(labels.summary, { hyperlink: true, headingStyleRange: '1-3' }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ===== SEÇÕES =====
  (doc.secoes || []).forEach((secao, idx) => {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 160 },
      children: [new TextRun({ text: `${idx + 1}. ${secao.nome || labels.section}`, bold: true })],
    }));
    renderNodes(parseMarkdown(secao.conteudo || ''), idx + 1).forEach((el) => children.push(el));
  });

  let appendixIndex = (doc.secoes || []).length;

  // ===== APÊNDICES =====
  const glossario = (doc.glossario || []).filter((g) => g?.termo);
  if (glossario.length) {
    appendixIndex += 1;
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 160 },
      children: [new TextRun({ text: `${appendixIndex}. ${labels.glossary}`, bold: true })],
    }));
    children.push(buildTable(
      [[{ text: labels.glossaryTerm }], [{ text: labels.glossaryDefinition }]],
      glossario.map((g) => [[{ text: String(g.termo || '') }], [{ text: String(g.definicao || '') }]]),
    ));
  }

  const historico = (doc.historico_versoes || []).filter((h) => h?.versao);
  if (historico.length) {
    appendixIndex += 1;
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 160 },
      children: [new TextRun({ text: `${appendixIndex}. ${labels.versionHistory}`, bold: true })],
    }));
    children.push(buildTable(
      [[{ text: labels.versionCol }], [{ text: labels.dateCol }], [{ text: labels.authorCol }], [{ text: labels.descriptionCol }]],
      historico.map((h) => [
        [{ text: String(h.versao || '') }],
        [{ text: String(h.data || '') }],
        [{ text: String(h.autor || '') }],
        [{ text: String(h.descricao || '') }],
      ]),
    ));
  }

  const coverage = (doc.coverage_map || []).filter((c) => c?.requirement_codigo);
  if (coverage.length) {
    appendixIndex += 1;
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 160 },
      children: [new TextRun({ text: `${appendixIndex}. ${labels.coverage}`, bold: true })],
    }));
    children.push(buildTable(
      [[{ text: labels.requirementCol }], [{ text: labels.sectionsCol }], [{ text: labels.evidenceCol }]],
      coverage.map((c) => [
        [{ text: `${c.requirement_codigo}${c.requirement_titulo ? ` — ${c.requirement_titulo}` : ''}` }],
        [{ text: (c.section_indexes || []).map((i) => String(i + 1)).join(', ') }],
        [{ text: String(c.evidencia || '').slice(0, 300) }],
      ]),
    ));
  }

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `${titulo} · ${classificacao}`, size: 16, color: '98A2B3' })],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${empresaNome} · ${titulo} · v${versao} · ${labels.footerPage} `, size: 16, color: '98A2B3' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '98A2B3' }),
          new TextRun({ text: ` ${labels.of} `, size: 16, color: '98A2B3' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '98A2B3' }),
        ],
      }),
    ],
  });

  const docx = new DocxDocument({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 30, bold: true, font: 'Arial', color: '101828' },
          paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: '101828' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: '344054' },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
        },
        {
          id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: '344054' },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 3 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'docgen-bullets',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ['•', '–', '·'][level],
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
          })),
        },
        {
          reference: 'docgen-ordered',
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
            { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children: children as any,
    }],
  });

  return Packer.toBlob(docx);
}

/** Utilitário exposto para testes/preview: texto plano de uma seção. */
export const sectionPlainText = (conteudo: string): string =>
  parseMarkdown(conteudo).map((n) => ('runs' in n ? runsToPlain(n.runs) : '')).join('\n');
