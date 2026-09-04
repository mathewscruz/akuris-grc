import { describe, expect, it } from 'vitest';
import { formatMoedasSomadas } from '@/hooks/useEmpresaMoeda';

describe('formatMoedasSomadas', () => {
  it('usa a moeda predominante da tela quando o total específico é zero', () => {
    const result = formatMoedasSomadas({}, 'EUR', true, { BRL: 692_000 });

    expect(result).toContain('R$');
    expect(result).not.toContain('€');
  });

  it('continua separando totais de moedas diferentes', () => {
    const result = formatMoedasSomadas({ BRL: 692_000, EUR: 12_000 }, 'BRL', true);

    expect(result).toContain('R$');
    expect(result).toContain('€');
    expect(result).toContain(' + ');
  });
});
