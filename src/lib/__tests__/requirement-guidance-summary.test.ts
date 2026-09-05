import { describe, expect, it } from 'vitest';
import { implementationExcerpt } from '../requirement-guidance-summary';

describe('implementation excerpt', () => {
  it('extracts the practical section without repeating the introductory article', () => {
    const content = '## O que significa\nUma explicação longa.\n## Dicas práticas de implementação\n- Identifique o contexto.\n- Registre os fatores.\n- Revise com a equipe.\n- Atualize quando necessário.\n## Evidências\nDocumento.';
    expect(implementationExcerpt(content)).toBe('- Identifique o contexto.\n- Registre os fatores.\n- Revise com a equipe.');
    expect(content).toContain('Atualize quando necessário.');
  });
  it('supports English implementation guidance and preserves short unstructured guidance', () => {
    expect(implementationExcerpt('## How to implement\n1. Define scope.\n2. Record evidence.')).toBe('1. Define scope.\n2. Record evidence.');
    expect(implementationExcerpt('Defina o processo.')).toBe('Defina o processo.');
  });
  it('does not label a long generic article as an implementation summary', () => {
    expect(implementationExcerpt('## Contexto\nTexto de contexto.')).toBe('');
    expect(implementationExcerpt('Texto '.repeat(200))).toBe('');
    expect(implementationExcerpt(null)).toBe('');
  });
});
