import { describe, it, expect } from 'vitest';
import {
  normalizarTexto,
  sugerirPrazoPorPrioridade,
  sugerirCategoriaPorTitulo,
  sugerirPrioridadePorCriticidade,
  DIAS_POR_PRIORIDADE,
} from '@/lib/preenchimento-inteligente';

describe('preenchimento inteligente', () => {
  it('normaliza acentos e maiúsculas', () => {
    expect(normalizarTexto('Segurança da Informação')).toBe('seguranca da informacao');
  });

  it('sugere prazo de 7 dias para prioridade crítica', () => {
    const hoje = new Date('2026-10-15T12:00:00Z');
    expect(sugerirPrazoPorPrioridade('critica', hoje)).toBe('2026-10-22');
  });

  it('sugere prazo de 30 dias para prioridade média', () => {
    const hoje = new Date('2026-10-15T12:00:00Z');
    expect(sugerirPrazoPorPrioridade('media', hoje)).toBe('2026-11-14');
  });

  it('não inventa prazo para prioridade desconhecida', () => {
    expect(sugerirPrazoPorPrioridade('urgentissima')).toBeNull();
  });

  it('cobre as quatro prioridades do sistema', () => {
    expect(Object.keys(DIAS_POR_PRIORIDADE).sort()).toEqual(['alta', 'baixa', 'critica', 'media']);
  });

  it('sugere categoria quando o nome aparece no título', () => {
    const categorias = [
      { id: '1', nome: 'Operacional' },
      { id: '2', nome: 'Segurança da Informação' },
    ];
    expect(sugerirCategoriaPorTitulo('Falha de segurança da informação no VPN', categorias)).toBe('2');
  });

  it('sugere categoria por palavras do tema, mesmo com acento diferente', () => {
    const categorias = [{ id: '9', nome: 'Privacidade' }];
    expect(sugerirCategoriaPorTitulo('Titular pediu exclusão LGPD', categorias)).toBe('9');
  });

  it('devolve null quando nada combina', () => {
    const categorias = [{ id: '1', nome: 'Operacional' }];
    expect(sugerirCategoriaPorTitulo('xyzzy plugh', categorias)).toBeNull();
  });

  it('mapeia criticidade para prioridade', () => {
    expect(sugerirPrioridadePorCriticidade('Crítica')).toBe('critica');
    expect(sugerirPrioridadePorCriticidade('alto')).toBe('alta');
    expect(sugerirPrioridadePorCriticidade('desconhecida')).toBeNull();
  });
});
