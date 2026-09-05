import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AlertsDetailDialog from './AlertsDetailDialog';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ui/dialog-shell', () => ({ DialogShell: ({ open, children }: any) => open ? <div role="dialog">{children}</div> : null }));
vi.mock('@/components/ui/stat-strip', () => ({ AnimatedMetricValue: ({ value }: any) => <span>{value}</span> }));
afterEach(cleanup);
const alerts = Array.from({ length: 6 }, (_, i) => ({ type: 'prazo' as const, id: `row-${i}`, title: `Due ${i}`, description: '', href: i === 5 ? '/governanca/controles?controle=old' : `/planos-acao?plano=${i}` }));
const breakdown = { riscosCriticos: 0, naoConformidadesCriticas: 0, incidentesCriticos: 0, prazosVencidos: 6 };
function Path() { const path = useLocation(); return <output>{path.pathname}{path.search}</output>; }

it('paginates a mixed overdue group without losing the exact origin', () => {
  const onOpenChange = vi.fn();
  render(<MemoryRouter><AlertsDetailDialog open onOpenChange={onOpenChange} alertDetails={alerts} breakdown={breakdown} /><Path /></MemoryRouter>);
  expect(screen.queryByText('Due 5')).toBeNull();
  expect(screen.getByRole('button', { name: 'experience.previous' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'experience.next' }));
  expect(screen.queryByText('Due 0')).toBeNull();
  expect(screen.getByRole('button', { name: 'experience.next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Due 5' }));
  expect(screen.getByRole('status')).toHaveTextContent('/governanca/controles?controle=old');
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it('reopening starts on the first page', () => {
  const view = (open: boolean) => <MemoryRouter><AlertsDetailDialog open={open} onOpenChange={vi.fn()} alertDetails={alerts} breakdown={breakdown} /></MemoryRouter>;
  const { rerender } = render(view(true));
  fireEvent.click(screen.getByRole('button', { name: 'experience.next' }));
  rerender(view(false)); rerender(view(true));
  expect(screen.getByText('Due 0')).toBeInTheDocument();
  expect(screen.queryByText('Due 5')).toBeNull();
});
