import { describe, it, expect } from 'vitest';
import { classeDaNota } from '../avaliacao-regras';

describe('classeDaNota', () => {
  it('81 é excelente', () => expect(classeDaNota(81)).toBe('excelente'));
  it('limites 80/60/40', () => {
    expect(classeDaNota(80)).toBe('excelente');
    expect(classeDaNota(79.9)).toBe('bom');
    expect(classeDaNota(60)).toBe('bom');
    expect(classeDaNota(59)).toBe('regular');
    expect(classeDaNota(40)).toBe('regular');
    expect(classeDaNota(39)).toBe('ruim');
  });
  it('sem nota', () => expect(classeDaNota(null)).toBeNull());
});
