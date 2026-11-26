/**
 * Regras puras da leitura de uma avaliação de fornecedor, partilhadas pelo
 * ecrã e pelo PDF para que os dois nunca digam coisas diferentes.
 *
 * `pontuacao` gravada = nota pura da resposta (0–10); o peso entra só na média.
 */

/** Abaixo desta nota (0–10) a resposta é uma lacuna. */
export const NOTA_LACUNA = 6;
/** Peso a partir do qual uma lacuna é crítica. */
export const PESO_CRITICO = 3;
/** Score a partir do qual uma avaliação "parece boa" e precisa de coerência. */
export const SCORE_ALTO = 70;

export interface RespostaAvaliada {
  pontuacao?: number | null;
  peso?: number | null;
  temAnexo?: boolean;
}

export function notaDe(r: RespostaAvaliada): number | null {
  if (r.pontuacao === null || r.pontuacao === undefined) return null;
  const n = Number(r.pontuacao);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, n));
}

export function maximoDe(_r?: RespostaAvaliada): number {
  return 10;
}

/** Pontos ponderados perdidos por uma resposta: peso × (10 − nota). */
export function pontosPerdidos(r: RespostaAvaliada): number {
  const n = notaDe(r);
  return n === null ? 0 : (Number(r.peso ?? 1) || 1) * (10 - n);
}

export function ehLacuna(r: RespostaAvaliada): boolean {
  const n = notaDe(r);
  return n !== null && n < NOTA_LACUNA;
}

export function ehLacunaCritica(r: RespostaAvaliada): boolean {
  return ehLacuna(r) && Number(r.peso ?? 1) >= PESO_CRITICO;
}

/** % das respostas pontuadas que têm comprovativo anexado. */
export function coberturaDeEvidencia(rs: RespostaAvaliada[]): number {
  const pontuadas = rs.filter((r) => notaDe(r) !== null);
  if (!pontuadas.length) return 0;
  return Math.round((pontuadas.filter((r) => r.temAnexo).length / pontuadas.length) * 100);
}

export type Classificacao = 'baixo' | 'moderado' | 'elevado' | 'critico';

/** Mesmas faixas de resolveScoreDueDiligenceTone (80/60/40). */
export function classificarRisco(score: number | null | undefined): Classificacao | null {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null;
  if (score >= 80) return 'baixo';
  if (score >= 60) return 'moderado';
  if (score >= 40) return 'elevado';
  return 'critico';
}

export type MotivoAlerta = 'lacunas_criticas' | 'sem_evidencia';

/** Score alto que não se sustenta: lacunas críticas ou nenhuma prova anexada. */
export function alertasDeCoerencia(score: number | null | undefined, rs: RespostaAvaliada[]): MotivoAlerta[] {
  if (score === null || score === undefined || score < SCORE_ALTO) return [];
  const motivos: MotivoAlerta[] = [];
  if (rs.some(ehLacunaCritica)) motivos.push('lacunas_criticas');
  if (rs.some((r) => notaDe(r) !== null) && coberturaDeEvidencia(rs) === 0) motivos.push('sem_evidencia');
  return motivos;
}

/** Lacunas ordenadas por impacto (pontos perdidos), piores primeiro. */
export function lacunasPorImpacto<T extends RespostaAvaliada>(rs: T[]): T[] {
  return rs.filter(ehLacuna).sort((a, b) => pontosPerdidos(b) - pontosPerdidos(a));
}
