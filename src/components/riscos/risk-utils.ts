/**
 * Utilidades compartilhadas pelo módulo de Riscos (Visão geral, Matriz, Tabela, Drawer).
 * Mantém regras de score, derivações de SLA, ID curto e mapeamentos para tons semânticos.
 */
import { differenceInDays } from 'date-fns';
import { tGlobal } from '@/lib/i18n-global';
import type { NivelRisco } from '@/components/riscos/matriz-config';
import { severidadeDeFaixas, type FaixaMatriz } from '@/lib/metrics/riscos';

export type Severity = 'critico' | 'alto' | 'medio' | 'baixo';

export const NIVEL_LABELS: Record<Severity, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

const norm = (s?: string | null) =>
  (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Converte qualquer rótulo de nível para a chave canónica.
 *
 * Delega em `severidadeDeFaixas`, que é o vocabulário único do produto — antes
 * conhecia quatro palavras e devolvia "baixo" para todo o resto. Numa empresa
 * que renomeou as faixas da sua matriz (Baixo/Moderado/Elevado/Extremo, como a
 * Fast2Mine), a carteira inteira lia-se **Baixos 15 · Críticos 0** e o mapa de
 * calor pintava tudo de verde, enquanto o PDF — que já usava o mapa canónico —
 * contava 13 médios sobre os mesmos riscos.
 *
 * Passando as `faixas` da matriz activa, quem manda é a POSIÇÃO da faixa; sem
 * elas, o mapa de rótulos conhecidos. `indefinido` continua a colapsar para
 * "baixo" porque `Severity` aqui não tem esse estado.
 */
export function severityFromNivel(raw?: string | null, faixas?: FaixaMatriz[] | null): Severity {
  const s = severidadeDeFaixas(raw, faixas);
  return s === 'indefinido' ? 'baixo' : s;
}

/**
 * Mapa de valores textuais legados de probabilidade/impacto → escala canônica 1–5.
 * Riscos antigos gravaram texto ("provavel", "catastrofico"); os novos gravam
 * número ("1".."5"). Este mapa permite normalizar ambos para a mesma escala.
 */
const SCALE_MAP: Record<string, number> = {
  // Probabilidade
  raro: 1,
  improvavel: 2,
  possivel: 3,
  provavel: 4,
  quase_certo: 5,
  muito_provavel: 5,
  // Impacto
  insignificante: 1,
  menor: 2,
  moderado: 3,
  maior: 4,
  catastrofico: 5,
};

/**
 * Normaliza um valor de probabilidade/impacto para a escala canônica 1–5.
 * Aceita número ("1".."5") ou texto legado ("provavel", "catastrofico").
 * Retorna null quando não há valor reconhecível. Fonte única de verdade para
 * toda conversão prob/impacto → número (matriz, sparkline, score, exibição).
 */
export function toScaleNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  const key = norm(value as string).replace(/\s+/g, '_');
  return SCALE_MAP[key] ?? null;
}

/** Exibição "P × I" normalizada: sempre número (ou "—"), nunca texto legado. */
export function formatScaleValue(value?: string | number | null): string {
  const n = toScaleNumber(value);
  return n === null ? '—' : n.toString();
}

/** Score derivado de prob × imp. Aceita número ("1"-"5") ou texto legado. */
export function scoreFromPI(prob?: string | number | null, imp?: string | number | null): number {
  const p = toScaleNumber(prob) ?? 0;
  const i = toScaleNumber(imp) ?? 0;
  return p * i;
}

/** Mapeamento score → severidade (fallback quando não há matriz configurada). */
export function severityFromScore(score: number): Severity {
  if (score >= 16) return 'critico';
  if (score >= 10) return 'alto';
  if (score >= 5) return 'medio';
  return 'baixo';
}

/** Score de uma célula P×I respeitando o método de cálculo da matriz ativa. */
export function scoreFromMatriz(p: number, i: number, metodo?: string | null): number {
  return metodo === 'soma' ? p + i : p * i;
}

