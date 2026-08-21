/**
 * Utilidades de APRESENTAÇÃO do módulo de Riscos.
 *
 * O cálculo saiu daqui. Score, nível e severidade são hoje colunas escritas
 * pelo trigger `trg_risco_calcular` (ver
 * `supabase/migrations/20260821100000_risco_calculado_no_banco.sql`) e lidos
 * através de `@/lib/metrics/riscos`. Este ficheiro chegou a ter quatro funções
 * a responder "qual é a severidade disto?" — `severityFromNivel`,
 * `severityFromScore`, `severityFromScoreConfig` e `scoreFromPI` — cada uma
 * com uma regra ligeiramente diferente, e cada ecrã escolhia a sua.
 *
 * O que fica: formatação, SLA, iniciais, e a aritmética de PRÉ-VISUALIZAÇÃO da
 * matriz (colorir uma célula vazia do mapa de calor, mostrar o nível enquanto
 * se preenche o formulário). Nada disto grava.
 */
import { differenceInDays } from 'date-fns';
import { tGlobal } from '@/lib/i18n-global';
import type { NivelRisco } from '@/components/riscos/matriz-config';
import { severidadeDeFaixas, type Severidade } from '@/lib/metrics/riscos';

/** Alias do vocabulário canónico, sem o estado 'indefinido'. */
export type Severity = Exclude<Severidade, 'indefinido'>;

export const NIVEL_LABELS: Record<Severity, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

/**
 * Normaliza um valor de probabilidade/impacto para número.
 *
 * As colunas passaram a ser `smallint`, mas o formulário ainda entrega string
 * (`<Select value="4">`) e há JSON de escalas com `valor: "4"`. Continua a
 * aceitar os rótulos legados porque a biblioteca de riscos e alguns payloads de
 * importação ainda os trazem.
 */
const SCALE_MAP: Record<string, number> = {
  raro: 1,
  muito_raro: 1,
  improvavel: 2,
  possivel: 3,
  ocasional: 3,
  provavel: 4,
  quase_certo: 5,
  muito_provavel: 5,
  insignificante: 1,
  menor: 2,
  moderado: 3,
  maior: 4,
  catastrofico: 5,
};

const norm = (s?: string | null) =>
  (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function toScaleNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 20) return Math.round(n);
  const key = norm(value as string).replace(/\s+/g, '_');
  return SCALE_MAP[key] ?? null;
}

/** Exibição "P × I" normalizada: sempre número (ou "—"). */
export function formatScaleValue(value?: string | number | null): string {
  const n = toScaleNumber(value);
  return n === null ? '—' : n.toString();
}

/** Score de uma célula P×I respeitando o método de cálculo da matriz. */
export function scoreFromMatriz(p: number, i: number, metodo?: string | null): number {
  return metodo === 'soma' ? p + i : p * i;
}

/** Faixa (nível) da matriz em que o score cai; null se não houver faixas. */
export function faixaFromScore(score: number, niveis?: NivelRisco[] | null): NivelRisco | null {
  if (!niveis || niveis.length === 0) return null;
  return niveis.find((n) => score >= n.min && score <= n.max) ?? null;
}

/**
 * Severidade de um score — só para PRÉ-VISUALIZAÇÃO (células do mapa de calor,
 * nível calculado no formulário). Para um risco gravado, use
 * `severidadeRisco()` de `@/lib/metrics/riscos`, que lê a coluna canónica.
 *
 * Sem faixas configuradas devolve `null` em vez de adivinhar: os limiares fixos
 * que aqui estavam (16 / 10 / 5) assumiam escala 5×5 multiplicativa e mentiam
 * em qualquer outra.
 */
export function severidadePrevista(score: number, niveis?: NivelRisco[] | null): Severity | null {
  const faixa = faixaFromScore(score, niveis);
  if (!faixa) return null;
  const sev = severidadeDeFaixas(faixa.nivel, niveis);
  return sev === 'indefinido' ? null : sev;
}

/** ID curto display-only: "R-014" derivado dos últimos 3 chars do uuid. */
export function shortRiskId(uuid?: string | null, codigo?: string | null): string {
  if (codigo) return codigo;
  if (!uuid) return 'R-—';
  const tail = uuid.replace(/-/g, '').slice(-3).toUpperCase();
  return `R-${tail}`;
}

/**
 * Exposição financeira estimada = impacto financeiro × probabilidade da
 * ocorrência, com a probabilidade lida como fracção da escala.
 *
 * Antes existia uma tabela fixa `{1: 0.1 … 5: 0.9}`: numa escala de seis ou
 * sete níveis — que o formulário de matriz sempre permitiu criar — o factor
 * saía `undefined` e a exposição de todos esses riscos era `NaN`.
 */
export function financialExposure(
  impactoFinanceiro?: number | string | null,
  probabilidade?: string | number | null,
  escalaMax = 5,
): number | null {
  const valor = typeof impactoFinanceiro === 'string' ? Number(impactoFinanceiro) : impactoFinanceiro;
  if (valor === null || valor === undefined || !Number.isFinite(valor) || valor <= 0) return null;
  const p = toScaleNumber(probabilidade);
  if (p === null) return valor;
  const max = Math.max(escalaMax, p);
  // Fracção linear com margem: o menor nível não vale 0 nem o maior vale 1.
  const fator = (p - 0.5) / max;
  return valor * fator;
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
 *
 * As severidades vêm das colunas gravadas; as coordenadas, de
 * probabilidade/impacto — as mesmas de que o banco derivou o score, portanto
 * o ponto e a cor não podem divergir.
 */
export function computeMovimentos(
  riscos: Array<{
    id: string;
    probabilidade_inicial?: number | string | null;
    impacto_inicial?: number | string | null;
    probabilidade_residual?: number | string | null;
    impacto_residual?: number | string | null;
    severidade_inicial?: string | null;
    severidade_residual?: string | null;
  }>,
  niveis?: NivelRisco[] | null,
  metodo?: string | null,
): MovimentoRisco[] {
  const out: MovimentoRisco[] = [];
  const sevDe = (gravada?: string | null, p?: number | null, i?: number | null): Severity | null => {
    const s = norm(gravada);
    if (s === 'critico' || s === 'alto' || s === 'medio' || s === 'baixo') return s;
    if (p === null || p === undefined || i === null || i === undefined) return null;
    return severidadePrevista(scoreFromMatriz(p, i, metodo), niveis);
  };

  riscos.forEach((r) => {
    const pi = toScaleNumber(r.probabilidade_inicial);
    const ii = toScaleNumber(r.impacto_inicial);
    if (pi === null || ii === null) return;
    const sevFrom = sevDe(r.severidade_inicial, pi, ii);
    if (!sevFrom) return;

    const pr = toScaleNumber(r.probabilidade_residual);
    const ir = toScaleNumber(r.impacto_residual);
    if (pr === null || ir === null) {
      out.push({ id: r.id, from: { p: pi, i: ii }, to: null, sevFrom, sevTo: null, direcao: null });
      return;
    }
    const sevTo = sevDe(r.severidade_residual, pr, ir);
    if (!sevTo) {
      out.push({ id: r.id, from: { p: pi, i: ii }, to: null, sevFrom, sevTo: null, direcao: null });
      return;
    }
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
