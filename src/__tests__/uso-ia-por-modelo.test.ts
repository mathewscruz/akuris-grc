import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { custoRealUSD } from '@/lib/ai-usage-catalog';
import { agregarUso } from '@/components/configuracoes/ModelosIAUsoCard';

describe('consumo real por modelo', () => {
  it('custo vem dos tokens × preço do modelo (Gemini 4: US$2 / US$10 por 1M)', () => {
    expect(custoRealUSD('google/gemini-4-argon', 1_000_000, 1_000_000)).toBeCloseTo(12, 6);
  });

  it('sem tokens medidos o custo é desconhecido, não zero', () => {
    expect(custoRealUSD('google/gemini-4-argon', null, 10)).toBeNull();
  });

  it('chamadas do plano B e erros são contados', () => {
    const r = agregarUso([
      { modelo: 'openai/gpt-5.4-mini', reserva: true, sucesso: true, tokens_entrada: 10, tokens_saida: 5 },
      { modelo: 'google/gemini-4-argon', reserva: false, sucesso: false, tokens_entrada: null, tokens_saida: null },
    ]);
    expect(r.find((x) => x.modelo === 'openai/gpt-5.4-mini')?.reserva).toBe(1);
    expect(r.find((x) => x.modelo === 'google/gemini-4-argon')?.erros).toBe(1);
  });

  it('modelo antigo só aparece se tiver uso, marcado como descontinuado', () => {
    expect(agregarUso([]).some((x) => x.modelo === 'google/gemini-2.5-flash')).toBe(false);
    const r = agregarUso([{ modelo: 'google/gemini-2.5-flash', reserva: false, sucesso: true, tokens_entrada: 1, tokens_saida: 1 }]);
    expect(r.find((x) => x.modelo === 'google/gemini-2.5-flash')?.descontinuado).toBe(true);
  });

  it('nenhuma função chama o gateway sem registar o uso', () => {
    const dirs = ['docgen-chat','projeto-suggest-tasks','translate-framework-content','akuria-chat','generate-email-content','ai-module-assistant','projeto-status-report','populate-requirement-guidance'];
    for (const d of dirs) {
      const f = readFileSync(`supabase/functions/${d}/index.ts`, 'utf8');
      expect(f, d).not.toMatch(/await fetch\(\s*['"]https:\/\/ai\.gateway/);
      expect(f, d).toMatch(/rotularFuncaoIA\(/);
    }
  });
});
