import { describe, expect, it } from 'vitest';
import { completeGuidance, guidanceQuestions, parseGeneratedGuidance } from '../../../supabase/functions/_shared/requirement-guidance-content';

const questions = Array.from({ length: 5 }, (_, index) => ({ pergunta: `O ativo ${index + 1} está registrado?`, peso: 2 }));
const response = `===ORIENTACAO_START===
## Entenda o requisito
Registre a devolução dos ativos.
## Faça nesta ordem
1. Consulte o inventário.
2. Confira os ativos devolvidos.
3. Registre a entrega.
## Considere concluído quando
- Houver registro de conferência.
===ORIENTACAO_END===
===EVIDENCIAS_START===
- Termo de devolução assinado
===EVIDENCIAS_END===
===DIAGNOSTICO_START===
${JSON.stringify(questions)}
===DIAGNOSTICO_END===`;

describe('complete requirement guidance contract', () => {
  it('accepts complete structured guidance with operational steps, evidence and diagnostics', () => {
    expect(completeGuidance(parseGeneratedGuidance(response, 'stop'))).toBe(true);
  });
  it.each([
    response.replace('===ORIENTACAO_END===', ''),
    response.replace('===EVIDENCIAS_END===', ''),
    response.replace('===DIAGNOSTICO_END===', ''),
    response.replace(JSON.stringify(questions), 'not JSON'),
    response.replace(JSON.stringify(questions), '[null]'),
    response.replace(JSON.stringify(questions), JSON.stringify(questions.slice(0, 4))),
    response.replace('Faça nesta ordem', 'Contexto'),
    'Sorry, the provider is unavailable.',
  ])('rejects incomplete or invalid model output without a cacheable result %#', content => {
    expect(parseGeneratedGuidance(content, 'stop')).toBeNull();
  });
  it('rejects truncated or filtered responses, even when they contain a valid-looking section', () => {
    expect(parseGeneratedGuidance(response, 'length')).toBeNull();
    expect(parseGeneratedGuidance(response, 'content_filter')).toBeNull();
  });
  it('accepts JSON fences but filters malformed cached questions without throwing', () => {
    expect(parseGeneratedGuidance(response.replace(JSON.stringify(questions), '```json\n' + JSON.stringify(questions) + '\n```'))).not.toBeNull();
    expect(guidanceQuestions('[null,{}, {"pergunta":"", "peso":1}]')).toEqual([]);
  });
});
