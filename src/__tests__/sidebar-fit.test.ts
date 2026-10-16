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
});
