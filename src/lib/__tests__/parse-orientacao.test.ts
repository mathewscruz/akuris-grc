import { describe, it, expect } from 'vitest';
import { parseOrientacao } from '@/lib/gap/parse-orientacao';

const PT = `## Entenda o requisito
A empresa precisa tratar falhas.

## Faça nesta ordem
1. Registre o desvio.
2. **Contenha** o impacto.
3. Analise a causa raiz.

## Riscos de não atender
- Reincidência da falha.`;

describe('parseOrientacao', () => {
  it('separa entenda, todos os passos e seções extras', () => {
    const r = parseOrientacao(PT);
    expect(r.entenda).toBe('A empresa precisa tratar falhas.');
    expect(r.passos).toEqual(['Registre o desvio.', 'Contenha o impacto.', 'Analise a causa raiz.']);
    expect(r.extras.map((e) => e.titulo)).toEqual(['Riscos de não atender']);
    expect(r.estruturada).toBe(true);
  });
  it('reconhece cabeçalhos em inglês', () => {
    const r = parseOrientacao('## Understand the requirement\nX\n## Do this in order\n- A\n- B');
    expect(r.passos).toEqual(['A', 'B']);
  });
  it('texto sem seções não vira lista misturada', () => {
    expect(parseOrientacao('Texto livre - com hífen').estruturada).toBe(false);
  });
});
