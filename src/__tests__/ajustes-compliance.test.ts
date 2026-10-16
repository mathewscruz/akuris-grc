import { describe, it, expect } from 'vitest';
import { agruparAjustes, temInstrucao } from '@/components/gap-analysis/adherence/ajustes';

describe('ajustes da análise de compliance', () => {
  it('usa o campo essencial quando a IA o devolve', () => {
    const r = agruparAjustes([{ titulo: 'a', essencial: true, prioridade: 'baixa' }, { titulo: 'b', essencial: false, prioridade: 'alta' }], false);
    expect(r.essenciais.map(x => x.acao.titulo)).toEqual(['a']);
    expect(r.recomendados.map(x => x.acao.titulo)).toEqual(['b']);
  });
  it('análises antigas: alta e média são essenciais, baixa é recomendada', () => {
    const r = agruparAjustes([{ titulo: 'a', prioridade: 'alta' }, { titulo: 'b', prioridade: 'media' }, { titulo: 'c', prioridade: 'baixa' }], false);
    expect(r.essenciais).toHaveLength(2);
    expect(r.recomendados).toHaveLength(1);
  });
  it('política em compliance não tem pendência essencial', () => {
    const r = agruparAjustes([{ titulo: 'a', essencial: true }], true);
    expect(r.essenciais).toHaveLength(0);
    expect(r.recomendados).toHaveLength(1);
  });
  it('ação antiga sem instrução detalhada é reconhecida', () => {
    expect(temInstrucao({ titulo: 'a', descricao: 'x' })).toBe(false);
    expect(temInstrucao({ titulo: 'a', passos: ['p'] })).toBe(true);
  });
});
