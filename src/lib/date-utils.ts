import { format } from 'date-fns';
import { ptBR, pt as ptPT, enUS } from 'date-fns/locale';
import { getAppLocale } from '@/lib/i18n-locale';

/**
 * Locale do date-fns para o idioma ativo — os TRÊS casos.
 *
 * Já existia aqui, mas privado. Seis componentes escreveram a própria versão
 * `locale === 'pt' ? ptBR : enUS`, de quando só havia duas variantes: com a
 * entrada do `pt-BR` esse teste passou a mandar o utilizador BRASILEIRO, que é
 * o público principal, para o inglês. O painel mostrava "about 24 hours ago"
 * numa interface em português.
 */
export const dateFnsLocale = () =>
  getAppLocale() === 'en' ? enUS : getAppLocale() === 'pt' ? ptPT : ptBR;

/** Locale BCP-47 do idioma ativo, para Intl. */
export const intlLocale = (): string => {
  const l = getAppLocale();
  return l === 'en' ? 'en-US' : l === 'pt' ? 'pt-PT' : 'pt-BR';
};

/**
 * Mês + ano conforme o idioma ativo ("agosto de 2026" / "August 2026"),
 * capitalizando apenas a primeira letra — nunca a preposição.
 */
export const formatMonthYearLabel = (date: Date): string => {
  const text = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

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
/**
 * Converte uma data pura (`YYYY-MM-DD`) num `Date` do fuso local.
 *
 * `new Date('2026-07-04')` e' lido pelo motor como **meia-noite UTC**; ao
 * formatar em Sao Paulo (UTC-3) o resultado volta para 03/07. Como quase todo
 * campo de prazo do produto e' coluna `date` — vencimento de contrato, data
 * prevista de marco, validade de documento —, o efeito era **um dia a menos,
 * sempre**, e so' nos ecras que usavam `new Date(...)` diretamente: a tabela de
 * contratos dizia 04/07/2026 e a gaveta de detalhe, para a mesma linha, dizia
 * "03 de jul".
 *
 * Ancorar ao meio-dia local resolve para qualquer fuso entre -11 e +12. Para
 * valores com hora (`timestamptz`) devolve o `Date` normal, que ja' esta' certo.
 */
export const parseDataLocal = (dateString: string): Date =>
  /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(dateString + 'T12:00:00')
    : new Date(dateString);

export const formatDateShort = (dateString: string | null | undefined): string | undefined => {
  if (!dateString) return undefined;
  const d = parseDataLocal(dateString);
  if (isNaN(d.getTime())) return undefined;
  return getAppLocale() === 'en'
    ? format(d, 'MMM d', { locale: enUS })
    : format(d, "dd 'de' MMM", { locale: ptBR });
};

/**
 * Converte uma data do input (YYYY-MM-DD) para o formato correto para o Supabase
 * sem adicionar timezone, mantendo apenas a data
 */
/**
 * Contrapartida de `parseDataLocal` no caminho de escrita: converte um `Date`
 * escolhido no calendário para o `YYYY-MM-DD` que a coluna `date` espera,
 * usando os componentes LOCAIS.
 *
 * `toISOString()` não serve aqui: converte para UTC primeiro, portanto uma data
 * escolhida à noite em Brasília é gravada como o dia seguinte.
 */
export const formatarDiaParaDB = (date: Date): string => {
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mes}-${dia}`;
};

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
