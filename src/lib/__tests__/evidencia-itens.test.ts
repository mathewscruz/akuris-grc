import { describe, it, expect } from 'vitest';
import { contarAtendidos, itemAtendido } from '@/lib/gap-analysis/evidencia-itens';

describe('evidências esperadas', () => {
  it('marcação manual conta como atendido', () => {
    expect(itemAtendido({ item_index: 0, marcado: true, ia_status: null }, false)).toBe(true);
  });
  it('sugestão do Akuris sem aceite não conta', () => {
    expect(itemAtendido({ item_index: 0, marcado: false, ia_status: 'atendido' }, false)).toBe(false);
  });
  it('soma manual + arquivo ligado', () => {
    const n = contarAtendidos(7, [{ item_index: 1, marcado: true, ia_status: null }], (i) => i === 3);
    expect(n).toBe(2);
  });
});
