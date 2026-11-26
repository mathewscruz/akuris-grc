import { describe, it, expect } from 'vitest';
import { recomendacaoDe, celulaDaMatriz } from '../avaliacao-regras';

describe('recomendacaoDe', () => {
  it('abaixo de 40 reprova', () => expect(recomendacaoDe(39, 0, 100)).toBe('reprovar'));
  it('80+ sem críticas e com evidência aprova', () => expect(recomendacaoDe(85, 0, 60)).toBe('aprovar'));
  it('80+ com lacuna crítica fica com condições', () => expect(recomendacaoDe(81, 1, 100)).toBe('aprovar_com_condicoes'));
  it('80+ sem evidência fica com condições', () => expect(recomendacaoDe(81, 0, 0)).toBe('aprovar_com_condicoes'));
  it('entre 40 e 79 fica com condições', () => expect(recomendacaoDe(60, 0, 100)).toBe('aprovar_com_condicoes'));
  it('sem nota não recomenda', () => expect(recomendacaoDe(null, 0, 0)).toBeNull());
});

describe('celulaDaMatriz', () => {
  it('peso 3 nota 0 é alto/não atende', () => expect(celulaDaMatriz({ peso: 3, pontuacao: 0 })).toEqual({ peso: 'alto', resultado: 'nao_atende' }));
  it('peso 2 nota 5 é médio/parcial', () => expect(celulaDaMatriz({ peso: 2, pontuacao: 5 })).toEqual({ peso: 'medio', resultado: 'parcial' }));
  it('peso 1 nota 10 é baixo/atende', () => expect(celulaDaMatriz({ peso: 1, pontuacao: 10 })).toEqual({ peso: 'baixo', resultado: 'atende' }));
  it('sem nota fica fora', () => expect(celulaDaMatriz({ peso: 3, pontuacao: null })).toBeNull());
});
