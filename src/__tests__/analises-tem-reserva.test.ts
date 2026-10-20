import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ler = (p: string) => readFileSync(p, 'utf8');

describe('análises de topo têm plano B noutro fornecedor', () => {
  const funcoes = [
    'supabase/functions/_shared/evidence-analysis-handler.ts',
    'supabase/functions/verify-evidence-items/index.ts',
    'supabase/functions/evidence-cross-match/index.ts',
    'supabase/functions/analyze-document-adherence/index.ts',
    'supabase/functions/gap-analysis-ai-diagnostic/index.ts',
    'supabase/functions/suggest-risk-treatment/index.ts',
    'supabase/functions/avaliar-fornecedor-ia/index.ts',
    'supabase/functions/answer-security-questionnaire/index.ts',
  ];
  for (const f of funcoes) {
    it(`${f} usa a chamada com reserva`, () => {
      expect(ler(f)).toMatch(/fetchAnaliseComReserva\(/);
    });
  }

  it('só troca de modelo em avaria do fornecedor (5xx/408), nunca em 402/403/429', () => {
    const fonte = ler('supabase/functions/_shared/ai.ts');
    expect(fonte).toMatch(/r\.status < 500 && r\.status !== 408\) return r/);
  });

  it('orientação dos requisitos usa o modelo de topo', () => {
    expect(ler('supabase/functions/populate-requirement-guidance/index.ts')).not.toMatch(/MODELOS\.PADRAO/);
  });

  it('imagem de campanhas usa o Gemini 3 Pro Image', () => {
    expect(ler('supabase/functions/_shared/modelos.ts')).toMatch(/IMAGEM: 'google\/gemini-3-pro-image'/);
  });
});
