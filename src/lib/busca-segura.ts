/**
 * Busca de texto sem deixar o utilizador reescrever o filtro.
 *
 * ## O ataque
 *
 * `query.or(`nome.ilike.%${termo}%,descricao.ilike.%${termo}%`)` parece
 * inofensivo. Não é. O PostgREST lê a string do `or()` separando por vírgula,
 * e o `termo` vem de uma caixa de texto. Quem escrever
 *
 *     x,tipo.eq.confidencial
 *
 * faz a string virar quatro condições em vez de duas, e injecta um filtro que
 * o programador nunca escreveu. Com parênteses fecha grupos; com `.not.` nega
 * condições. O `empresa_id` continua colado como AND — o atacante não sai do
 * seu inquilino — mas escolhe QUE linhas do próprio inquilino aparecem, e uma
 * sintaxe inválida derruba a consulta inteira (a lista fica em erro).
 *
 * ## A defesa
 *
 * Os dois caracteres que dão poder ao atacante são a vírgula (separa condições)
 * e o parênteses (agrupa). Fora deles, o resto é texto de procura. `*` é o
 * curinga do `like` — deixá-lo passar faria uma procura por «a*b» comportar-se
 * de forma surpreendente, por isso também sai.
 *
 * Não se escapa; remove-se. Escapar exigiria saber o dialecto de escape do
 * PostgREST em cada versão — remover é uma regra que não muda.
 */

/** Caracteres com significado no filtro do PostgREST, retirados da procura. */
const PERIGOSOS = /[,()*\\]/g;

/**
 * Limpa um termo de busca livre para uso seguro dentro de `or(...ilike...)`.
 *
 * Devolve string vazia quando não sobra nada de útil — o chamador deve tratar
 * isso como «sem filtro», e não como «filtro por vazio».
 */
export function termoBuscaSeguro(bruto: string | null | undefined): string {
  return (bruto ?? '').replace(PERIGOSOS, '').trim();
}

/**
 * Monta a expressão `or()` para procurar um termo em vários campos por `ilike`.
 *
 * Devolve `null` quando não há termo seguro — nesse caso NÃO se deve aplicar
 * `or()` nenhum, senão a consulta filtra por «tudo o que contém vazio», que é
 * tudo, mas com o custo de um OR inútil.
 *
 *   const expr = orIlike(['nome', 'descricao'], termo);
 *   if (expr) query = query.or(expr);
 */
export function orIlike(campos: string[], termoBruto: string | null | undefined): string | null {
  const termo = termoBuscaSeguro(termoBruto);
  if (!termo) return null;
  return campos.map((campo) => `${campo}.ilike.%${termo}%`).join(',');
}
