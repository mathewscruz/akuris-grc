/**
 * Categorias de dados pessoais — vocabulário único do módulo de Privacidade.
 *
 * O rótulo vivia num mapa local dentro de `Privacidade.tsx`, portanto só o
 * Catálogo sabia traduzir: o wizard de ROPA, que lista os mesmos registos no
 * primeiro passo, mostrava o slug do banco ("identificacao", "biometrico").
 * Duas telas do mesmo módulo, o mesmo campo, nomes diferentes.
 */
import { formatStatus } from '@/lib/text-utils';

export const CATEGORIAS_DADOS = [
  'identificacao',
  'contato',
  'localizacao',
  'financeiro',
  'saude',
  'biometrico',
  'comportamental',
  'outros',
] as const;

export type CategoriaDados = (typeof CATEGORIAS_DADOS)[number];

/**
 * Um valor fora do vocabulário continua visível — em title-case — em vez de
 * desaparecer. Num produto de conformidade, esconder um dado estranho é pior
 * do que mostrá-lo estranho.
 */
export function rotuloCategoriaDados(
  categoria: string | null | undefined,
  t: (chave: string) => string,
): string {
  if (!categoria) return '-';
  return (CATEGORIAS_DADOS as readonly string[]).includes(categoria)
    ? t(`sweepDados.privacidade.categoria.${categoria}`)
    : formatStatus(categoria);
}
