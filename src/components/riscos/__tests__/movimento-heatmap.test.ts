/**
 * Movimento inerente → residual do mapa de calor: a direcção tem de vir da
 * faixa configurada da matriz, e riscos sem residual nunca podem gerar seta.
 */
import { describe, expect, it } from 'vitest';
import { computeMovimentos, resumoMovimento, SEVERITY_LETTER } from '@/components/riscos/risk-utils';
import type { NivelRisco } from '@/components/riscos/matriz-config';

const niveis: NivelRisco[] = [
  { nivel: 'Baixo', min: 1, max: 4, cor: '' } as NivelRisco,
  { nivel: 'Médio', min: 5, max: 9, cor: '' } as NivelRisco,
  { nivel: 'Alto', min: 10, max: 15, cor: '' } as NivelRisco,
  { nivel: 'Crítico', min: 16, max: 25, cor: '' } as NivelRisco,
];

describe('movimento do mapa de calor', () => {
  it('classifica descida, manutenção, subida e ausência de residual', () => {
    const movs = computeMovimentos(
      [
        { id: 'a', probabilidade_inicial: '5', impacto_inicial: '5', probabilidade_residual: '2', impacto_residual: '2' },
        { id: 'b', probabilidade_inicial: '3', impacto_inicial: '3', probabilidade_residual: '3', impacto_residual: '3' },
        { id: 'c', probabilidade_inicial: '1', impacto_inicial: '2', probabilidade_residual: '5', impacto_residual: '4' },
        { id: 'd', probabilidade_inicial: '4', impacto_inicial: '4' },
      ],
      niveis,
      'multiplicacao',
    );

    expect(movs.find((m) => m.id === 'a')?.direcao).toBe('desceu');
    expect(movs.find((m) => m.id === 'b')?.direcao).toBe('manteve');
    expect(movs.find((m) => m.id === 'c')?.direcao).toBe('subiu');
    const semResidual = movs.find((m) => m.id === 'd');
    expect(semResidual?.to).toBeNull();
    expect(semResidual?.direcao).toBeNull();

    expect(resumoMovimento(movs)).toEqual({ desceram: 1, mantiveram: 1, subiram: 1, semResidual: 1 });
  });

  it('ignora riscos sem avaliação inerente', () => {
    const movs = computeMovimentos([{ id: 'x', probabilidade_inicial: '', impacto_inicial: '3' }], niveis);
    expect(movs).toHaveLength(0);
  });

  it('mantém a codificação redundante de severidade', () => {
    expect(SEVERITY_LETTER).toEqual({ critico: 'C', alto: 'A', medio: 'M', baixo: 'B' });
  });
});
