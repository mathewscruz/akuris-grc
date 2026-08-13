import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { getAppLocale } from '@/lib/i18n-locale';

const dateFnsLocale = () => (getAppLocale() === 'en' ? enUS : ptBR);

/** Padrão de data conforme idioma ativo: dd/MM/yyyy (PT) ou MM/dd/yyyy (EN). */
export const datePattern = (): string => (getAppLocale() === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy');

/**
 * Data + hora: DD/MM/YYYY HH:mm em português, MM/DD/YYYY HH:mm em inglês
 * (ano sempre com 4 dígitos). Fonte única para exibir timestamps na UI —
 * evita a mistura de formatos entre telas.
 */
export const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return format(d, `${datePattern()} HH:mm`, { locale: dateFnsLocale() });
};

/**
 * Formata uma data do formato ISO (YYYY-MM-DD) sem conversão de timezone.
 * Resolve o problema de datas que aparecem diferentes entre o form e a tabela.
 */
export const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  // Pega apenas a parte da data (remove hora se tiver)
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return '-';

  return getAppLocale() === 'en' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
};

/**
 * Data curta ("13 de ago" / "Aug 13") para cards e listas compactas.
 */
export const formatDateShort = (dateString: string | null | undefined): string | undefined => {
  if (!dateString) return undefined;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return undefined;
  return getAppLocale() === 'en'
    ? format(d, 'MMM d', { locale: enUS })
    : format(d, "dd 'de' MMM", { locale: ptBR });
};

/**
 * Converte uma data do input (YYYY-MM-DD) para o formato correto para o Supabase
 * sem adicionar timezone, mantendo apenas a data
 */
export const parseDateForDB = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;

  // Se já está no formato YYYY-MM-DD, retorna direto
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Se está no formato DD/MM/YYYY, converte
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const [day, month, year] = dateString.split('/');
    return `${year}-${month}-${day}`;
  }

  return dateString;
};

/**
 * Converte uma data do banco (que pode ter timezone) para o formato do input (YYYY-MM-DD)
 * Remove o timezone para evitar conversões indesejadas
 */
export const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  // Pega apenas a parte da data (remove hora e timezone)
  return dateString.split('T')[0];
};
