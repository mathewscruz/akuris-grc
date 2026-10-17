/**
 * Sugestão local de status a partir das evidências ligadas — sem IA, sem crédito.
 * Nunca é aplicada sozinha: o utilizador confirma.
 */
export type StatusSugerido = 'conforme' | 'parcial' | null;

/** Conta itens de lista (markdown) num texto de evidências esperadas. */
export function contarEvidenciasEsperadas(texto: string | null | undefined): number {
  if (!texto) return 0;
  const itens = texto.split('\n').filter((l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l));
  return itens.length || (texto.trim() ? 1 : 0);
}

export function sugerirStatus({ esperadas, encontradas }: { esperadas: number; encontradas: number }): StatusSugerido {
  if (encontradas <= 0) return null;
  if (esperadas > 0 && encontradas >= esperadas) return 'conforme';
  return 'parcial';
}
