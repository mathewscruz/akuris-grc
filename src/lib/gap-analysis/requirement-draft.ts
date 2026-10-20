export interface RequirementAnswer {
  conformity_status: string | null;
  observacoes: string | null;
  prazo_implementacao: string | null;
  responsavel_avaliacao?: string | null;
}

/** Only these editable fields belong in a draft, never database identifiers. */
export function answerFingerprint(answer: RequirementAnswer): string {
  return JSON.stringify({
    conformity_status: answer.conformity_status || null,
    observacoes: answer.observacoes || '',
    prazo_implementacao: answer.prazo_implementacao || null,
    responsavel_avaliacao: answer.responsavel_avaliacao || null,
  });
}

/** Legacy snapshots and drafts based on a different saved answer cannot win. */
export function restoreRequirementDraft(raw: string | null, saved: RequirementAnswer): RequirementAnswer {
  if (!raw) return saved;
  try {
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || draft.base !== answerFingerprint(saved) || typeof draft.values !== 'string') return saved;
    const values = JSON.parse(draft.values);
    if (!values || typeof values !== 'object') return saved;
    for (const key of ['conformity_status', 'observacoes', 'prazo_implementacao', 'responsavel_avaliacao']) {
      if (values[key] !== null && typeof values[key] !== 'string') return saved;
    }
    return {
      ...saved,
      conformity_status: values.conformity_status,
      observacoes: values.observacoes,
      prazo_implementacao: values.prazo_implementacao,
      responsavel_avaliacao: values.responsavel_avaliacao,
    };
  } catch { return saved; }
}