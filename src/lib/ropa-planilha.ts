import * as XLSX from 'xlsx';
import { textoDaVariante } from '@/lib/pt-variants';
import {
  ROPA_FIELDS,
  ROPA_SECTIONS,
  findRopaFieldByLabel,
  normalizeNivel,
  normalizeRopaLabel,
  ropaFieldsBySection,
} from '@/lib/ropa-schema';

export type RopaValues = Record<string, string>;

export interface ParsedRopaRecord {
  origem: string;
  nome: string;
  valores: RopaValues;
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value).trim();
};

const startsWithYes = (value?: string) => {
  const norm = normalizeRopaLabel(value || '');
  return norm.startsWith('sim') || norm.startsWith('yes');
};

/** Lê uma planilha de ROPA no formato Categoria / Campo / Descrição / Valor(es). */
export function parseRopaWorkbook(buffer: ArrayBuffer): ParsedRopaRecord[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const records: ParsedRopaRecord[] = [];
  const sheetNames = workbook.SheetNames;
  const hasProcessSheets = sheetNames.some((name) => !/dashboard|resumo|summary/i.test(name));

  for (const sheetName of sheetNames) {
    if (hasProcessSheets && /dashboard|resumo|summary/i.test(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });

    const headerIndex = rows.findIndex((row) =>
      (row || []).some((cell) => normalizeRopaLabel(cellText(cell)) === 'campo'),
    );
    if (headerIndex === -1) continue;

    const header = (rows[headerIndex] || []).map((cell) => cellText(cell));
    const campoCol = header.findIndex((cell) => normalizeRopaLabel(cell) === 'campo');
    const descCol = header.findIndex((cell) => normalizeRopaLabel(cell).startsWith('descricao'));
    const firstValueCol = Math.max(campoCol, descCol) + 1;

    const valueCols: { index: number; title: string }[] = [];
    for (let col = firstValueCol; col < header.length; col++) {
      const title = header[col];
      if (!title) continue;
      if (/observa/i.test(title)) continue;
      valueCols.push({ index: col, title });
    }
    if (valueCols.length === 0) valueCols.push({ index: firstValueCol, title: sheetName });

    const obsCol = header.findIndex((cell) => /observa/i.test(cell));

    for (const valueCol of valueCols) {
      const valores: RopaValues = {};
      for (let r = headerIndex + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const campo = cellText(row[campoCol]);
        if (!campo) continue;
        const field = findRopaFieldByLabel(campo);
        if (!field) continue;
        const value = cellText(row[valueCol.index]);
        if (value) valores[field.key] = value;
        if (obsCol >= 0) {
          const obs = cellText(row[obsCol]);
          if (obs) valores.observacoes = [valores.observacoes, obs].filter(Boolean).join('\n');
        }
      }
      if (Object.keys(valores).length === 0) continue;

      const nome = valores.nome_tratamento || valueCol.title.replace(/^Processo\s*\d+\s*[:\-–]\s*/i, '').trim() || sheetName;
      valores.nome_tratamento = nome;
      const codigoMatch = valueCol.title.match(/processo\s*(\d+)/i) || sheetName.match(/processo\s*(\d+)/i);
      if (!valores.codigo && codigoMatch) valores.codigo = `Processo ${codigoMatch[1]}`;

      records.push({ origem: sheetName, nome, valores });
    }
  }

  return records;
}

export interface RopaDbPayload {
  [key: string]: string | boolean | null;
}

