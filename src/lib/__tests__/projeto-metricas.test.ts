import { describe, it, expect } from 'vitest';
import { previsaoTermino, atrasadasPorResponsavel, burnupSemanal, tempoMedioPorPrioridade } from '@/lib/projeto-acompanhamento';

const hoje = new Date('2026-11-18T12:00:00');
const t = (o: any) => ({ id: Math.random().toString(), parent_task_id: null, progresso_pct: 0, tags: [], ...o });

describe('métricas de projeto', () => {
  it('previsão: 4 concluídas em 4 semanas e 2 restantes → 14 dias', () => {
    const tarefas = [...Array.from({ length: 4 }, () => t({ concluida_em: '2026-11-10' })), t({}), t({})];
    const p = previsaoTermino(tarefas as any, hoje);
    expect(p.porSemana).toBe(1);
    expect(p.data?.toISOString().slice(0, 10)).toBe('2026-12-02');
  });
  it('previsão sem ritmo recente fica indefinida', () => {
    expect(previsaoTermino([t({})] as any, hoje).data).toBeNull();
  });
  it('atrasadas por responsável ignora fases', () => {
    const pai = t({ id: 'p', responsavel_id: 'u1', data_fim: '2026-11-01' });
    const filho = t({ parent_task_id: 'p', responsavel_id: 'u1', data_fim: '2026-11-01' });
    expect(atrasadasPorResponsavel([pai, filho] as any, hoje)).toEqual({ u1: 1 });
  });
  it('burnup acumula concluídas', () => {
    const b = burnupSemanal([t({ concluida_em: '2026-11-17' }), t({})] as any, 2, hoje);
    expect(b.total).toBe(2);
    expect(b.pontos.at(-1)!.concluidas).toBe(1);
    expect(b.pontos[0].concluidas).toBe(0);
  });
  it('tempo médio por prioridade em dias', () => {
    const r = tempoMedioPorPrioridade([t({ prioridade: 'alta', created_at: '2026-11-01T00:00:00Z', concluida_em: '2026-11-05T00:00:00Z' })] as any);
    expect(r.alta).toBe(4);
    expect(r.baixa).toBeNull();
  });
});