/** Faixa (nível) da matriz ativa em que o score cai; null se não houver faixas. */
export function faixaFromScore(score: number, niveis?: NivelRisco[] | null): NivelRisco | null {
  if (!niveis || niveis.length === 0) return null;
  return niveis.find((n) => score >= n.min && score <= n.max) ?? null;
}

/**
 * FONTE ÚNICA de severidade por score (AKURIS QA-061): deriva das faixas
 * (min/max) guardadas na configuração da matriz ativa. Só cai nos limiares
 * fixos de `severityFromScore` quando a empresa não tem faixas configuradas.
 */
export function severityFromScoreConfig(score: number, niveis?: NivelRisco[] | null): Severity {
  const faixa = faixaFromScore(score, niveis);
  return faixa ? severityFromNivel(faixa.nivel) : severityFromScore(score);
}


/** ID curto display-only: "R-014" derivado dos últimos 3 chars do uuid. */
export function shortRiskId(uuid?: string | null, codigo?: string | null): string {
  if (codigo) return codigo;
  if (!uuid) return 'R-—';
  const tail = uuid.replace(/-/g, '').slice(-3).toUpperCase();
  return `R-${tail}`;
}

/**
 * Fator de probabilidade (1–5 → chance aproximada) para ponderar o impacto
 * financeiro. Exposição = impacto_financeiro × fator. Escala deliberadamente
 * simples e monotônica (não é modelo atuarial).
 */
const PROB_FACTOR: Record<number, number> = { 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.7, 5: 0.9 };

/**
 * Exposição financeira estimada = impacto financeiro (perda potencial) ×
 * fator da probabilidade (residual, se houver; senão inicial). Retorna null
 * quando não há impacto financeiro informado.
 */
export function financialExposure(
  impactoFinanceiro?: number | string | null,
  probabilidade?: string | number | null,
): number | null {
  const valor = typeof impactoFinanceiro === 'string' ? Number(impactoFinanceiro) : impactoFinanceiro;
  if (valor === null || valor === undefined || !Number.isFinite(valor) || valor <= 0) return null;
  const p = toScaleNumber(probabilidade);
  const factor = p ? PROB_FACTOR[p] : 1;
  return valor * factor;
}

/**
 * A formatação monetária vive em `@/hooks/useEmpresaMoeda` (moeda configurada
 * por empresa). Não voltar a fixar BRL aqui.
 */


export type SlaStatus = 'no_prazo' | 'atencao' | 'vencido' | 'sem_revisao';

export function slaFromRevisao(dataProximaRevisao?: string | null): SlaStatus {
  if (!dataProximaRevisao) return 'sem_revisao';
  const dias = differenceInDays(new Date(dataProximaRevisao), new Date());
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'atencao';
  return 'no_prazo';
}

export function getSlaLabels(): Record<SlaStatus, string> {
  return {
    no_prazo: tGlobal('sweepRiscos.riscos.utils.slaNoPrazo'),
    atencao: tGlobal('sweepRiscos.riscos.utils.slaAtencao'),
    vencido: tGlobal('sweepRiscos.riscos.utils.slaVencido'),
    sem_revisao: tGlobal('sweepRiscos.riscos.utils.slaSemRevisao'),
  };
}

/** Iniciais para avatar fallback. */
export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** "há Nd / Nm / Na". */
export function relativeShort(iso?: string | null): string {
  if (!iso) return '—';
  const days = differenceInDays(new Date(), new Date(iso));
  if (days < 1) return tGlobal('sweepRiscos.riscos.utils.relHoje');
  if (days < 30) return tGlobal('sweepRiscos.riscos.utils.relDias', { n: days });
  if (days < 365) return tGlobal('sweepRiscos.riscos.utils.relMeses', { n: Math.floor(days / 30) });
  return tGlobal('sweepRiscos.riscos.utils.relAnos', { n: Math.floor(days / 365) });
}

/**
 * Risco "acima do apetite". Quando um limite de apetite (score máximo aceitável)
 * é informado, compara o score numérico do risco (residual||inicial) a ele.
 * Sem apetite configurado (ou risco sem P×I), cai no fallback por severidade
 * (alto/crítico), preservando o comportamento anterior.
 */
