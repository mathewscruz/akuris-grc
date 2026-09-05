import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CentroPrivacidadeTab } from '../CentroPrivacidadeTab';

const query = vi.hoisted(() => ({ data: null as unknown, isLoading: false, isError: false, refetch: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => query, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useEmpresaId', () => ({ useEmpresaId: () => ({ empresaId: 'tenant' }) }));
vi.mock('@/hooks/useListState', () => ({ useListState: (_key: string, initial: string) => useState(initial) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/dashboard/KpiDrillDownProvider', () => ({ useKpiDrillDown: () => ({ open: vi.fn() }) }));

const props = { dadosPessoais: [], ropaRegistros: [], solicitacoes: [], incidentesPrivacidade: 0, onNavigate: vi.fn(), canCreate: true, canUpdate: true, canDelete: true };
beforeEach(() => {
  query.data = null; query.isLoading = false; query.isError = false;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('orientação do programa de privacidade', () => {
  it('sem registros não exibe 0/0 nem pontuação positiva', () => {
    const { container } = render(<CentroPrivacidadeTab {...props} />);
    expect(container.textContent).not.toContain('0/0');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('experience.privacyNoEvidence')).toBeInTheDocument();
    expect(screen.getAllByText('experience.notStarted')).toHaveLength(3);
  });
  it('oferece áreas com nome acessível e orientação contextual nas avaliações', () => {
    render(<CentroPrivacidadeTab {...props} />);
    expect(screen.getByRole('tablist', { name: 'experience.privacyArea' })).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('combobox', { name: 'experience.privacyArea' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'privacidadePrograma.subtabs.avaliacoes' }), { key: 'Enter' });
    expect(screen.getByRole('tab', { name: 'privacidadePrograma.subtabs.avaliacoes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('experience.privacyGlossary')).toBeInTheDocument();
  });
  it('carregamento e erro não anunciam ausência de registros', () => {
    query.isLoading = true;
    const view = render(<CentroPrivacidadeTab {...props} />);
    expect(screen.getByRole('status')).toHaveAccessibleName('common.loading');
    expect(screen.queryByText('experience.privacyNoEvidence')).toBeNull();
    query.isLoading = false; query.isError = true;
    view.rerender(<CentroPrivacidadeTab {...props} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'privacidadePrograma.comum.tentarNovamente' }));
    expect(query.refetch).toHaveBeenCalled();
  });
});
