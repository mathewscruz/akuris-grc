/**
 * Rótulo compartilhado para valores brutos de enum (severidade, criticidade,
 * status, prioridade) persistidos no banco em português/snake_case.
 *
 * Normaliza acentos, caixa e espaços antes de procurar a chave no dicionário
 * `p7Enum`, evitando que valores como "Médio" ou "Medio" apareçam crus na UI
 * quando o idioma ativo é inglês. Cai para uma versão humanizada do valor
 * bruto quando não há chave conhecida.
 */

export type EnumCategory = 'severidade' | 'criticidade' | 'status' | 'prioridade';

/** Remove acentos, baixa a caixa e troca espaços/traços por underscore. */
export function normalizeEnumKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

/** Humaniza um valor bruto sem tradução conhecida: "em_andamento" -> "Em andamento". */
function humanize(raw: string): string {
  const text = raw.replace(/_/g, ' ').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Resolve o rótulo traduzido de um valor bruto de enum.
 *
 * @param t função de tradução de `useLanguage()`/`tGlobal`
 * @param category categoria do enum: severidade, criticidade, status ou prioridade
 * @param rawValue valor cru vindo do banco (ex.: "Medio", "médio", "em_andamento")
 */
export function getEnumLabel(
  t: (key: string) => string,
  category: EnumCategory,
  rawValue: unknown,
): string {
  const key = normalizeEnumKey(rawValue);
  if (!key) return '';

  const i18nKey = `p7Enum.${category}.${key}`;
  const translated = t(i18nKey);

  // useLanguage().t costuma devolver a própria chave quando não encontra tradução.
  if (translated && translated !== i18nKey) {
    return translated;
  }

  return humanize(String(rawValue ?? ''));
}

/** Mapeia o nome do campo bruto para a categoria de enum usada na tradução. */
export function categoryFromFieldName(fieldName: string | undefined): EnumCategory {
  switch (fieldName) {
    case 'severidade':
    case 'nivel_risco_inicial':
    case 'nivel_risco_residual':
    case 'gravidade':
      return 'severidade';
    case 'criticidade':
    case 'sensibilidade':
    case 'nivel_privilegio':
      return 'criticidade';
    case 'prioridade':
      return 'prioridade';
    default:
      return 'status';
  }
}
