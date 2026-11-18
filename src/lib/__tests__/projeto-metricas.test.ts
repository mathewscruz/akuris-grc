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

import { trajetoriaIdeal, recortarInicio } from '@/lib/projeto-acompanhamento';
describe('ritmo ideal e recorte do burnup', () => {
  it('vai de 0 no início ao total na data prevista', () => {
    const ini = new Date('2026-01-01'), fim = new Date('2026-01-11');
    expect(trajetoriaIdeal([new Date('2025-12-25'), ini, new Date('2026-01-06'), new Date('2026-02-01')], 10, ini, fim)).toEqual([null, 0, 5, 10]);
  });
  it('sem data prevista não desenha linha', () => {
    expect(trajetoriaIdeal([new Date()], 5, new Date(), null)).toEqual([null]);
  });
  it('remove semanas vazias do começo mantendo uma antes da primeira conclusão', () => {
    const pts = [0, 0, 0, 0, 0, 1, 2, 2].map((concluidas) => ({ concluidas }));
    expect(recortarInicio(pts).map((p) => p.concluidas)).toEqual([0, 1, 2, 2]);
  });
});

import { saudeProjeto, projecaoBurnup, prioridadeEmpilhada, tempoMedioPorPrioridade as tmp } from '@/lib/projeto-acompanhamento';
describe('saúde e projeção', () => {
  const ini = new Date('2026-01-01'), fim = new Date('2026-01-11'), meio = new Date('2026-01-06');
  it('esperado é a fração do tempo decorrido', () => {
    expect(saudeProjeto(0.5, ini, fim, new Date('2026-01-10'), meio)).toEqual({ saude: 'no_prazo', esperado: 0.5, folgaDias: 1 });
  });
  it('previsão depois do fim previsto = atrasado', () => {
    expect(saudeProjeto(0.5, ini, fim, new Date('2026-01-15'), meio).saude).toBe('atrasado');
  });
  it('progresso bem abaixo do esperado = em risco', () => {
    expect(saudeProjeto(0.2, ini, fim, new Date('2026-01-10'), meio).saude).toBe('em_risco');
  });
  it('sem fim previsto = sem prazo', () => {
    expect(saudeProjeto(0.2, ini, null, null).saude).toBe('sem_prazo');
  });
  it('projeção para ao alcançar o escopo', () => {
    expect(projecaoBurnup(2, 5, 1.5, hoje).map((p) => p.valor)).toEqual([3.5, 5]);
    expect(projecaoBurnup(2, 5, 0, hoje)).toEqual([]);
  });
  it('separa concluídas, atrasadas e em aberto', () => {
    const r = prioridadeEmpilhada([
      t({ prioridade: 'alta', concluida_em: '2026-11-01' }),
      t({ prioridade: 'alta', prazo: '2026-11-01' }),
      t({ prioridade: 'alta', prazo: '2026-12-30' }),
    ] as any, hoje);
    expect(r[1]).toEqual({ prior: 'alta', concluidas: 1, atrasadas: 1, abertas: 1, total: 3 });
  });
  it('tempo médio ignora conclusão antes da criação', () => {
    const r = tmp([t({ prioridade: 'alta', created_at: '2026-11-10', concluida_em: '2026-11-07' }), t({ prioridade: 'alta', created_at: '2026-11-01', concluida_em: '2026-11-03' })] as any);
    expect(r.alta).toBe(2);
  });
});
