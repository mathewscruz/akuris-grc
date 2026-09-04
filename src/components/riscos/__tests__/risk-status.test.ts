import { describe, expect, it } from 'vitest';
import { assertTratamentosLookup, deriveRiscoStatus, podeMarcarTratado, resumirTratamentos } from '../risk-status';

describe('QA-065 coerência de status', () => {
  it('rejeita Tratado sem tratamentos', () => {
    expect(podeMarcarTratado([])).toBe(false);
    expect(deriveRiscoStatus('tratado', []).status).toBe('analisado');
  });
  it('rejeita Tratado com tratamento parcial', () => {
    const t = [{ status: 'concluído' }, { status: 'pendente' }];
    expect(resumirTratamentos(t)).toEqual({ requeridos: 2, concluidos: 1 });
    expect(podeMarcarTratado(t)).toBe(false);
    expect(deriveRiscoStatus('tratado', t).status).toBe('em_tratamento');
  });
  it('aceita Tratado quando todos os requeridos estão concluídos', () => {
    expect(podeMarcarTratado([{ status: 'concluido' }, { status: 'cancelado' }])).toBe(true);
    expect(deriveRiscoStatus('tratado', [{ status: 'finalizado' }]).ajustado).toBe(false);
  });
  it('deriva o ciclo de vida a partir dos tratamentos', () => {
    expect(deriveRiscoStatus('analisado', [{ status: 'pendente' }]).status).toBe('em_tratamento');
    expect(deriveRiscoStatus('em_tratamento', [{ status: 'concluído' }]).status).toBe('tratado');
    expect(deriveRiscoStatus('em_revisao', [{ status: 'pendente' }]).status).toBe('em_revisao');
  });
  it('interrompe a derivação quando a consulta de tratamentos falha', () => {
    expect(() => assertTratamentosLookup({ message: 'timeout' })).toThrow(/Não foi possível verificar.*Tente novamente.*timeout/i);
    expect(() => assertTratamentosLookup(null)).not.toThrow();
  });
});
