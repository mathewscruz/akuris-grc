/** Shared catalogue contract: the browser and the generator agree on completeness. */
export interface GuidanceContent {
  orientacao_implementacao: string;
  exemplos_evidencias: string;
  perguntas_diagnostico: string | null;
}

export interface GuidanceQuestion { pergunta: string; peso: number }

export function guidanceQuestions(raw: unknown): GuidanceQuestion[] {
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((item): item is GuidanceQuestion => {
      if (!item || typeof item !== 'object') return false;
      const question = item as Partial<GuidanceQuestion>;
      return typeof question.pergunta === 'string' && !!question.pergunta.trim() && [1, 2, 3].includes(question.peso!);
    }) : [];
  } catch { return []; }
}

/** Accept current PT/EN headings and the historical catalogue, including emojis. */
export function implementationSection(content: string | null | undefined): string {
  if (!content?.trim()) return '';
  const headings = [...content.matchAll(/^#{1,3}\s+(.+)\r?$/gm)];
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    const title = heading[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!/implement|practical|how to|action steps|faca nesta ordem|do this in order|passo a passo/.test(title)) continue;
    // A nested subsection belongs to this section, not to the following article.
    const level = heading[0].match(/^#+/)![0].length;
    const next = headings.slice(index + 1).find(item => item[0].match(/^#+/)![0].length <= level);
    const body = content.slice(heading.index! + heading[0].length, next?.index ?? content.length).trim();
    if (body) return body;
  }
  return '';
}

export function completeGuidance(value: GuidanceContent | null | undefined): value is GuidanceContent {
  return !!value && !!implementationSection(value.orientacao_implementacao)
    && !!value.exemplos_evidencias?.trim() && guidanceQuestions(value.perguntas_diagnostico).length > 0;
}

/** Never turn a truncated response or an unstructured provider message into cached guidance. */
export function parseGeneratedGuidance(content: string, finishReason?: string): GuidanceContent | null {
  if (finishReason && finishReason !== 'stop') return null;
  const section = (name: string) => content.match(new RegExp(`===${name}_START===([\\s\\S]*?)===${name}_END===`))?.[1].trim() || '';
  const orientation = section('ORIENTACAO');
  const evidence = section('EVIDENCIAS');
  const diagnostic = section('DIAGNOSTICO').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(diagnostic); } catch { return null; }
  const questions = guidanceQuestions(parsed);
  if (!Array.isArray(parsed) || parsed.length !== 5 || questions.length !== 5) return null;
  const value = { orientacao_implementacao: orientation, exemplos_evidencias: evidence, perguntas_diagnostico: JSON.stringify(questions) };
  return completeGuidance(value) ? value : null;
}
