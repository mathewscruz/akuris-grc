import { describe, expect, it } from 'vitest';
import { operationalScoreColor } from '../operational-score-color';

describe('operational-index bands', () => {
  it('Excelente >= 80 is green', () => {
    expect(operationalScoreColor(80)).toBe('hsl(var(--success))');
  });
  it('Bom >= 60 is teal', () => {
    expect(operationalScoreColor(60)).toBe('hsl(var(--good))');
    expect(operationalScoreColor(79)).toBe('hsl(var(--good))');
  });
  it('Atenção >= 40 is amber', () => {
    expect(operationalScoreColor(40)).toBe('hsl(var(--warning))');
  });
  it('Crítico < 40 is red', () => {
    expect(operationalScoreColor(39)).toBe('hsl(var(--destructive))');
  });
  it('keeps missing data neutral and clamps out-of-domain inputs', () => {
    for (const value of [null, NaN, Infinity, -Infinity]) {
      expect(operationalScoreColor(value)).toBe('hsl(var(--muted-foreground))');
    }
    expect(operationalScoreColor(-10)).toBe(operationalScoreColor(0));
    expect(operationalScoreColor(110)).toBe(operationalScoreColor(100));
  });
});
