/**
 * Qual era a avaliação de um risco numa data — e não a de hoje.
 *
 * O painel desenhava a "Evolução dos Riscos" filtrando riscos por `created_at`
 * e aplicando a severidade **actual** a todos os meses anteriores. Um risco
 * criado em abril e tratado de Crítico para Baixo em agosto aparecia como
 * Baixo já em abril. Consequência: a curva só se movia quando se CADASTRAVA um
 * risco novo — tratar, reavaliar ou encerrar não mexia nela. Um gráfico de
 * risco que estruturalmente não pode descer é pior do que nenhum, porque é o
 * número que vai ao conselho.
 *
 * A verdade está em `riscos_historico_avaliacoes`, que guarda cada reavaliação
 * com a sua data. Este ficheiro é a resolução partilhada, para o módulo de
 * Riscos e o painel executivo não divergirem outra vez.
 */

/** Uma linha de `riscos_historico_avaliacoes`, no mínimo necessário. */
export interface AvaliacaoNoTempo {
  risco_id: string;
  created_at: string;
  /**
   * 'inicial' (risco bruto) ou 'residual' (depois dos controlos).
   *
   * Não é enfeite: o formulário grava as DUAS no mesmo `insert`, com carimbo
   * idêntico ao microssegundo. Ordenar só por data dá empate, e o desempate
   * decide se a curva mostra o risco antes ou depois do tratamento — que é a
   * diferença entre "Médio" e "Baixo" para o mesmo risco, no mesmo mês.
   */
  tipo?: string | null;
  nivel_risco?: string | null;
  probabilidade?: number | null;
  impacto?: number | null;
  /** Calculados no banco: score e severidade canónica da avaliação. */
  score?: number | null;
  severidade?: string | null;
}

/**
 * A linha que fecha a série de um risco: escrita pelo gatilho de exclusão.
 *
 * O livro é append-only e sobrevive ao risco — é o que impede o gráfico de se
 * reescrever quando alguém apaga um item. Mas um risco apagado também não pode
 * contar para sempre: esta linha diz até quando ele contava.
 */
export const TIPO_EXCLUSAO = 'exclusao';

/** Entre avaliações do mesmo instante: inicial → residual → exclusão. */
const ordemDoTipo = (tipo?: string | null) => {
  if (tipo === TIPO_EXCLUSAO) return 2;
  return tipo === 'residual' ? 1 : 0;
};

/** Agrupa as avaliações por risco, em ordem crescente de data. */
export function avaliacoesPorRisco<T extends AvaliacaoNoTempo>(
  avaliacoes: T[] | null | undefined,
): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const a of avaliacoes ?? []) {
    const lista = mapa.get(a.risco_id) ?? [];
    lista.push(a);
    mapa.set(a.risco_id, lista);
  }
  for (const lista of mapa.values()) {
    lista.sort((x, y) => {
      const dt = new Date(x.created_at).getTime() - new Date(y.created_at).getTime();
      return dt !== 0 ? dt : ordemDoTipo(x.tipo) - ordemDoTipo(y.tipo);
    });
  }
  return mapa;
}

/**
 * A última avaliação registada ANTES de `limite`.
 *
 * `null` quando o risco ainda não tinha sido reavaliado nessa altura — aí quem
 * chama cai para a linha de base do próprio risco (o nível inicial).
 */
export function avaliacaoVigente<T extends AvaliacaoNoTempo>(
  avaliacoesDoRisco: T[] | undefined,
  limite: Date,
): T | null {
  if (!avaliacoesDoRisco?.length) return null;
  for (let i = avaliacoesDoRisco.length - 1; i >= 0; i--) {
    if (new Date(avaliacoesDoRisco[i].created_at) < limite) return avaliacoesDoRisco[i];
  }
  return null;
}

/** Já existia? Então o risco conta para aquele mês. */
export function jaExistiaEm(criadoEm: string, limite: Date): boolean {
  return new Date(criadoEm) < limite;
}

/**
 * O risco fazia parte da carteira naquela data, e com que avaliação.
 *
 * Lê SÓ o livro — nunca a tabela `riscos`, que é o presente. Era essa leitura
 * do presente que fazia o passado mudar: apagar um risco cadastrado em maio
 * alterava o ponto de maio, porque a série era reconstruída a partir de quem
 * ainda existia hoje.
 *
 * Três respostas possíveis:
 *  · sem linha antes do limite → ainda não tinha sido cadastrado;
 *  · a última linha é a de exclusão → já tinha saído da carteira;
 *  · caso contrário → existia, com aquela avaliação.
 */
export function vigenteNoTempo<T extends AvaliacaoNoTempo>(
  linhasDoRisco: T[] | undefined,
  limite: Date,
): { existia: boolean; avaliacao: T | null } {
  const ultima = avaliacaoVigente(linhasDoRisco, limite);
  if (!ultima || ultima.tipo === TIPO_EXCLUSAO) return { existia: false, avaliacao: null };
  return { existia: true, avaliacao: ultima };
}
