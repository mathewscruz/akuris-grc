import { exportCSV } from '@/lib/csv-utils';
import { formatarDiaParaDB } from '@/lib/date-utils';

/** Coluna exportável: rótulo e como obter o valor em texto. */
export interface ColunaExportavel<T> {
  label: string;
  valor: (item: T) => unknown;
}

export function textoDaCelula(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return formatarDiaParaDB(v);
  if (Array.isArray(v)) return v.map(textoDaCelula).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return textoDaCelula(o.nome ?? o.name ?? o.titulo ?? o.label ?? '');
  }
  return '';
}

export function linhasParaExportar<T>(dados: T[], colunas: ColunaExportavel<T>[]): string[][] {
  return dados.map((item) => colunas.map((c) => textoDaCelula(c.valor(item))));
}

const slug = (base: string) =>
  `${base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exportacao'}`;
const nomeDoArquivo = (base: string) => `${slug(base)}-${formatarDiaParaDB(new Date())}`;

export function exportarTabelaCSV<T>(dados: T[], colunas: ColunaExportavel<T>[], base: string) {
  exportCSV(colunas.map((c) => c.label), linhasParaExportar(dados, colunas), slug(base));
}

export async function exportarTabelaPDF<T>(dados: T[], colunas: ColunaExportavel<T>[], base: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: colunas.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(base, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [colunas.map((c) => c.label)],
    body: linhasParaExportar(dados, colunas),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [117, 82, 255] },
  });
  doc.save(`${nomeDoArquivo(base)}.pdf`);
}
