import { describe, it, expect } from 'vitest';
import { resolveFrameworkBrand } from '@/lib/framework-brand';

describe('selo dos frameworks: sigla e família', () => {
  it.each([
    ['ISO/IEC 27001', '27001', 'security'],
    ['SOC 2 Type II', 'SOC2', 'security'],
    ['LGPD', 'LGPD', 'privacy'],
    ['GDPR', 'GDPR', 'privacy'],
    ['PCI DSS', 'PCI', 'security'],
    ['BACEN 4.893', 'BACEN', 'financial'],
  ])('%s', (nome, sigla, tom) => {
    const b = resolveFrameworkBrand(nome);
    expect(b.acronym).toBe(sigla);
    expect(b.tone).toBe(tom);
  });
});
