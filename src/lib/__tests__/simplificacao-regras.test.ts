import { describe, it, expect } from 'vitest';
import { diasRestantesTrial } from '@/components/TrialBanner';
import { linhasParaExportar } from '@/lib/exportar-tabela';

describe('período de teste de 14 dias', () => {
  const hoje = new Date('2026-10-20T12:00:00Z');
  it('conta os dias restantes a partir do início', () => {
    expect(diasRestantesTrial({ status_licenca: 'trial', data_inicio_trial: '2026-10-10T12:00:00Z' }, hoje)).toBe(4);
  });
  it('não há aviso quando a licença não é de teste', () => {
    expect(diasRestantesTrial({ status_licenca: 'ativa', data_inicio_trial: '2026-10-19T12:00:00Z' }, hoje)).toBe(0);
  });
  it('acaba após 14 dias', () => {
    expect(diasRestantesTrial({ status_licenca: 'trial', data_inicio_trial: '2026-10-01T12:00:00Z' }, hoje)).toBe(0);
  });
});

describe('exportação padrão das tabelas', () => {
  it('exporta os nomes, não objetos crus', () => {
    const linhas = linhasParaExportar([{ titulo: 'A', dono: { nome: 'Ana' }, n: 3 }], [
      { label: 'Título', valor: (i) => i.titulo },
      { label: 'Responsável', valor: (i) => i.dono },
      { label: 'Qtd', valor: (i) => i.n },
    ]);
    expect(linhas).toEqual([['A', 'Ana', '3']]);
  });
});
