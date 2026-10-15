import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('orientação dos requisitos', () => {
  const src = ['index.ts', 'guidance-service.ts']
    .map((f) => readFileSync(`supabase/functions/populate-requirement-guidance/${f}`, 'utf8')).join('\n');
  it('nunca desconta créditos de IA da empresa', () => {
    expect(src).not.toMatch(/consume_ai_credit/);
  });
  it('guarda no catálogo e reaproveita antes de gerar', () => {
    expect(src).toMatch(/from\('gap_analysis_requirements'\)\.update/);
    expect(src).toMatch(/if \(!deps\.force && completeGuidance\(deps\.cached\)\)/);
  });
});
