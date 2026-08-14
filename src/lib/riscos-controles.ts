/**
 * Ligação risco ↔ controlos reais (requisitos dos frameworks do Gap Analysis).
 *
 * Fonte única do cálculo do factor de mitigação e do residual sugerido.
 * Regra acordada: Conforme = 100%, Parcial = 50%, Não Conforme = 0%,
 * Não Avaliado = 0% (conta, porque um controlo por avaliar não mitiga),
 * N/A é EXCLUÍDO do cálculo.
 *
 * Nada aqui escreve na base de dados: a sugestão é apresentada ao utilizador,
 * nunca imposta.
 */

export type ConformityStatus =
  | 'conforme'
  | 'parcial'
  | 'nao_conforme'
  | 'nao_aplicavel'
  | 'nao_avaliado';

export const MITIGACAO_PESOS: Record<string, number> = {
  conforme: 1,
  parcial: 0.5,
  nao_conforme: 0,
  nao_avaliado: 0,
};

export interface MitigacaoResumo {
  /** Total de requisitos vinculados (inclui N/A). */
  total: number;
  /** Requisitos que entram no cálculo (exclui N/A). */
  considerados: number;
  conforme: number;
  parcial: number;
  naoConforme: number;
  naoAvaliado: number;
  naoAplicavel: number;
  /** 0–1. */
  fator: number;
}

export function computeMitigacao(statuses: Array<string | null | undefined>): MitigacaoResumo {
  const norm = statuses.map((s) => (s || 'nao_avaliado') as ConformityStatus);
  const conforme = norm.filter((s) => s === 'conforme').length;
  const parcial = norm.filter((s) => s === 'parcial').length;
  const naoConforme = norm.filter((s) => s === 'nao_conforme').length;
  const naoAplicavel = norm.filter((s) => s === 'nao_aplicavel').length;
  const naoAvaliado = norm.filter((s) => s === 'nao_avaliado').length;
  const considerados = norm.length - naoAplicavel;
  const soma = norm
    .filter((s) => s !== 'nao_aplicavel')
    .reduce((acc, s) => acc + (MITIGACAO_PESOS[s] ?? 0), 0);
  return {
    total: norm.length,
    considerados,
    conforme,
    parcial,
    naoConforme,
    naoAvaliado,
    naoAplicavel,
    fator: considerados > 0 ? soma / considerados : 0,
  };
}

export interface ResidualSugerido {
  probabilidade: number;
  impacto: number;
  score: number;
  /** Score inerente usado como ponto de partida. */
  scoreInerente: number;
  /** Alvo teórico antes de encaixar numa célula válida da matriz. */
  alvo: number;
}

const calc = (p: number, i: number, metodo?: string | null) =>
  metodo === 'soma' ? p + i : p * i;

/**
 * Residual sugerido: aplica o factor de mitigação ao score inerente e encaixa o
 * resultado na célula (probabilidade × impacto) válida mais próxima, nunca
 * acima do inerente. Reduz preferencialmente a probabilidade, que é o efeito
 * típico de um controlo preventivo.
 */
export function sugerirResidual(
  probInerente?: number | string | null,
  impInerente?: number | string | null,
  fator = 0,
  metodo?: string | null,
  maxEscala = 5,
): ResidualSugerido | null {
  const p0 = Number(probInerente);
  const i0 = Number(impInerente);
  if (!Number.isFinite(p0) || !Number.isFinite(i0) || p0 < 1 || i0 < 1) return null;

  const scoreInerente = calc(p0, i0, metodo);
  const alvo = scoreInerente * (1 - Math.min(Math.max(fator, 0), 1));

  let melhor: ResidualSugerido | null = null;
  for (let p = 1; p <= Math.min(p0, maxEscala); p++) {
    for (let i = 1; i <= Math.min(i0, maxEscala); i++) {
      const score = calc(p, i, metodo);
      if (score > scoreInerente) continue;
      const dist = Math.abs(score - alvo);
      if (
        !melhor ||
        dist < Math.abs(melhor.score - alvo) - 1e-9 ||
        // empate: prefere o mais conservador (score maior) e, depois, menos
        // redução de impacto (controlos actuam sobretudo na probabilidade)
        (Math.abs(dist - Math.abs(melhor.score - alvo)) < 1e-9 &&
          (score > melhor.score || (score === melhor.score && i > melhor.impacto)))
      ) {
        melhor = { probabilidade: p, impacto: i, score, scoreInerente, alvo };
      }
    }
  }
  return melhor;
}

/**
 * Assinatura estável da conformidade dos controlos vinculados. Guardada em
 * `riscos.mitigacao_snapshot` quando o utilizador aplica a sugestão; se depois
 * mudar no Gap Analysis, a assinatura deixa de bater e o risco é sinalizado
 * como "residual desactualizado".
 */
export function mitigacaoFingerprint(
  links: Array<{ requirement_id: string; conformity_status?: string | null }>,
): string {
  return [...links]
    .map((l) => `${l.requirement_id}:${l.conformity_status || 'nao_avaliado'}`)
    .sort()
    .join('|');
}

export interface MitigacaoSnapshot {
  fingerprint: string;
  fator: number;
  score: number;
  aplicado_em: string;
}

export function isSnapshot(value: unknown): value is MitigacaoSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MitigacaoSnapshot).fingerprint === 'string'
  );
}
