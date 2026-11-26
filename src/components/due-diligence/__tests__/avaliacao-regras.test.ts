import { describe, it, expect } from 'vitest';
import {
  notaDe, ehLacuna, ehLacunaCritica, coberturaDeEvidencia, classificarRisco,
  alertasDeCoerencia, lacunasPorImpacto,
} from '../avaliacao-regras';

describe('regras da avaliação de fornecedor', () => {
  it('nota é a pontuação gravada (0–10), sem dividir pelo peso', () => {
    expect(notaDe({ pontuacao: 10, peso: 3 })).toBe(10);
    expect(notaDe({ pontuacao: null, peso: 3 })).toBeNull();
  });

  it('nota 10 com peso 3 não é lacuna nem lacuna crítica', () => {
    expect(ehLacuna({ pontuacao: 10, peso: 3 })).toBe(false);
    expect(ehLacunaCritica({ pontuacao: 10, peso: 3 })).toBe(false);
  });

  it('lacuna é nota abaixo de 6', () => {
    expect(ehLacuna({ pontuacao: 5, peso: 3 })).toBe(true);
    expect(ehLacuna({ pontuacao: 6, peso: 2 })).toBe(false);
  });

  it('lacuna crítica exige peso ≥ 3', () => {
    expect(ehLacunaCritica({ pontuacao: 0, peso: 3 })).toBe(true);
    expect(ehLacunaCritica({ pontuacao: 0, peso: 2 })).toBe(false);
  });

  it('classifica nas faixas 80/60/40', () => {
    expect(classificarRisco(81)).toBe('baixo');
    expect(classificarRisco(60)).toBe('moderado');
    expect(classificarRisco(45)).toBe('elevado');
    expect(classificarRisco(10)).toBe('critico');
  });

  it('cobertura conta só respostas pontuadas', () => {
    expect(coberturaDeEvidencia([
      { pontuacao: 10, peso: 3, temAnexo: true },
      { pontuacao: 0, peso: 3, temAnexo: false },
      { pontuacao: null, peso: 3, temAnexo: true },
    ])).toBe(50);
  });

  it('score alto com lacuna crítica e sem anexos gera os dois alertas', () => {
    const rs = [{ pontuacao: 10, peso: 3 }, { pontuacao: 0, peso: 3 }];
    expect(alertasDeCoerencia(81, rs)).toEqual(['lacunas_criticas', 'sem_evidencia']);
  });

  it('score baixo não gera alerta de coerência', () => {
    expect(alertasDeCoerencia(50, [{ pontuacao: 0, peso: 3 }])).toEqual([]);
  });

  it('lacunas ordenadas pelos pontos perdidos', () => {
    const r = lacunasPorImpacto([
      { id: 'a', pontuacao: 0, peso: 2 },
      { id: 'b', pontuacao: 0, peso: 3 },
      { id: 'c', pontuacao: 10, peso: 3 },
    ]);
    expect(r.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
