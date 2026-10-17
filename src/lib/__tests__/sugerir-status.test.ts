import { describe, it, expect } from 'vitest';
import { sugerirStatus, contarEvidenciasEsperadas } from '../gap-analysis/sugerir-status';

describe('sugerirStatus', () => {
  it('sem evidência ligada não sugere nada', () => {
    expect(sugerirStatus({ esperadas: 3, encontradas: 0 })).toBeNull();
  });
  it('todas as evidências ligadas sugere conforme', () => {
    expect(sugerirStatus({ esperadas: 3, encontradas: 3 })).toBe('conforme');
  });
  it('parte das evidências sugere parcial', () => {
    expect(sugerirStatus({ esperadas: 3, encontradas: 2 })).toBe('parcial');
  });
});

describe('contarEvidenciasEsperadas', () => {
  it('conta itens de lista', () => {
    expect(contarEvidenciasEsperadas('Intro\n- a\n- b\n1. c')).toBe(3);
  });
});
