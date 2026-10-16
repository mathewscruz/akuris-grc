/**
 * Progresso real da análise de compliance, a partir da linha do job.
 * Faixas: preparar 0–10 · entender 10–20 · ler 20–45 · avaliar 45–90 · montar 90–100.
 * Documento de uma parte não tem leitura por partes: a avaliação ocupa 20–90.
 */
export type FaseAnalise = 'preparando' | 'entendendo' | 'lendo' | 'avaliando' | 'montando' | 'concluido';

export interface JobAnalise {
  etapa?: string | null;
  progresso?: number | null;
  total?: number | null;
  trechos?: unknown[] | null;
  contexto?: { documento_tema?: string | null; total_escopo?: number | null; fora_escopo_ids?: unknown[] | null } | null;
}

export interface ProgressoAnalise {
  fase: FaseAnalise;
  pct: number;
  /** Teto da fase atual: a animação pode avançar devagar até aqui, nunca além. */
  teto: number;
  partes: { feitas: number; total: number } | null;
  pontos: { feitos: number; total: number } | null;
  tema: string | null;
  escopo: { aplicaveis: number; total: number } | null;
}

const faixa = (ini: number, fim: number, frac: number) => Math.round(ini + (fim - ini) * Math.max(0, Math.min(1, frac)));

export function calcularProgresso(job: JobAnalise | null | undefined): ProgressoAnalise {
  const base: ProgressoAnalise = { fase: 'entendendo', pct: 10, teto: 19, partes: null, pontos: null, tema: null, escopo: null };
  if (!job) return base;

  const nTrechos = Array.isArray(job.trechos) ? job.trechos.length : 0;
  const temPartes = nTrechos > 1;
  const progresso = Math.max(0, job.progresso ?? 0);
  const total = Math.max(0, job.total ?? 0);
  const ctx = job.contexto ?? {};
  const tema = ctx.documento_tema ? String(ctx.documento_tema) : null;
  const aplicaveis = Number(ctx.total_escopo) || 0;
  const fora = Array.isArray(ctx.fora_escopo_ids) ? ctx.fora_escopo_ids.length : 0;
  const escopo = aplicaveis ? { aplicaveis, total: aplicaveis + fora } : null;
  const nLotes = Math.max(0, total - (temPartes ? nTrechos : 0));
  const lotesFeitos = Math.max(0, Math.min(nLotes, progresso - (temPartes ? nTrechos : 0)));
  const pontos = aplicaveis && nLotes ? { feitos: Math.min(aplicaveis, Math.round((lotesFeitos / nLotes) * aplicaveis)), total: aplicaveis } : null;
  const inicioAvaliar = temPartes ? 45 : 20;

  switch (job.etapa) {
    case 'classificando':
      return { ...base, tema, escopo };
    case 'resumindo': {
      const feitas = Math.min(progresso, nTrechos);
      return { fase: 'lendo', pct: faixa(20, 45, nTrechos ? feitas / nTrechos : 0), teto: 44, partes: { feitas, total: nTrechos }, pontos: null, tema, escopo };
    }
    case 'avaliando':
      return {
        fase: 'avaliando', pct: faixa(inicioAvaliar, 90, nLotes ? lotesFeitos / nLotes : 0), teto: 89,
        partes: temPartes ? { feitas: nTrechos, total: nTrechos } : null, pontos, tema, escopo,
      };
    case 'finalizando':
      return { fase: 'montando', pct: 90, teto: 99, partes: temPartes ? { feitas: nTrechos, total: nTrechos } : null, pontos: pontos && { ...pontos, feitos: pontos.total }, tema, escopo };
    case 'concluido':
      return { fase: 'concluido', pct: 100, teto: 100, partes: null, pontos: pontos && { ...pontos, feitos: pontos.total }, tema, escopo };
    default:
      return { ...base, tema, escopo };
  }
}
