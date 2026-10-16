import { describe, it, expect } from 'vitest';
import { diasAte, urgenciaContrato, severidadeCelula } from './bento-utils';

describe('dashboard em blocos', () => {
  it('contratos a 30 dias ou menos ficam urgentes', () => {
    expect(urgenciaContrato(30)).toBe('urgente');
    expect(urgenciaContrato(31)).toBe('proximo');
    expect(urgenciaContrato(61)).toBe('normal');
  });
  it('conta dias até o vencimento', () => {
    expect(diasAte('2026-10-26', new Date(2026, 9, 16))).toBe(10);
  });
  it('célula do mapa pela pontuação P×I', () => {
    expect(severidadeCelula(5, 5)).toBe('critical');
    expect(severidadeCelula(2, 5)).toBe('high');
    expect(severidadeCelula(1, 1)).toBe('low');
  });
});
