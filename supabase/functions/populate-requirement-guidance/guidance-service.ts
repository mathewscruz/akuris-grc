/** Requirement guidance is platform content, never a customer-credit operation. */
export interface GuidanceResult {
  orientacao_implementacao: string;
  exemplos_evidencias: string;
  perguntas_diagnostico: string | null;
}

export class GuidanceError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}

export async function getOrCreateGuidance(deps: {
  cached: GuidanceResult | null;
  force: boolean;
  claim: () => Promise<boolean>;
  readCached: () => Promise<GuidanceResult | null>;
  generate: () => Promise<GuidanceResult | null>;
  save: (value: GuidanceResult) => Promise<GuidanceResult>;
}) {
  if (!deps.force && deps.cached?.orientacao_implementacao.trim()) {
    return { ...deps.cached, cached: true, pending: false };
  }
  // Bound cache-miss generation in the database, not only in this isolate.
  // This is a rate window, not an exactly-once distributed lock.
  if (!await deps.claim()) {
    const cached = await deps.readCached();
    if (!deps.force && cached?.orientacao_implementacao.trim()) return { ...cached, cached: true, pending: false };
    return { pending: true, cached: false, retry_after: 10 };
  }
  const generated = await deps.generate();
  if (!generated?.orientacao_implementacao.trim()) throw new GuidanceError('guidance_generation_failed', 502);
  // A successful model response is NOT a successful operation until persisted.
  const saved = await deps.save(generated);
  if (!saved?.orientacao_implementacao.trim()) throw new GuidanceError('guidance_save_failed');
  return { ...saved, cached: false, pending: false };
}
