import { describe, it, expect } from 'vitest';
import { calcularProgresso } from '@/components/gap-analysis/adherence/progresso';

describe('progresso real da análise de compliance', () => {
  it('entendendo a política fica entre 10 e 20%', () => {
    const p = calcularProgresso({ etapa: 'classificando', progresso: 0, total: 1 });
    expect(p.fase).toBe('entendendo');
    expect(p.pct).toBe(10);
  });
  it('leitura por partes vai de 20 a 45%', () => {
    const p = calcularProgresso({ etapa: 'resumindo', progresso: 4, total: 10, trechos: new Array(8) });
    expect(p.fase).toBe('lendo');
    expect(p.pct).toBe(33);
    expect(p.partes).toEqual({ feitas: 4, total: 8 });
  });
  it('avaliação de documento com partes vai de 45 a 90%', () => {
    const p = calcularProgresso({ etapa: 'avaliando', progresso: 9, total: 10, trechos: new Array(8), contexto: { total_escopo: 40 } });
    expect(p.pct).toBe(68);
    expect(p.pontos).toEqual({ feitos: 20, total: 40 });
  });
  it('documento de uma parte avalia de 20 a 90% (sem fase parada)', () => {
    const p = calcularProgresso({ etapa: 'avaliando', progresso: 1, total: 2, trechos: ['x'], contexto: { total_escopo: 38, fora_escopo_ids: new Array(83) } });
    expect(p.pct).toBe(55);
    expect(p.escopo).toEqual({ aplicaveis: 38, total: 121 });
  });
  it('montando o resultado começa em 90%', () => {
    expect(calcularProgresso({ etapa: 'finalizando', progresso: 2, total: 2 }).pct).toBe(90);
  });
});