/** Converte os valores lidos da planilha para o formato da tabela ropa_registros. */
export function toRopaPayload(
  valores: RopaValues,
  resolveUser: (name: string) => string | null,
): RopaDbPayload {
  const payload: RopaDbPayload = {};
  const naoResolvidos: string[] = [];

  for (const field of ROPA_FIELDS) {
    const raw = valores[field.key];
    if (!raw) continue;

    if (field.type === 'user') {
      const userId = resolveUser(raw);
      if (userId) payload[field.key] = userId;
      else naoResolvidos.push(`${field.label.pt}: ${raw}`);
      continue;
    }

    if (field.type === 'select') {
      payload[field.key] = normalizeNivel(raw);
      continue;
    }

    payload[field.key] = raw;
  }

  payload.decisao_automatizada = startsWithYes(valores.decisao_automatizada_detalhes);
  payload.transferencia_internacional = startsWithYes(valores.transferencia_detalhes);

  if (naoResolvidos.length > 0) {
    payload.observacoes = [valores.observacoes, ...naoResolvidos].filter(Boolean).join('\n');
  }

  if (!payload.nome_tratamento) payload.nome_tratamento = valores.nome_tratamento || 'ROPA importado';
  if (!payload.finalidade) payload.finalidade = valores.finalidade || '—';
  if (!payload.base_legal) payload.base_legal = valores.base_legal || '—';
  if (!payload.categoria_titulares) payload.categoria_titulares = valores.categoria_titulares || '—';
  if (!payload.prazo_retencao) payload.prazo_retencao = valores.prazo_retencao || '—';

  return payload;
}

const valueForExport = (registo: Record<string, any>, key: string): string => {
  const value = registo?.[key];
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
};

/** Gera a planilha ROPA no mesmo formato usado pelos clientes (uma aba por processo + consolidado). */
export function exportRopaWorkbook(
  registos: Record<string, any>[],
  /**
   * Locale completo, não `'pt' | 'en'`: o ecrã mostrava "Compartilhamento" em
   * pt-BR e a planilha exportada dizia "Partilha" no mesmo campo, porque aqui
   * as duas variantes do português eram a mesma coisa.
   */
  locale: string,
  fileName = 'ROPA.xlsx',
) {
  const lang: 'pt' | 'en' = String(locale).startsWith('en') ? 'en' : 'pt';
  const rotulo = (par: { pt: string; en: string }) => textoDaVariante(locale, par);
  const workbook = XLSX.utils.book_new();
  const titulo = lang === 'pt'
    ? 'ROPA: REGISTO DE OPERAÇÕES DE TRATAMENTO DE DADOS PESSOAIS'
    : 'ROPA: RECORD OF PERSONAL DATA PROCESSING ACTIVITIES';
  const headers = lang === 'pt'
    ? ['Categoria', 'Campo', 'Descrição/detalhamento', 'Valor']
    : ['Category', 'Field', 'Description', 'Value'];

  // Consolidado (uma coluna por processo)
  const consolidado: string[][] = [[titulo], []];
  consolidado.push([
    headers[0],
    headers[1],
    headers[2],
    ...registos.map((r, i) => `${r.codigo || `${lang === 'pt' ? 'Processo' : 'Process'} ${i + 1}`}: ${r.nome_tratamento || ''}`),
  ]);

  for (const section of ROPA_SECTIONS) {
    consolidado.push([rotulo(section.label).toUpperCase()]);
    for (const field of ropaFieldsBySection(section.key)) {
      consolidado.push([
        rotulo(section.label),
        rotulo(field.label),
        rotulo(field.hint),
        ...registos.map((r) => valueForExport(r, field.key)),
      ]);
    }
  }
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(consolidado),
    lang === 'pt' ? 'Dashboard ROPA' : 'ROPA Dashboard',
  );

  registos.forEach((registo, index) => {
    const aoa: string[][] = [[titulo], [registo.nome_tratamento || ''], headers];
    for (const section of ROPA_SECTIONS) {
      aoa.push([rotulo(section.label).toUpperCase()]);
      for (const field of ropaFieldsBySection(section.key)) {
        aoa.push([rotulo(section.label), rotulo(field.label), rotulo(field.hint), valueForExport(registo, field.key)]);
      }
    }
    const sheetName = `${lang === 'pt' ? 'Processo' : 'Process'} ${index + 1}`.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  });

  XLSX.writeFile(workbook, fileName);
}
