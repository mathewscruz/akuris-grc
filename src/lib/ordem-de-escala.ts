/**
 * A ordem das escalas do produto. Um sítio, não nove.
 *
 * ## O defeito
 *
 * Nove tabelas mostram uma escala — severidade do risco, criticidade do
 * controlo, do activo, do sistema, do incidente, prioridade do plano de acção
 * e da auditoria. Todas deixavam ordenar por essa coluna, e nenhuma ordenava
 * pela escala: comparavam o texto com `localeCompare`, ou seja **por
 * alfabeto**. Em Controles, «do mais crítico para o menos» devolvia:
 *
 *     Médio, Crítico, Crítico, Crítico, Alto, Alto
 *
 * M > C > A > B. A ordem é perfeita — só não é a ordem que a coluna promete.
 * «Mostra-me os piores primeiro» é das perguntas mais feitas num registo de
 * riscos, e era a que não funcionava em lado nenhum.
 *
 * ## O vocabulário
 *
 * Nunca foi um só: `alto` nos controlos e activos, `alta` nas prioridades,
 * `Crítico` com maiúscula e acento nos riscos, `critica` sem nada nas
 * auditorias. Por isso a normalização apaga acentos, caixa e o género — e não
 * uma tabela com as vinte grafias escritas à mão, que ficaria desactualizada
 * na próxima palavra nova.
 *
 * Devolve `null` para o que não for escala. Quem chama continua a comparar
 * como comparava: uma coluna de texto normal não muda de comportamento por
 * este ficheiro existir.
 */

/** Da mais grave para a menos. `0` é a ausência de valor. */
const POSTOS: Record<string, number> = {
  emergencial: 7,
  urgente: 7,
  critic: 6,
  'muito alt': 5,
  alt: 4,
  medi: 3,
  baix: 2,
  'muito baix': 1,
  informativ: 1,
  informac: 1,
};

/** Sem acentos, sem caixa, sem género, com `_` e `-` a valer espaço. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[oa]$/, ''); // critico/critica, alto/alta, medio/media
}

/**
 * Posto de uma palavra de escala, ou `null` se não for uma.
 *
 * Maior = mais grave, para que `desc` responda «os piores primeiro» sem
 * ninguém ter de se lembrar do sinal.
 */
export function postoDeEscala(valor: unknown): number | null {
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  const n = normalizar(valor);
  return POSTOS[n] ?? null;
}

/**
 * Comparador para uma coluna de escala, ou `null` se os valores não forem
 * escala — e aí quem chama segue com a comparação que já tinha.
 *
 * Um valor vazio ao lado de uma escala vale `0`: fica no fundo em `asc` e no
 * topo em `desc`. Vale o mesmo em qualquer tabela, porque vive aqui.
 */
export function compararEscala(a: unknown, b: unknown): number | null {
  const pa = postoDeEscala(a);
  const pb = postoDeEscala(b);
  if (pa === null && pb === null) return null;
  return (pa ?? 0) - (pb ?? 0);
}
