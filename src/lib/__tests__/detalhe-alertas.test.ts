import { describe, it, expect } from 'vitest';
import { diasAte, estadoVencimento, diasDesde } from '../detalhe-alertas';

const hoje = new Date(2026, 9, 15); // 15/10/2026

describe('alertas de vencimento', () => {
  it('contrato que termina em 60 dias está a vencer', () => {
    expect(estadoVencimento('2026-12-14', hoje)).toBe('aVencer');
  });
  it('contrato que termina em 61 dias não gera alerta', () => {
    expect(estadoVencimento('2026-12-15', hoje)).toBeNull();
  });
  it('data no passado está vencida', () => {
    expect(estadoVencimento('2026-10-14', hoje)).toBe('vencido');
  });
  it('conta dias até e desde', () => {
    expect(diasAte('2026-10-25', hoje)).toBe(10);
    expect(diasDesde('2026-10-05', hoje)).toBe(10);
  });
});
