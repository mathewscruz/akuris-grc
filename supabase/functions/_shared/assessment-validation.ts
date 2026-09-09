export interface AssessmentQuestion { tipo: string; opcoes?: unknown; obrigatoria?: boolean }
/** Validate raw answers, not their derived score. A stored upload is trusted
 * only after the endpoint checks its assessment-scoped object key. */
export function validAssessmentAnswer(q: AssessmentQuestion, value: unknown, hasStoredFile = false): boolean {
  if (['file','arquivo'].includes(q.tipo)) return hasStoredFile;
  if (value == null || String(value).trim() === '') return false;
  const text = String(value).trim();
  if (['score','numerico'].includes(q.tipo)) {
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 && n <= 10;
  }
  const options = Array.isArray(q.opcoes) ? q.opcoes.filter((o): o is string => typeof o === 'string') : [];
  if (['radio','select'].includes(q.tipo)) return options.includes(text);
  if (q.tipo === 'checkbox') {
    const selected = text.split(/\s*;\s*/);
    return selected.length > 0 && new Set(selected).size === selected.length && selected.every(s => options.includes(s));
  }
  if (q.tipo === 'booleano') return ['sim','nao','não'].includes(text.toLowerCase());
  return true;
}
