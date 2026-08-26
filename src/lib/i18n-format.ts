import type { Locale } from '@/contexts/LanguageContext';

const localeMap: Record<Locale, string> = {
  pt: 'pt-PT',
  'pt-BR': 'pt-BR',
  en: 'en-US',
};

const currencyMap: Record<Locale, string> = {
  pt: 'EUR',
  'pt-BR': 'BRL',
  en: 'USD',
};

/**
 * Mês + ano no formato do idioma ativo — "agosto de 2026" (pt) / "August 2026" (en).
 * Só a primeira letra é capitalizada, nunca a preposição (evita "Agosto De 2026").
 */
export function formatMonthYear(date: Date, locale: Locale): string {
  try {
    const text = new Intl.DateTimeFormat(getIntlLocale(locale), {
      month: 'long',
      year: 'numeric',
    }).format(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return String(date.getFullYear());
  }
}

/**
 * Uma coluna `date` não tem hora, e `new Date('2026-07-01')` inventa uma:
 * meia-noite UTC. Em São Paulo isso é dia 30 de junho às 21h — e o cartão do
 * projecto mostrava a data de início um dia antes da que estava guardada.
 *
 * A regra já existia em `parseDataLocal`, mas só protegia quem se lembrava de
 * a chamar. Aqui protege quem chamar `formatDate`, que é o formatador de uso
 * geral: uma cadeia `YYYY-MM-DD` passa a ser lida ao meio-dia LOCAL, longe de
 * qualquer fronteira de fuso, e tudo o resto (ISO com hora, timestamp,
 * número) segue intocado.
 */
function paraLocal(valor: string | number): string | number {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? `${valor}T12:00:00`
    : valor;
}

export function getIntlLocale(locale: Locale): string {
  return localeMap[locale] || 'pt-BR';
}

export function formatDate(
  date: Date | string | number | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  try {
    const d = date instanceof Date ? date : new Date(paraLocal(date));
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(getIntlLocale(locale), options || { dateStyle: 'short' }).format(d);
  } catch {
    return '';
  }
}

export function formatDateTime(
  date: Date | string | number | null | undefined,
  locale: Locale
): string {
  return formatDate(date, locale, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatTime(
  date: Date | string | number | null | undefined,
  locale: Locale
): string {
  return formatDate(date, locale, { timeStyle: 'short' });
}

export function formatNumber(
  n: number | null | undefined,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  if (n === null || n === undefined || isNaN(n)) return '';
  try {
    return new Intl.NumberFormat(getIntlLocale(locale), options).format(n);
  } catch {
    return String(n);
  }
}

export function formatCurrency(
  n: number | null | undefined,
  locale: Locale,
  currency?: string
): string {
  if (n === null || n === undefined || isNaN(n)) return '';
  try {
    return new Intl.NumberFormat(getIntlLocale(locale), {
      style: 'currency',
      currency: currency || currencyMap[locale],
    }).format(n);
  } catch {
    return String(n);
  }
}

export function formatPercent(
  n: number | null | undefined,
  locale: Locale,
  fractionDigits = 0
): string {
  if (n === null || n === undefined || isNaN(n)) return '';
  try {
    return new Intl.NumberFormat(getIntlLocale(locale), {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n / 100);
  } catch {
    return `${n}%`;
  }
}

export function formatRelativeTime(
  date: Date | string | number | null | undefined,
  locale: Locale
): string {
  if (!date) return '';
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const diffMs = d.getTime() - Date.now();
    const diffSec = Math.round(diffMs / 1000);
    const rtf = new Intl.RelativeTimeFormat(getIntlLocale(locale), { numeric: 'auto' });

    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(diffSec, 'second');
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
    if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
    return rtf.format(Math.round(diffSec / 31536000), 'year');
  } catch {
    return '';
  }
}

export function formatFileSize(bytes: number | null | undefined, locale: Locale): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${formatNumber(value, locale, { maximumFractionDigits: 1 })} ${units[i]}`;
}
