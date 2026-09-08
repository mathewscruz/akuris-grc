import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { auditItemSummary, isHistoricalAuditItem } from '@/lib/auditoria-itens';
import { ItensAuditoriaDialog } from '../ItensAuditoriaDialog';

const rows = [
  { id: 'active', codigo: 'QA-ACTIVE', titulo: 'Active control', status: 'concluido', prioridade: 'media', controle_vinculado_id: 'control-a', controle_excluido_em: null },
  { id: 'deleted', codigo: 'QA-DELETED', titulo: 'Deleted control', status: 'em_andamento', prioridade: 'media', controle_vinculado_id: null, controle_excluido_em: '2026-09-08T14:00:00Z' },
  { id: 'unlinked', codigo: 'QA-UNLINKED', titulo: 'Unlinked work', status: 'pendente', prioridade: 'media', controle_vinculado_id: null, controle_excluido_em: null },
];
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey[0] === 'auditoria-itens' ? rows : {}, isLoading: false }),
}));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string, args?: Record<string, unknown>) => {
  if (key === 'controlesAuditorias.iadHistory') return `View history (${args?.count})`;
  if (key === 'controlesAuditorias.iadOperational') return 'Back to scope';
  if (key === 'controlesAuditorias.iadTotal') return `Total: ${args?.count}`;
  if (key === 'controlesAuditorias.iadProgressoConcluido') return `Progress: ${args?.percent}%`;
  return key;
} }) }));
vi.mock('@/hooks/useUsuariosEmpresa', () => ({ useUsuariosEmpresa: () => ({ data: [] }) }));
vi.mock('@/components/ui/dialog-shell', () => ({ DialogShell: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <section>{children}</section> : null }));
vi.mock('../ItemAuditoriaFormDialog', () => ({ ItemAuditoriaFormDialog: () => null }));
vi.mock('../ItemAuditoriaDetalheDialog', () => ({ ItemAuditoriaDetalheDialog: () => null }));
vi.mock('../ImportarControlesDialog', () => ({ ImportarControlesDialog: () => null }));
afterEach(cleanup);

describe('deleted control audit history', () => {
  it('counts only operational work, including intentional unlinking', () => {
    expect(auditItemSummary(rows)).toEqual({ total: 2, pendente: 1, em_andamento: 0, concluido: 1 });
    expect(isHistoricalAuditItem(rows[2])).toBe(false);
    expect(auditItemSummary([]).total).toBe(0);
  });
  it('hides deleted controls by default and exposes history without altering progress', () => {
    render(<ItensAuditoriaDialog open onOpenChange={() => {}} auditoriaId="audit" auditoriaNome="QA audit" />);
    expect(screen.getByText('QA-ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('QA-UNLINKED')).toBeInTheDocument();
    expect(screen.queryByText('QA-DELETED')).not.toBeInTheDocument();
    expect(screen.getByText('Total: 2')).toBeInTheDocument();
    expect(screen.getByText('Progress: 50%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View history (1)' }));
    expect(screen.getByText('QA-DELETED')).toBeInTheDocument();
    expect(screen.queryByText('QA-ACTIVE')).not.toBeInTheDocument();
    expect(screen.getByText('Total: 2')).toBeInTheDocument();
    expect(screen.getByText('Progress: 50%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to scope' }));
    expect(screen.queryByText('QA-DELETED')).not.toBeInTheDocument();
  });
  it('resets history on close, so the next audit opens in operational mode', () => {
    const { rerender } = render(<ItensAuditoriaDialog open onOpenChange={() => {}} auditoriaId="audit" auditoriaNome="QA" />);
    fireEvent.click(screen.getByRole('button', { name: 'View history (1)' }));
    rerender(<ItensAuditoriaDialog open={false} onOpenChange={() => {}} auditoriaId="audit" auditoriaNome="QA" />);
    rerender(<ItensAuditoriaDialog open onOpenChange={() => {}} auditoriaId="audit" auditoriaNome="QA" />);
    expect(screen.queryByText('QA-DELETED')).not.toBeInTheDocument();
  });
  it('filters downstream operational queries, including notifications', () => {
    for (const path of [
      'src/components/governanca/AuditoriasContent.tsx',
      'src/components/auditorias/AuditoriaDialog.tsx',
      'src/components/dashboard/KpiDrillDownDrawer.tsx',
      'src/components/relatorios/generateTemplatePDF.ts',
      'src/pages/PlanosAcao.tsx',
      'src/lib/entity-search.ts',
      'supabase/functions/send-auditoria-item-notification/index.ts',
    ]) expect(readFileSync(path, 'utf8'), path).toContain(".is('controle_excluido_em', null)");
  });
});
