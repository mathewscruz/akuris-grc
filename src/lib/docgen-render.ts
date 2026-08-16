/**
 * DocGen — parser de markdown (subset) para um AST único.
 *
 * A IA escreve o conteúdo das seções em markdown simples. Antes desta camada,
 * o preview, o DOCX e o PDF tratavam o texto como linhas cruas: `**negrito**`,
 * `- item` e tabelas `| a | b |` saíam literalmente no arquivo final.
 *
 * Este módulo converte esse markdown num AST enxuto que alimenta os três
 * destinos (preview, DOCX, PDF), garantindo que o que o usuário vê na tela é
 * exatamente o que sai no documento.
 *
 * Subset suportado (o mesmo declarado no prompt do docgen-chat):
 *   ## / ### / #### títulos
 *   - * • listas com marcador (com aninhamento por indentação)
 *   1. listas numeradas
 *   | a | b |  tabelas GFM (com linha separadora)
 *   > citação
 *   **negrito**, *itálico*, `código`
 */

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export interface HeadingNode {
  type: 'heading';
  /** 2 = subtítulo dentro da seção, 3/4 = níveis inferiores */
  level: 2 | 3 | 4;
  runs: InlineRun[];
}

export interface ParagraphNode {
  type: 'paragraph';
  runs: InlineRun[];
}

export interface QuoteNode {
  type: 'quote';
  runs: InlineRun[];
}

export interface ListItem {
  /** 0 = primeiro nível */
  level: number;
  runs: InlineRun[];
}

export interface ListNode {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface TableNode {
  type: 'table';
  header: InlineRun[][];
  rows: InlineRun[][][];
}

export type MdNode = HeadingNode | ParagraphNode | QuoteNode | ListNode | TableNode;

const BULLET_RE = /^(\s*)[-*•]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

/** Uma linha é candidata a linha de tabela quando tem ao menos dois pipes. */
function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes('|') && (trimmed.match(/\|/g) || []).length >= 2;
}

function splitTableRow(line: string): string[] {
  let raw = line.trim();
  if (raw.startsWith('|')) raw = raw.slice(1);
  if (raw.endsWith('|')) raw = raw.slice(0, -1);
  return raw.split('|').map((c) => c.trim());
}

/**
 * Converte um trecho de texto inline em runs formatadas.
 * Trata `**bold**`, `__bold__`, `*italic*`, `_italic_` e `` `code` ``.
 */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)(?<!\s)\3|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined) {
      runs.push({ text: match[2], bold: true });
    } else if (match[4] !== undefined) {
      runs.push({ text: match[4], italic: true });
    } else if (match[5] !== undefined) {
      runs.push({ text: match[5], code: true });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex) });
  }
  if (!runs.length) runs.push({ text: '' });
  return runs.filter((r, i) => r.text !== '' || runs.length === 1 || i === 0);
}

/** Texto plano de um conjunto de runs (usado em PDF/autotable e sumários). */
export function runsToPlain(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join('');
}

/** Converte markdown (subset) em AST. Nunca lança — texto inválido vira parágrafo. */
export function parseMarkdown(input: string): MdNode[] {
  const nodes: MdNode[] = [];
  const lines = String(input ?? '').replace(/\r\n?/g, '\n').split('\n');

  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const text = paragraphBuffer.join(' ').trim();
    paragraphBuffer = [];
    if (text) nodes.push({ type: 'paragraph', runs: parseInline(text) });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i += 1;
      continue;
    }

    // Tabela GFM: linha com pipes seguida (na próxima ou na mesma sequência) de separador
    if (isTableLine(line)) {
      const next = lines[i + 1];
      if (next && TABLE_SEP_RE.test(next)) {
        flushParagraph();
        const header = splitTableRow(line).map(parseInline);
        const rows: InlineRun[][][] = [];
        let j = i + 2;
        while (j < lines.length && isTableLine(lines[j])) {
          if (!TABLE_SEP_RE.test(lines[j])) {
            rows.push(splitTableRow(lines[j]).map(parseInline));
          }
          j += 1;
        }
        nodes.push({ type: 'table', header, rows });
        i = j;
        continue;
      }
    }

    const heading = HEADING_RE.exec(trimmed);
    if (heading) {
      flushParagraph();
      const rawLevel = heading[1].length; // 1..6
      const level = (rawLevel >= 4 ? 4 : Math.max(2, rawLevel)) as 2 | 3 | 4;
      nodes.push({ type: 'heading', level, runs: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }

    const quote = QUOTE_RE.exec(trimmed);
    if (quote) {
      flushParagraph();
      const parts = [quote[1]];
      let j = i + 1;
      while (j < lines.length && QUOTE_RE.test(lines[j].trim())) {
        parts.push(QUOTE_RE.exec(lines[j].trim())![1]);
        j += 1;
      }
      nodes.push({ type: 'quote', runs: parseInline(parts.join(' ').trim()) });
      i = j;
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const ordered = ORDERED_RE.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = !!ordered && !bullet;
      const items: ListItem[] = [];
      let j = i;
      while (j < lines.length) {
        const l = lines[j];
        const b = BULLET_RE.exec(l);
        const o = ORDERED_RE.exec(l);
        const current = isOrdered ? (o && !b ? o : null) : b;
        if (!current) {
          // linha de continuação indentada do item anterior
          if (items.length && l.trim() && /^\s{2,}\S/.test(l) && !HEADING_RE.test(l.trim())) {
            const last = items[items.length - 1];
            last.runs = parseInline(`${runsToPlain(last.runs)} ${l.trim()}`);
            j += 1;
            continue;
          }
          break;
        }
        const indent = current[1].length;
        const text = isOrdered ? current[3] : current[2];
        items.push({ level: Math.min(2, Math.floor(indent / 2)), runs: parseInline(text.trim()) });
        j += 1;
      }
      nodes.push({ type: 'list', ordered: isOrdered, items });
      i = j;
      continue;
    }

    paragraphBuffer.push(trimmed);
    i += 1;
  }

  flushParagraph();
  return nodes;
}

/** Marcador textual usado por PDF e preview para listas com bullet. */
export const BULLET_CHARS = ['•', '–', '·'];
