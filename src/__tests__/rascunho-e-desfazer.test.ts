import { describe, it, expect, vi } from 'vitest';
vi.mock('sonner', () => ({ toast: vi.fn() }));
import { toast } from 'sonner';
import { scopedDraftKey } from '@/hooks/useWizardDraft';
import { undoableAction } from '@/lib/undoable-action';

describe('rascunho isolado por empresa e usuário', () => {
  it('empresas diferentes nunca partilham a mesma chave', () => {
    expect(scopedDraftKey('emp-a', 'u1', 'contrato')).not.toBe(scopedDraftKey('emp-b', 'u1', 'contrato'));
  });
  it('usuários diferentes da mesma empresa nunca partilham a mesma chave', () => {
    expect(scopedDraftKey('emp-a', 'u1', 'contrato')).not.toBe(scopedDraftKey('emp-a', 'u2', 'contrato'));
  });
});

describe('excluir com desfazer', () => {
  it('"Desfazer" impede a exclusão', async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const p = undoableAction({ message: 'x', undoLabel: 'Desfazer', onCommit });
    const opts = (toast as any).mock.calls.at(-1)[1];
    opts.action.onClick();
    vi.advanceTimersByTime(6000);
    await expect(p).resolves.toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it('sem desfazer, exclui após o prazo', async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const p = undoableAction({ message: 'x', undoLabel: 'Desfazer', onCommit, durationMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toBe(true);
    expect(onCommit).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
