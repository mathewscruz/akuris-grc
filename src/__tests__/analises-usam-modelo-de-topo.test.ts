import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ler = (p: string) => readFileSync(p, 'utf8');

describe('análises de evidências e documentos usam o modelo de topo', () => {
  it('ANALISE aponta para o Gemini 4', () => {
    expect(ler('supabase/functions/_shared/modelos.ts')).toMatch(/ANALISE: 'google\/gemini-4-argon'/);
  });

  const funcoes = [
    'supabase/functions/_shared/evidence-analysis-handler.ts',
    'supabase/functions/verify-evidence-items/index.ts',
    'supabase/functions/evidence-cross-match/index.ts',
    'supabase/functions/analyze-document-adherence/index.ts',
    'supabase/functions/gap-analysis-ai-diagnostic/index.ts',
  ];
  for (const f of funcoes) {
    it(`${f} não usa o modelo rápido`, () => {
      expect(ler(f)).not.toMatch(/MODELOS\.PADRAO/);
    });
  }
});
