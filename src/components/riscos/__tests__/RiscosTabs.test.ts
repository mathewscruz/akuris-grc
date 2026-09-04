import { describe, expect, it } from 'vitest';
import { resolveRiscosView } from '../RiscosTabs';

describe('RiscosTabs', () => {
  it('redireciona o link legado da visão geral para a tabela', () => {
    expect(resolveRiscosView('overview', 'matrix')).toBe('table');
  });

  it('usa a última área válida quando a URL não escolhe uma visão', () => {
    expect(resolveRiscosView(null, 'matrix')).toBe('matrix');
    expect(resolveRiscosView(null, 'overview')).toBe('table');
  });

  it('preserva as três áreas operacionais válidas', () => {
    expect(resolveRiscosView('matrix', null)).toBe('matrix');
    expect(resolveRiscosView('table', null)).toBe('table');
    expect(resolveRiscosView('aceite', null)).toBe('aceite');
  });
});
