import { describe, it, expect } from 'vitest';
import {
  computeMitigacao,
  mitigacaoFingerprint,
  sugerirResidual,
} from '@/lib/riscos-controles';

describe('computeMitigacao', () => {
  it('exclui N/A do denominador e pondera conforme/parcial/não conforme', () => {
    const r = computeMitigacao(['conforme', 'parcial', 'nao_conforme', 'nao_aplicavel']);
    expect(r.total).toBe(4);
    expect(r.considerados).toBe(3);
    expect(r.fator).toBeCloseTo(0.5, 5);
  });

  it('trata requisito por avaliar como sem mitigação', () => {
    const r = computeMitigacao(['conforme', null]);
    expect(r.naoAvaliado).toBe(1);
    expect(r.fator).toBeCloseTo(0.5, 5);
  });

  it('devolve fator 0 quando só há N/A', () => {
    expect(computeMitigacao(['nao_aplicavel']).fator).toBe(0);
  });
});

describe('sugerirResidual', () => {
  it('reduz o score inerente pelo factor de mitigação', () => {
    const s = sugerirResidual(5, 3, 0.5, 'multiplicacao');
    expect(s?.scoreInerente).toBe(15);
    expect(s?.score).toBeLessThanOrEqual(15);
    expect(Math.abs((s?.score ?? 0) - 7.5)).toBeLessThanOrEqual(1.5);
  });

  it('nunca sugere acima do inerente', () => {
    const s = sugerirResidual(2, 2, 0, 'multiplicacao');
    expect(s?.score).toBe(4);
  });

  it('respeita o método de soma', () => {
    const s = sugerirResidual(4, 4, 0.5, 'soma');
    expect(s?.scoreInerente).toBe(8);
    expect(s?.score).toBe(4);
  });

  it('devolve null sem probabilidade/impacto válidos', () => {
    expect(sugerirResidual(null, 3, 0.5)).toBeNull();
  });
});

describe('mitigacaoFingerprint', () => {
  it('é estável independentemente da ordem', () => {
    const a = mitigacaoFingerprint([
      { requirement_id: 'r1', conformity_status: 'conforme' },
      { requirement_id: 'r2', conformity_status: 'parcial' },
    ]);
    const b = mitigacaoFingerprint([
      { requirement_id: 'r2', conformity_status: 'parcial' },
      { requirement_id: 'r1', conformity_status: 'conforme' },
    ]);
    expect(a).toBe(b);
  });

  it('muda quando a conformidade muda', () => {
    const a = mitigacaoFingerprint([{ requirement_id: 'r1', conformity_status: 'conforme' }]);
    const b = mitigacaoFingerprint([{ requirement_id: 'r1', conformity_status: 'parcial' }]);
    expect(a).not.toBe(b);
  });
});