export function isAcimaApetite(
  r: {
    nivel_risco_residual?: string | null;
    nivel_risco_inicial?: string | null;
    probabilidade_residual?: string | number | null;
    impacto_residual?: string | number | null;
    probabilidade_inicial?: string | number | null;
    impacto_inicial?: string | number | null;
  },
  apetiteScore?: number | null,
): boolean {
  if (apetiteScore != null) {
    const score = scoreFromPI(
      r.probabilidade_residual ?? r.probabilidade_inicial,
      r.impacto_residual ?? r.impacto_inicial,
    );
    if (score > 0) return score > apetiteScore;
  }
  const sev = severityFromNivel(r.nivel_risco_residual || r.nivel_risco_inicial);
  return sev === 'critico' || sev === 'alto';
}

/**
 * Letra redundante à cor da escala de severidade (WCAG 1.4.1 — a informação
 * nunca pode depender só da cor). C = Crítico, A = Alto, M = Médio, B = Baixo.
 */
export const SEVERITY_LETTER: Record<Severity, string> = {
  critico: 'C',
  alto: 'A',
  medio: 'M',
  baixo: 'B',
};

export function severityLetter(sev: Severity): string {
  return SEVERITY_LETTER[sev];
}

/** Ordem perceptual da escala (maior = mais grave), para comparar faixas. */
export const SEVERITY_RANK: Record<Severity, number> = { baixo: 1, medio: 2, alto: 3, critico: 4 };

export interface MovimentoRisco {
  id: string;
  from: { p: number; i: number };
  to: { p: number; i: number } | null;
  sevFrom: Severity;
  sevTo: Severity | null;
  /** 'desceu' | 'manteve' | 'subiu' — comparação de faixa (não de score). */
  direcao: 'desceu' | 'manteve' | 'subiu' | null;
}

/**
 * Movimento inerente → residual de cada risco, em coordenadas da matriz.
 * Riscos sem residual avaliado ficam com `to: null` (só o ponto inerente).
 */
export function computeMovimentos(
  riscos: Array<{
    id: string;
    probabilidade_inicial?: string | null;
    impacto_inicial?: string | null;
    probabilidade_residual?: string | null;
    impacto_residual?: string | null;
  }>,
  niveis?: NivelRisco[] | null,
  metodo?: string | null,
): MovimentoRisco[] {
  const out: MovimentoRisco[] = [];
  riscos.forEach((r) => {
    const pi = toScaleNumber(r.probabilidade_inicial);
    const ii = toScaleNumber(r.impacto_inicial);
    if (pi === null || ii === null) return;
    const sevFrom = severityFromScoreConfig(scoreFromMatriz(pi, ii, metodo), niveis);
    const pr = toScaleNumber(r.probabilidade_residual);
    const ir = toScaleNumber(r.impacto_residual);
    if (pr === null || ir === null) {
      out.push({ id: r.id, from: { p: pi, i: ii }, to: null, sevFrom, sevTo: null, direcao: null });
      return;
    }
    const sevTo = severityFromScoreConfig(scoreFromMatriz(pr, ir, metodo), niveis);
    const delta = SEVERITY_RANK[sevTo] - SEVERITY_RANK[sevFrom];
    out.push({
      id: r.id,
      from: { p: pi, i: ii },
      to: { p: pr, i: ir },
      sevFrom,
      sevTo,
      direcao: delta < 0 ? 'desceu' : delta > 0 ? 'subiu' : 'manteve',
    });
  });
  return out;
}

/** Resumo agregado do movimento (desceram / mantiveram / subiram / sem residual). */
export function resumoMovimento(movs: MovimentoRisco[]) {
  return {
    desceram: movs.filter((m) => m.direcao === 'desceu').length,
    mantiveram: movs.filter((m) => m.direcao === 'manteve').length,
    subiram: movs.filter((m) => m.direcao === 'subiu').length,
    semResidual: movs.filter((m) => m.to === null).length,
  };
}
