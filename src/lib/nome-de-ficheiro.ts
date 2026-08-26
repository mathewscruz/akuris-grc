/**
 * Nome de ficheiro seguro a partir de um título vindo da IA.
 *
 * O DocGen usava o título tal e qual: `a.download = titulo + '.pdf'`. O título
 * é o que o modelo devolveu, e medido nos 22 documentos gerados da base de
 * desenvolvimento:
 *
 *   - **três passam dos 100 caracteres**, o maior com 208 — porque a IA
 *     devolve o briefing inteiro como título («Política de Controle de Acesso
 *     baseada em menor privilégio, segregação de funções, processo de
 *     provisionamento/desprovisionamento, revisão periódica…»);
 *   - **três trazem caracteres que não podem estar num nome de ficheiro**: a
 *     barra de «RTO/RPO» e de «provisionamento/desprovisionamento», e o `**`
 *     de markdown que escapou do negrito («política de segurança da
 *     informação (psi)** robusta…»).
 *
 * A barra é o caso mais incómodo por ser correcta em português técnico:
 * RTO/RPO é como se escreve, e o navegador tem de a substituir ou de partir o
 * nome.
 *
 * Aqui o título é limpo uma vez, e o mesmo resultado serve o `download`, o
 * cabeçalho do PDF e o nome com que o documento é gravado.
 */

/**
 * Ilegais no Windows; a barra é ilegal em toda a parte.
 *
 * O espaço NÃO entra aqui de propósito: é legal num nome de ficheiro, e
 * trocá-lo por hífen transformaria «Política de Senhas» em
 * «Política-de-Senhas» sem razão nenhuma.
 */
const PROIBIDOS = /[\\/:*?"<>|]/g;


/** Nomes reservados do Windows, que não podem ser o nome inteiro. */
const RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Marcas de markdown que escapam do modelo para dentro do título. */
const MARKDOWN = /\*\*|__|`/g;

/**
 * Limite do nome, sem contar a extensão.
 *
 * O limite do sistema de ficheiros é 255 por componente, mas isso é o teto,
 * não o alvo: um nome de 200 caracteres não cabe em nenhuma lista, em nenhum
 * cabeçalho de PDF e em nenhuma coluna de tabela.
 */
export const MAX_NOME = 80;

/** Corta na última fronteira de palavra, para não terminar a meio de uma. */
function cortarEmPalavra(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const cortado = texto.slice(0, max);
  const espaco = cortado.lastIndexOf(' ');
  return espaco > max * 0.6 ? cortado.slice(0, espaco) : cortado;
}

export function nomeDeFicheiroSeguro(
  titulo: string | null | undefined,
  reserva = 'documento',
): string {
  const limpo = String(titulo ?? '')
    .replace(MARKDOWN, '')
    .replace(PROIBIDOS, '-')
    .replace(/\s+/g, ' ')
    // Um ponto ou espaço final vira extensão dupla ou nome inválido.
    .replace(/^[-\s.]+|[-\s.]+$/g, '')
    .trim();

  if (!limpo) return reserva;
  if (RESERVADOS.test(limpo)) return `${limpo}-${reserva}`;
  return cortarEmPalavra(limpo, MAX_NOME).replace(/[-\s.]+$/, '') || reserva;
}

/**
 * Título curto para lista, cabeçalho e nome do registo.
 *
 * Preserva pontuação — é texto, não caminho; só encurta e tira as marcas de
 * markdown. Um título de 208 caracteres numa coluna de tabela empurra tudo o
 * resto para fora do ecrã.
 */
export function tituloCurto(titulo: string | null | undefined, max = MAX_NOME): string {
  const limpo = String(titulo ?? '').replace(MARKDOWN, '').replace(/\s+/g, ' ').trim();
  if (limpo.length <= max) return limpo;
  return `${cortarEmPalavra(limpo, max).replace(/[-\s,.;:]+$/, '')}…`;
}
