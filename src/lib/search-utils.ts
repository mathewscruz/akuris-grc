/**
 * Busca textual tolerante a acentos e maiúsculas.
 *
 * Usada por: galeria de modelos do DocGen, listagem de /documentos e a busca
 * de requisitos do Gap Analysis. Normaliza os DOIS lados (termo e conteúdo)
 * removendo diacríticos, de modo que "politica" encontre "Política".
 */

/** Minúsculas + remoção de diacríticos (NFD). Nunca lança. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica se TODAS as palavras do termo aparecem em algum dos campos.
 * Termo vazio devolve `true` (não filtra).
 */
export function matchesSearch(term: string, ...fields: Array<unknown>): boolean {
  const tokens = normalizeSearch(term).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = fields.map((f) => normalizeSearch(f)).join(' ');
  return tokens.every((tk) => haystack.includes(tk));
}
