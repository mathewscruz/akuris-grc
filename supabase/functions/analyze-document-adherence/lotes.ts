// Análise em lotes: divide requisitos, repete só falhas temporárias e junta resultados.

export class IaIndisponivelError extends Error {
  constructor(msg = 'O serviço de análise está temporariamente indisponível. Tente novamente em alguns minutos. / The analysis service is temporarily unavailable. Please try again in a few minutes.') { super(msg); this.name = 'IaIndisponivelError'; }
}

export function dividirEmLotes<T>(itens: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

/** Só 429 e 5xx são repetíveis. */
export function statusRepetivel(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Executa `fazer` com até `tentativas` repetições extra para 429/5xx/timeout.
 * `fazer` devolve Response; erros não repetíveis sobem de imediato.
 */
export async function comRepeticao(
  fazer: () => Promise<Response>,
  tentativas = 2,
  esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  let ultimo: Response | null = null;
  for (let i = 0; i <= tentativas; i++) {
    let resp: Response | null = null;
    try {
      resp = await fazer();
    } catch (e) {
      if (i === tentativas) throw new IaIndisponivelError(String((e as Error)?.message || e));
    }
    if (resp) {
      if (resp.ok || !statusRepetivel(resp.status)) return resp;
      ultimo = resp;
      if (i === tentativas) break;
      await resp.text().catch(() => '');
    }
    const ra = Number(resp?.headers.get('retry-after'));
    const base = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * 2 ** i;
    await esperar(Math.min(base + Math.random() * 500, 15000));
  }
  return ultimo!;
}

export async function emPool<T, R>(itens: T[], limite: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(itens.length);
  let prox = 0;
  const trab = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (prox < itens.length) { const i = prox++; res[i] = await fn(itens[i], i); }
  });
  await Promise.all(trab);
  return res;
}

function dedupe<T>(arr: T[], chave: (t: T) => string): T[] {
  const vistos = new Set<string>();
  return arr.filter((x) => { const k = chave(x).toLowerCase().trim(); if (!k || vistos.has(k)) return false; vistos.add(k); return true; });
}

/** Junta resultados de lotes bem-sucedidos (null = lote falhado). */
export function juntarLotes(resultados: Array<any | null>) {
  const ok = resultados.filter(Boolean) as any[];
  return {
    documento_tipo_identificado: ok.find((r) => r.documento_tipo_identificado)?.documento_tipo_identificado ?? null,
    documento_escopo_identificado: ok.find((r) => r.documento_escopo_identificado)?.documento_escopo_identificado ?? null,
    total_requisitos_relevantes: ok.reduce((s, r) => s + (Number(r.total_requisitos_relevantes) || 0), 0),
    requisitos_analisados: ok.flatMap((r) => r.requisitos_analisados || []),
    requisitos_nao_aplicaveis: ok.flatMap((r) => r.requisitos_nao_aplicaveis || []),
    pontos_fortes: dedupe(ok.flatMap((r) => r.pontos_fortes || []), (p: any) => p?.titulo || '').slice(0, 10),
    pontos_melhoria: dedupe(ok.flatMap((r) => r.pontos_melhoria || []), (p: any) => p?.titulo || '').slice(0, 12),
    recomendacoes: dedupe(ok.flatMap((r) => r.recomendacoes || []), (s: any) => String(s)).slice(0, 12),
    analise_detalhada: ok.map((r) => r.analise_detalhada).filter(Boolean).join('\n\n'),
    lotes_ok: ok.length,
    lotes_falhados: resultados.length - ok.length,
  };
}

// ---------- Documentos de qualquer tamanho ----------

/** Até este tamanho o documento vai inteiro para a avaliação (sem resumo). */
export const LIMITE_TEXTO_DIRETO = 30000;

/** Divide o texto em trechos de `tamanho` com `sobreposicao`, cortando em quebra de linha quando possível. */
export function dividirTexto(texto: string, tamanho = 12000, sobreposicao = 500): string[] {
  const t = texto || '';
  if (t.length <= tamanho) return [t];
  const out: string[] = [];
  let ini = 0;
  while (ini < t.length) {
    let fim = Math.min(ini + tamanho, t.length);
    if (fim < t.length) {
      const quebra = t.lastIndexOf('\n', fim);
      if (quebra > ini + tamanho * 0.6) fim = quebra;
    }
    out.push(t.slice(ini, fim));
    if (fim >= t.length) break;
    ini = Math.max(fim - sobreposicao, ini + 1);
  }
  return out;
}

/** Caracteres por resumo de trecho, para o conjunto caber numa avaliação (~60k). */
export function orcamentoResumo(qtdTrechos: number): number {
  return Math.max(1200, Math.floor(60000 / Math.max(qtdTrechos, 1)));
}

/** Índices ainda não processados (undefined) em `feitos`, até `k`. */
export function proximosPendentes(feitos: unknown[], total: number, k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < total && out.length < k; i++) if (feitos[i] === undefined) out.push(i);
  return out;
}
