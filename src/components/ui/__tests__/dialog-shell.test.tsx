import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DialogShell } from '@/components/ui/dialog-shell';

afterEach(() => cleanup());

function describedByElements(dialog: HTMLElement): HTMLElement[] {
  const ids = (dialog.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  return ids
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
}

describe('DialogShell — descrição acessível (AKURIS QA-002)', () => {
  it('expõe descrição acessível mesmo quando o consumidor não informa "description"', () => {
    render(
      <DialogShell open onOpenChange={() => {}} title="Gerador de Documentos (IA)">
        <p>conteúdo</p>
      </DialogShell>
    );

    const dialog = screen.getByRole('dialog');
    const described = describedByElements(dialog);

    // Exatamente um alvo de aria-describedby (sem duplicidade/conflito)
    expect(described).toHaveLength(1);
    expect(described[0].textContent?.trim()).not.toBe('');
    // O fallback não deve alterar o layout visual: é apenas para leitores de tela
    expect(described[0]).toHaveClass('sr-only');
    // Descreve a finalidade da janela, sem instruções genéricas de teclado
    expect(described[0]).toHaveTextContent('Gerador de Documentos (IA)');
    expect(described[0].textContent).not.toMatch(/\bTab\b|\bEsc\b/);
  });

  it('trata description vazia como ausente e mantém o fallback', () => {
    render(
      <DialogShell open onOpenChange={() => {}} title="Diálogo" description="">
        <p>conteúdo</p>
      </DialogShell>
    );

    const described = describedByElements(screen.getByRole('dialog'));

    expect(described).toHaveLength(1);
    expect(described[0].textContent?.trim()).not.toBe('');
    expect(described[0]).toHaveClass('sr-only');
  });

  it('não emite o aviso do Radix sobre Description ausente', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DialogShell open onOpenChange={() => {}} title="Diálogo sem descrição">
        <p>conteúdo</p>
      </DialogShell>
    );

    const mensagens = [...warn.mock.calls, ...error.mock.calls]
      .flat()
      .map((arg) => String(arg))
      .join('\n');

    expect(mensagens).not.toMatch(/aria-describedby|Missing `?Description/i);

    warn.mockRestore();
    error.mockRestore();
  });

  it('usa a descrição informada pelo consumidor, visível e única', () => {
    const description = 'Cadastre um novo documento com classificação e validade.';

    render(
      <DialogShell open onOpenChange={() => {}} title="Novo Documento" description={description}>
        <p>conteúdo</p>
      </DialogShell>
    );

    const dialog = screen.getByRole('dialog');
    const described = describedByElements(dialog);

    expect(described).toHaveLength(1);
    expect(described[0]).toHaveTextContent(description);
    expect(described[0]).not.toHaveClass('sr-only');
  });

  it('permite descrição própria apenas para leitores de tela via descriptionSrOnly', () => {
    const description = 'Assistente de IA para gerar documentos.';

    render(
      <DialogShell
        open
        onOpenChange={() => {}}
        title="Gerador de Documentos (IA)"
        description={description}
        descriptionSrOnly
      >
        <p>conteúdo</p>
      </DialogShell>
    );

    const dialog = screen.getByRole('dialog');
    const described = describedByElements(dialog);

    expect(described).toHaveLength(1);
    expect(described[0]).toHaveTextContent(description);
    expect(described[0]).toHaveClass('sr-only');
  });
});
