import { describe, it, expect } from 'vitest';
import { segundaDaSemana, posicaoNaSemana } from '../minha-semana';

describe('minha semana', () => {
  it('a semana começa na segunda-feira', () => {
    expect(segundaDaSemana('2026-11-29')).toBe('2026-11-23'); // domingo
    expect(segundaDaSemana('2026-11-23')).toBe('2026-11-23');
  });
  it('tarefa aparece no dia em que vence', () => {
    expect(posicaoNaSemana({ data_inicio: '2026-11-10', data_fim: '2026-11-26' }, '2026-11-23')).toEqual({ tipo: 'dia', dia: '2026-11-26' });
  });
  it('tarefa que atravessa a semana fica em andamento', () => {
    expect(posicaoNaSemana({ data_inicio: '2026-11-20', data_fim: '2026-12-10' }, '2026-11-23')).toEqual({ tipo: 'andamento' });
  });
  it('tarefa fora da semana ou sem data não aparece', () => {
    expect(posicaoNaSemana({ data_inicio: '2026-12-01', data_fim: '2026-12-05' }, '2026-11-23')).toBeNull();
    expect(posicaoNaSemana({ data_inicio: null, data_fim: null }, '2026-11-23')).toBeNull();
  });
});
