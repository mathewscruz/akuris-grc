/**
 * Em telemóvel os dados vêm antes dos filtros.
 *
 * Medido em 375px: Activos tem quatro filtros, cada um com rótulo por cima e o
 * controlo por baixo, empilhados — cerca de 450px antes do primeiro registo,
 * num ecrã de 812px. Somando cabeçalho, acções e a faixa de KPIs, a primeira
 * linha de dados chegava ao fundo do ecrã. Numa lista, os dados são o
 * conteúdo; o filtro é a excepção.
 *
 * Havia um interruptor destes e desapareceu, deixando os restos: a `DataTable`
 * declarava `showFilters` e importava `countActiveFilters` e `IconFilter` sem
 * usar nenhum dos três.
 *
 * A metade que interessa guardar é a segunda: dobrar filtros ACTIVOS sem dizer
 * que existem seria trocar um defeito por outro — em vez de ocupar o ecrã,
 * mentir sobre ele.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => ({ 'common.filters': 'Filtros' }[k] ?? k) }),
}));

import { ModuleToolbar, ToolbarField } from '../module-toolbar';

const filtros = (
  <>
    <ToolbarField label="Status">
      <button role="combobox">Todos os status</button>
    </ToolbarField>
    <ToolbarField label="Criticidade">
      <button role="combobox">Todas</button>
    </ToolbarField>
  </>
);

describe('filtros em telemóvel', () => {
  it('vêm dobrados quando nenhum está aplicado', () => {
    const { container } = render(<ModuleToolbar filters={filtros} activeFilterCount={0} />);
    const caixa = container.querySelector('div.flex-col.gap-3.md\\:flex');
    expect(caixa?.className, 'sem filtro aplicado, dobrado').toContain('hidden');
    expect(screen.getByRole('button', { name: /Filtros/ })).toBeTruthy();
  });

  it('vêm abertos quando há filtro aplicado, e o botão di-lo', () => {
    const { container } = render(<ModuleToolbar filters={filtros} activeFilterCount={2} />);
    const caixa = container.querySelector('div.flex-col.gap-3.md\\:flex');
    expect(caixa?.className, 'com filtro aplicado, aberto').toContain('flex');
    expect(caixa?.className).not.toContain('hidden');
    // A contagem tem de estar no botão: dobrar em silêncio o que mexe no
    // resultado é a mesma mentira, com outra roupa.
    expect(screen.getByRole('button', { name: /Filtros/ }).textContent).toContain('2');
  });

  it('o botão não existe em ecrã largo', () => {
    /* `md:hidden`: a partir de `md` os filtros estão sempre à vista, que é onde
       há largura para eles, e o botão não deve sequer aparecer. */
    render(<ModuleToolbar filters={filtros} activeFilterCount={0} />);
    expect(screen.getByRole('button', { name: /Filtros/ }).className).toContain('md:hidden');
  });

  it('sem filtros não há botão nenhum', () => {
    render(<ModuleToolbar searchValue="" onSearchChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /Filtros/ })).toBeNull();
  });
});

describe('os restos do interruptor antigo', () => {
  it('a DataTable já não declara estado que não usa', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('src/components/ui/data-table.tsx', 'utf8');
    expect(fonte.includes('setShowFilters'), '`showFilters` era estado morto.').toBe(false);
    // `countActiveFilters` estava importado e por usar; agora alimenta o botão.
    expect(fonte.includes('countActiveFilters(filters)')).toBe(true);
  });
});
