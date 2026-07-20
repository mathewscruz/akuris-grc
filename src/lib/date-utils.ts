import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Data + hora no padrão brasileiro: DD/MM/YYYY HH:mm (ano sempre com 4 dígitos).
 * Fonte única para exibir timestamps na UI — evita a mistura de formatos
 * (ex.: "11/05/26 14:47" vs "10/10/2025") entre telas.
 */
export const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

/**
 * Formata uma data do formato ISO (YYYY-MM-DD) para DD/MM/YYYY sem conversão de timezone
 * Resolve o problema de datas que aparecem diferentes entre o form e a tabela
 */
export const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  // Pega apenas a parte da data (remove hora se tiver)
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  
  return `${day}/${month}/${year}`;
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