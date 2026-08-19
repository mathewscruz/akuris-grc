/**
 * Score de aderência de um framework — uma conta só, para todas as telas.
 *
 * O mesmo framework aparecia com **50% na lista de frameworks e 53% no
 * detalhe**, no mesmo momento e para os mesmos dados. Eram duas contas
 * paralelas: a lista somava os requisitos sem olhar o peso, o detalhe
 * ponderava. Num produto de GRC o score é o número que a diretoria lê — ele
 * não pode depender da tela em que se está.
 *
 * E as duas ignoravam a Declaração de Aplicabilidade. Um requisito que a
 * empresa declarou fora do escopo no SoA — com justificativa registrada e
 * aceite formal — continuava contando como lacuna, puxando o score para baixo
 * e aparecendo na fila de remediação. Só a própria aba do SoA respeitava a
 * exclusão, o que dava três contagens diferentes do mesmo framework.
 *
 * As regras, agora num sítio só:
 *   - conforme vale 100, parcial vale 50, o resto vale 0;
 *   - cada requisito pesa o que está em `peso` (padrão 1);
 *   - requisito excluído pelo SoA sai da conta inteira — do numerador e do
 *     denominador — como manda a norma: não aplicável não é lacuna.
 */

/** Status de conformidade tal como a interface o grava. */
export type ConformityStatus =
  | 'conforme'
  | 'parcial'
  | 'nao_conforme'
  | 'nao_aplicavel'
  | 'nao_avaliado';

/** Pontos por status. `parcial` vale metade — meio caminho é meio ponto. */
export const PONTOS_POR_STATUS: Record<string, number> = {
  conforme: 100,
  parcial: 50,
  nao_conforme: 0,
  nao_aplicavel: 0,
  nao_avaliado: 0,
};

export interface RequisitoParaScore {
  id: string;
  peso?: number | null;
  /** Status vindo de `gap_analysis_evaluations.conformity_status`. */
  conformityStatus?: string | null;
  /** `false` quando o SoA declarou o requisito fora do escopo. */
  aplicavel?: boolean;
}

export interface ResultadoScore {
  /** 0–100, ponderado pelo peso e restrito ao escopo aplicável. */
  score: number;
  /** Requisitos dentro do escopo (total menos os excluídos pelo SoA). */
  aplicaveis: number;
  /** Requisitos excluídos pelo SoA ou marcados como não aplicáveis. */
  naoAplicaveis: number;
  /** Dentro do escopo, quantos já têm avaliação. */
  avaliados: number;
  conforme: number;
  parcial: number;
  naoConforme: number;
  naoAvaliado: number;
}

/** Um requisito está no escopo? O SoA manda; na falta dele, o status. */
export const estaNoEscopo = (r: RequisitoParaScore): boolean =>
  r.aplicavel !== false && r.conformityStatus !== 'nao_aplicavel';

export function calcularScoreFramework(requisitos: RequisitoParaScore[]): ResultadoScore {
  const noEscopo = requisitos.filter(estaNoEscopo);

  const contar = (status: string) =>
    noEscopo.filter((r) => r.conformityStatus === status).length;

  const pesoTotal = noEscopo.reduce((s, r) => s + (Number(r.peso) || 1), 0);
  const pontos = noEscopo.reduce((s, r) => {
    const peso = Number(r.peso) || 1;
    return s + (PONTOS_POR_STATUS[r.conformityStatus ?? ''] ?? 0) * peso;
  }, 0);

  const conforme = contar('conforme');
  const parcial = contar('parcial');
  const naoConforme = contar('nao_conforme');

  return {
    score: pesoTotal > 0 ? Math.round(pontos / pesoTotal) : 0,
    aplicaveis: noEscopo.length,
    naoAplicaveis: requisitos.length - noEscopo.length,
    avaliados: conforme + parcial + naoConforme,
    conforme,
    parcial,
    naoConforme,
    naoAvaliado: noEscopo.length - conforme - parcial - naoConforme,
  };
}

/**
 * Quantos pontos de score a empresa ganha se fechar estes requisitos.
 *
 * A aba de remediação mostrava "+5pts" somando os PESOS dos requisitos em
 * aberto — peso não é ponto. Com dois gaps de peso 2 e 3 num framework de
 * peso total 20, o ganho real é 25 pontos, não 5: a tela subestimava em cinco
 * vezes justamente o número que serve para convencer alguém a agir.
 */
export function ganhoPotencial(
  requisitos: RequisitoParaScore[],
  alvos: RequisitoParaScore[],
): number {
  const noEscopo = requisitos.filter(estaNoEscopo);
  const pesoTotal = noEscopo.reduce((s, r) => s + (Number(r.peso) || 1), 0);
  if (pesoTotal === 0) return 0;

  const ganho = alvos.filter(estaNoEscopo).reduce((s, r) => {
    const peso = Number(r.peso) || 1;
    const atual = PONTOS_POR_STATUS[r.conformityStatus ?? ''] ?? 0;
    return s + (100 - atual) * peso;
  }, 0);

  return Math.round(ganho / pesoTotal);
}
