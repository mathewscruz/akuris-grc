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

import { serieSemanalConformidade, CONTRATO_VIGENTE } from './bento-utils';
import { contarIncidentes } from '@/lib/metrics/incidentes';

describe('regras do dashboard', () => {
  it('contrato vigente entra em "a vencer"', () => {
    expect(CONTRATO_VIGENTE).toContain('vigente');
    expect(CONTRATO_VIGENTE).toContain('ativo');
  });
  it('incidente "em_tratamento" conta como em curso', () => {
    expect(contarIncidentes([{ status: 'em_tratamento', criticidade: 'critico' } as any]).emCurso).toBe(1);
  });
  it('média semanal mantém a última nota de cada framework', () => {
    const s = serieSemanalConformidade([
      { framework_id: 'a', score: 40, recorded_at: '2026-09-01T10:00:00Z' },
      { framework_id: 'b', score: 0, recorded_at: '2026-09-02T10:00:00Z' },
      { framework_id: 'b', score: 60, recorded_at: '2026-09-15T10:00:00Z' },
    ]);
    expect(s.map((p) => p.v)).toEqual([20, 50]);
  });
});
