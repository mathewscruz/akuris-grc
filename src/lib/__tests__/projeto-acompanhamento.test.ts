import { describe, it, expect } from 'vitest';
import { indicadores, progressoPorFase, estaAtrasada } from '../projeto-acompanhamento';
import type { ProjetoTarefa } from '@/types/projetos';

const t = (p: Partial<ProjetoTarefa>): ProjetoTarefa => ({
  id: Math.random().toString(), projeto_id: 'p', coluna_id: null, parent_task_id: null, titulo: 'x', descricao: null,
  prioridade: 'media', responsavel_id: null, criador_id: null, data_inicio: null, data_fim: null, prazo: null,
  estimativa_horas: null, tempo_gasto_horas: null, progresso_pct: 0, tags: [], ordem: 0, bloqueada: false,
  concluida_em: null, created_at: '', updated_at: '', ...p,
});

describe('acompanhamento de cronograma', () => {
  const hoje = new Date(2026, 9, 21);
  const fase = t({ id: 'f', titulo: 'Fase 0', progresso_pct: 66 });
  const a = t({ parent_task_id: 'f', data_inicio: '2026-08-01', data_fim: '2026-08-31', progresso_pct: 90 });
  const b = t({ parent_task_id: 'f', data_inicio: '2026-08-01', data_fim: '2026-08-31', progresso_pct: 100, concluida_em: '2026-08-30' });
  const m = t({ parent_task_id: 'f', data_inicio: '2026-12-01', data_fim: '2026-12-31', tags: ['marco'] });

  it('atrasada = prazo vencido e abaixo de 100%', () => {
    expect(estaAtrasada(a, hoje)).toBe(true);
    expect(estaAtrasada(b, hoje)).toBe(false);
    expect(estaAtrasada(m, hoje)).toBe(false);
  });

  it('fases não entram na contagem nem no progresso', () => {
    const r = indicadores([fase, a, b, m], hoje);
    expect(r.total).toBe(3);
    expect(r.concluidas).toBe(1);
    expect(r.atrasadas).toBe(1);
    expect(Math.round(r.progresso * 100)).toBe(63);
    expect(r.proximoMarco?.id).toBe(m.id);
  });

  it('progresso por fase é a média das atividades dela', () => {
    expect(progressoPorFase([fase, a, b, m])).toEqual([{ id: 'f', titulo: 'Fase 0', total: 3, progresso: 63 }]);
  });
});

import { calcularPosicaoHoje } from '@/lib/projeto-acompanhamento';
describe('calcularPosicaoHoje', () => {
  const tk = (id: string, ini: string, fim: string, extra: Partial<any> = {}) =>
    ({ id, data_inicio: ini, data_fim: fim, prazo: null, parent_task_id: null, concluida_em: null, progresso_pct: 0, tags: [], ...extra }) as any;
  const hoje = new Date(2026, 9, 21);
  const folha = () => true;
  it('projeto não iniciado: marcador no topo', () => {
    expect(calcularPosicaoHoje([tk('a', '2026-11-01', '2026-11-05')], folha, hoje).indice).toBe(0);
  });
  it('projeto terminado: marcador no fim', () => {
    const r = calcularPosicaoHoje([tk('a', '2026-01-01', '2026-01-05', { progresso_pct: 100 })], folha, hoje);
    expect(r.indice).toBe(1); expect(r.ritmo).toBe('no_ritmo');
  });
  it('em curso com atraso', () => {
    const r = calcularPosicaoHoje([tk('a', '2026-10-01', '2026-10-10'), tk('b', '2026-10-20', '2026-10-25'), tk('c', '2026-11-01', '2026-11-02')], folha, hoje);
    expect(r.indice).toBe(2); expect(r.atrasadas).toEqual(['a']); expect(r.emCurso).toEqual(['b']); expect(r.ritmo).toBe('atrasado');
  });
  it('adiantado: concluída com período futuro', () => {
    const r = calcularPosicaoHoje([tk('a', '2026-11-01', '2026-11-05', { progresso_pct: 100 })], folha, hoje);
    expect(r.adiantadas).toEqual(['a']); expect(r.ritmo).toBe('adiantado');
  });
});
