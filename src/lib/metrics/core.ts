import { parseDataLocal } from '@/lib/date-utils';
/**
 * Camada única de métricas do domínio — núcleo.
 *
 * Regras:
 *  - Nenhuma contagem/classificação pode ser calculada localmente numa página.
 *    Tudo passa por predicados exportados daqui (ou dos módulos de domínio).
 *  - Toda a função que depende de "hoje" recebe a data como parâmetro
 *    (`ref: Date = new Date()`), para ser testável.
 */

/** Normaliza string: sem acentos, minúsculas, separadores unificados. */
export const norm = (raw?: string | null): string =>
  (raw ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

/** Início do dia (evita falsos "vencidos" por diferença de horas). */
export const startOfDay = (d: Date | string): Date => {
  const date = typeof d === 'string' ? parseDataLocal(d) : new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
};

/** Converte data (string/Date/null) em Date normalizada ou null. */
export const toDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  // Data pura ('YYYY-MM-DD') por `new Date` é meia-noite UTC — a oeste de
  // Greenwich isso recua para o dia anterior, e TODA métrica de prazo saía um
  // dia deslocada: um contrato que vence HOJE contava como vencido. Mesmo
  // remédio de `parseDataLocal` em date-utils: ancorar ao meio-dia local.
  const d = typeof value === 'string' ? parseDataLocal(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
};

/** Dias entre hoje e a data (negativo = passado). */
export const diasAte = (value?: string | Date | null, ref: Date = new Date()): number | null => {
  const d = toDate(value);
  if (!d) return null;
  return Math.round((d.getTime() - startOfDay(ref).getTime()) / 86_400_000);
};

/** Prazo vencido: data no passado (exclui hoje). */
export const isVencido = (value?: string | Date | null, ref: Date = new Date()): boolean => {
  const dias = diasAte(value, ref);
  return dias !== null && dias < 0;
};

/** Prazo a vencer dentro de `dias` (inclui hoje, exclui vencidos). */
export const isAVencer = (
  value?: string | Date | null,
  ref: Date = new Date(),
  dias = 30,
): boolean => {
  const d = diasAte(value, ref);
  return d !== null && d >= 0 && d <= dias;
};

/** Conta itens que satisfazem um predicado — a forma canónica de gerar um KPI. */
export const countBy = <T,>(items: T[] | null | undefined, predicate: (item: T) => boolean): number =>
  (items ?? []).filter(predicate).length;

/** Soma valores de itens que satisfazem um predicado. */
export const sumBy = <T,>(
  items: T[] | null | undefined,
  predicate: (item: T) => boolean,
  value: (item: T) => number | null | undefined,
): number =>
  (items ?? []).reduce((acc, item) => (predicate(item) ? acc + (value(item) || 0) : acc), 0);

/** Percentagem inteira segura (denominador 0 => null, nunca 0% inventado). */
export const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 100) : null;
