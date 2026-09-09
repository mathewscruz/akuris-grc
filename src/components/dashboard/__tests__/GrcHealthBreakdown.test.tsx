import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrcHealthBreakdown } from '../GrcHealthBreakdown';

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  data: [
    { subject: 'riscos', score: 80, hasData: true, details: { metrics: ['Dados de riscos'] }, acao: null, link: '/riscos' },
    { subject: 'gapAnalysis', score: 20, hasData: true, details: { metrics: ['Avaliação em andamento'] }, acao: null, link: '/gap-analysis/frameworks' },
    { subject: 'incidentes', score: 0, hasData: false, details: { metrics: [] }, acao: null, link: '/incidentes' },
  ],
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }));
vi.mock('@/hooks/useRadarChartData', () => ({ useRadarChartData: () => ({ data: state.data, isLoading: false, isError: false }) }));
vi.mock('@/hooks/useGrcMaturityScore', () => ({ useGrcMaturityScore: () => ({ score: 50, label: 'Atenção', modulesWithData: 2, totalModules: 3 }) }));
vi.mock('@/components/ui/stat-strip', () => ({ AnimatedMetricValue: ({ value }: { value: number }) => <>{value}</> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('leitura executiva do dashboard', () => {
  it('mostra o índice operacional uma vez, com sua base explícita', () => {
    render(<GrcHealthBreakdown />);
    expect(screen.getAllByRole('img', { name: 'Índice operacional: 50/100' })).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Índice operacional: 50/100' })).toHaveClass('executive-ring--operational');
    expect(screen.getByText('2 de 3 módulos com dados')).toBeInTheDocument();
    expect(screen.getByText(/Não representa uma certificação/)).toBeInTheDocument();
  });
  it('não considera módulo sem dados como zero e mantém navegação', () => {
    const { container } = render(<GrcHealthBreakdown />);
    const modules = [...container.querySelectorAll('article button[aria-label]')];
    expect(modules).toHaveLength(3);
    fireEvent.click(modules[0]);
    expect(state.navigate).toHaveBeenCalledWith('/gap-analysis/frameworks');
    fireEvent.click(modules[2]);
    expect(state.navigate).toHaveBeenLastCalledWith('/incidentes');
    expect(container.querySelector('article:last-child [aria-valuenow="0"]')).toBeNull();
  });
});
