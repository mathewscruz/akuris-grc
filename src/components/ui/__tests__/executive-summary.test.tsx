import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExecutiveBar, ScoreRing } from '../executive-summary';
import { operationalScoreColor } from '@/lib/operational-score-color';

vi.mock('@/lib/motion-preferences', () => ({ useMotionAllowed: () => false }));
vi.mock('../stat-strip', () => ({ AnimatedMetricValue: ({ value }: { value: number }) => <>{value}</> }));
afterEach(cleanup);

describe('indicadores executivos', () => {
  it('não preenche o anel quando o score é zero', () => {
    const { container } = render(<ScoreRing value={0} label="Aderência" suffix="%" />);
    expect(screen.getByRole('img', { name: 'Aderência: 0%' })).toBeInTheDocument();
    expect(container.querySelector('[data-score-arc]')).toBeNull();
  });
  it('distingue valor ausente de zero', () => {
    render(<ScoreRing value={null} label="Índice" />);
    expect(screen.getByRole('img', { name: 'Índice: —' })).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });
  it('o arco acompanha o valor e respeita movimento reduzido', () => {
    const { container } = render(<ScoreRing value={64} label="Índice" />);
    const arc = container.querySelector('[data-score-arc]');
    expect(arc).toHaveAttribute('stroke-dashoffset', '36');
    expect(arc).not.toHaveClass('executive-ring-enter');
  });
  it('mantém a barra em seu domínio e não anuncia ausência como medição', () => {
    const { rerender } = render(<ExecutiveBar value={150} label="Cobertura" />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ExecutiveBar value={null} label="Cobertura" />);
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByRole('img', { name: 'Cobertura: —' })).toBeInTheDocument();
  });
  it('o anel operacional acompanha mudanças de pontuação sem mudar o valor ou o rótulo acessível', () => {
    const { rerender, container } = render(<ScoreRing value={45} label="Índice operacional" colorScale="operational" />);
    expect(screen.getByRole('img').style.getPropertyValue('--score-color')).toBe(operationalScoreColor(45));
    expect(container.querySelector('[data-score-value]')).toHaveTextContent('45');
    rerender(<ScoreRing value={46} label="Índice operacional" colorScale="operational" />);
    expect(screen.getByRole('img', { name: 'Índice operacional: 46/100' }).style.getPropertyValue('--score-color')).toBe(operationalScoreColor(46));
    expect(container.querySelector('[data-score-arc]')).toHaveAttribute('stroke-dashoffset', '54');
  });
  it('não colore ausência de dados como resultado ruim nem altera a paleta padrão dos outros módulos', () => {
    const { rerender } = render(<ScoreRing value={null} label="Índice" colorScale="operational" />);
    expect(screen.getByRole('img').style.getPropertyValue('--score-color')).toBe('hsl(var(--muted-foreground))');
    rerender(<ScoreRing value={75} label="Aderência" />);
    expect(screen.getByRole('img')).toHaveClass('text-primary');
    expect(screen.getByRole('img').style.getPropertyValue('--score-color')).toBe('');
  });
});
