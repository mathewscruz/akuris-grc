import { describe, it, expect } from 'vitest';
import { escolherDensidade } from '@/hooks/useSidebarFit';

describe('densidade do menu lateral com tolerância', () => {
  it('no limite não troca de tamanho', () => {
    expect(escolherDensidade(63, 'comfortable')).toBe('comfortable');
    expect(escolherDensidade(65, 'compact')).toBe('compact');
  });
  it('troca com folga clara', () => {
    expect(escolherDensidade(59, 'comfortable')).toBe('compact');
    expect(escolherDensidade(68, 'compact')).toBe('comfortable');
    expect(escolherDensidade(49, 'compact')).toBe('dense');
    expect(escolherDensidade(58, 'dense')).toBe('compact');
  });
  it('telas muito baixas mostram só ícones e voltam com folga', () => {
    expect(escolherDensidade(35, 'dense')).toBe('icons');
    expect(escolherDensidade(42, 'icons')).toBe('icons');
    expect(escolherDensidade(46, 'icons')).toBe('dense');
  });
});
