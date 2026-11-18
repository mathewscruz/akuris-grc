import { describe, it, expect } from 'vitest';
import { diasDoArrasto, aplicarArrasto, violaDependencia, conflitosDependencia, periodoSubtarefasExcede, desvioLinhaBase, deslocarLote } from '../projeto-cronograma';

describe('cronograma de projetos', () => {
  it('arrasto arredonda para o dia mais próximo', () => {
    expect(diasDoArrasto(14, 6)).toBe(2);
    expect(diasDoArrasto(-8, 6)).toBe(-1);
    expect(diasDoArrasto(2, 6)).toBe(0);
  });
  it('mover desloca início e fim; esticar só muda o fim e nunca antes do início', () => {
    const t = { data_inicio: '2026-03-01', data_fim: '2026-03-05' };
    expect(aplicarArrasto(t, 3, 'mover')).toEqual({ data_inicio: '2026-03-04', data_fim: '2026-03-08' });
    expect(aplicarArrasto(t, 2, 'fim')).toEqual({ data_inicio: '2026-03-01', data_fim: '2026-03-07' });
    expect(aplicarArrasto(t, -10, 'fim')).toEqual({ data_inicio: '2026-03-01', data_fim: '2026-03-01' });
  });
  it('FS: começar antes da anterior terminar é conflito', () => {
    const ant = { data_inicio: '2026-03-01', data_fim: '2026-03-10' };
    expect(violaDependencia({ data_inicio: '2026-03-08', data_fim: '2026-03-12' }, ant, 'FS')).toBe(true);
    expect(violaDependencia({ data_inicio: '2026-03-11', data_fim: '2026-03-12' }, ant, 'FS')).toBe(false);
    const c = conflitosDependencia([{ id: 'a', ...ant }, { id: 'b', data_inicio: '2026-03-05', data_fim: '2026-03-06' }], [{ tarefa_id: 'b', depende_de_tarefa_id: 'a', tipo: 'FS' }]);
    expect([...c]).toEqual(['b']);
  });
  it('avisa quando subtarefas passam do período da tarefa principal', () => {
    const pai = { data_inicio: '2026-03-01', data_fim: '2026-03-10' };
    expect(periodoSubtarefasExcede(pai, [{ data_inicio: '2026-03-02', data_fim: '2026-03-15' }])).toEqual({ data_inicio: '2026-03-01', data_fim: '2026-03-15' });
    expect(periodoSubtarefasExcede(pai, [{ data_inicio: '2026-03-02', data_fim: '2026-03-09' }])).toBeNull();
  });
  it('desvio da linha de base em dias', () => {
    expect(desvioLinhaBase({ data_inicio: '2026-03-01', data_fim: '2026-03-12', baseline_fim: '2026-03-10' })).toBe(2);
  });
  it('deslocar em lote ignora tarefas sem data', () => {
    expect(deslocarLote([{ id: 'a', data_inicio: '2026-12-30', data_fim: '2026-12-31' }, { id: 'b', data_inicio: null, data_fim: null }], 3))
      .toEqual([{ id: 'a', data_inicio: '2027-01-02', data_fim: '2027-01-03' }]);
  });
});

import { criaCicloDependencia, periodoInvertido } from '../projeto-cronograma';
describe('regras dos popups', () => {
  it('bloqueia dependência de si mesma e ciclos', () => {
    const deps = [{ tarefa_id: 'b', depende_de_tarefa_id: 'a' }, { tarefa_id: 'c', depende_de_tarefa_id: 'b' }];
    expect(criaCicloDependencia(deps, 'a', 'a')).toBe(true);
    expect(criaCicloDependencia(deps, 'a', 'c')).toBe(true);
    expect(criaCicloDependencia(deps, 'c', 'a')).toBe(false);
  });
  it('conclusão antes do início é inválida', () => {
    expect(periodoInvertido('2026-11-20', '2026-11-18')).toBe(true);
    expect(periodoInvertido('2026-11-18', '2026-11-18')).toBe(false);
    expect(periodoInvertido('2026-11-18', null)).toBe(false);
  });
});
