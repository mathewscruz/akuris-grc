import { describe, expect, it } from 'vitest';
import { operationalScoreColor } from '../operational-score-color';

describe('continuous operational-index palette', () => {
  it('goes from red through amber to green using theme colors', () => {
    expect(operationalScoreColor(0)).toBe('color-mix(in oklab, hsl(var(--destructive)) 100%, hsl(var(--warning)) 0%)');
    expect(operationalScoreColor(50)).toBe('color-mix(in oklab, hsl(var(--destructive)) 0%, hsl(var(--warning)) 100%)');
    expect(operationalScoreColor(100)).toBe('color-mix(in oklab, hsl(var(--warning)) 0%, hsl(var(--success)) 100%)');
  });
  it('does not assign a fixed shade to any integer score band', () => {
    const colors = Array.from({ length: 101 }, (_, score) => operationalScoreColor(score));
    expect(new Set(colors).size).toBe(101);
    expect(operationalScoreColor(45)).not.toBe(operationalScoreColor(45.5));
    expect(operationalScoreColor(79)).not.toBe(operationalScoreColor(80));
  });
  it('approaches the same amber at both sides of the midpoint', () => {
    expect(operationalScoreColor(49.5)).toBe('color-mix(in oklab, hsl(var(--destructive)) 1%, hsl(var(--warning)) 99%)');
    expect(operationalScoreColor(50.5)).toBe('color-mix(in oklab, hsl(var(--warning)) 99%, hsl(var(--success)) 1%)');
  });
  it('keeps missing data neutral, zero red, and clamps out-of-domain inputs', () => {
    for (const value of [null, NaN, Infinity, -Infinity]) {
      expect(operationalScoreColor(value)).toBe('hsl(var(--muted-foreground))');
    }
    expect(operationalScoreColor(0)).not.toBe(operationalScoreColor(null));
    expect(operationalScoreColor(-10)).toBe(operationalScoreColor(0));
    expect(operationalScoreColor(110)).toBe(operationalScoreColor(100));
  });
});
