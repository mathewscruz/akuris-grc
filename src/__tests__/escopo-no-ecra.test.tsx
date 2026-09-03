/**
 * O assistente de escopo, montado e clicado.
 *
 * As outras guardas deste par (`escopo-fala-ingles.test.ts`) provam a lógica.
 * Esta prova o ECRÃ, que é onde os dois defeitos apareciam ao utilizador:
 *
 *  · clicar em "Não sei" não marcava o botão nem mexia no contador;
 *  · com a aplicação em inglês, as perguntas saíam em português.
 *
 * Vale a pena montar, e não só chamar as funções: o primeiro defeito estava
 * exactamente na cola entre a lógica e o estado do React — a lógica pura sempre
 * esteve certa, era o `setRespostas` que apagava a resposta. Uma guarda que só
 * olhasse para `aplicarTravas` teria passado com o ecrã partido.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { AssistenteDeEscopo } from '@/components/gap-analysis/v2/AssistenteDeEscopo';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { persistExplicitLocale } from '@/lib/i18n-locale';

/* O ecrã lê `gap_analysis_requirements` ao abrir, só para mapear código -> id.
   Sem servidor a promessa rejeita e derruba o teste por uma razão que não é a
   que se está a medir. As perguntas não dependem desta consulta. */
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: async () => ({ data: [{ id: 'r1', codigo: 'A.8.25' }], error: null }) }) }),
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));

function montar(locale: 'pt-BR' | 'en') {
  /* Sem a marca de escolha explícita o provider ignora a chave e volta a
     autodetectar pelo fuso — que aqui é o do Brasil. */
  persistExplicitLocale(locale);
  return render(
    <LanguageProvider>
      <AssistenteDeEscopo
        open
        onOpenChange={() => {}}
        frameworkId="f1"
        frameworkName="ISO/IEC 27001"
        empresaId="e1"
        totalRequisitos={121}
        onAplicado={() => {}}
      />
    </LanguageProvider>,
  );
}

/** O cartão de uma pergunta, encontrado pelo número de ordem. */
function cartao(n: string) {
  return screen.getByText(n).closest('div.rounded-lg') as HTMLElement;
}

beforeEach(() => localStorage.clear());

describe('"Não sei" no ecrã', () => {
  it('marca o botão e conta como respondida', () => {
    montar('pt-BR');
    expect(screen.getByText(/0 de 9 respondidas/)).toBeTruthy();

    const botao = within(cartao('01')).getByRole('button', { name: 'Não sei' });
    expect(botao.className, 'já vinha marcado').not.toContain('bg-primary/10');

    fireEvent.click(botao);

    expect(botao.className, 'o botão não ficou marcado').toContain('bg-primary/10');
    expect(screen.getByText(/1 de 9 respondidas/), 'o contador não subiu').toBeTruthy();
  });

  it('confirma o escopo quando todas as respostas mantêm tudo aplicável', async () => {
    montar('pt-BR');
    for (const n of ['01', '02', '03', '04', '05', '06', '07', '08', '09']) {
      fireEvent.click(within(cartao(n)).getByRole('button', { name: 'Não sei' }));
    }
    expect(screen.getByText(/9 de 9 respondidas/)).toBeTruthy();
    expect(screen.queryByText(/saem, restam/)).toBeNull();
    const confirmar = screen.getByRole('button', { name: /Confirmar escopo/ });
    await waitFor(() => expect(confirmar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(confirmar);
    expect(screen.getByText(/Nenhum requisito será excluído/)).toBeTruthy();
  });

  it('"Não" continua a excluir e a dizer quantos', () => {
    montar('pt-BR');
    fireEvent.click(within(cartao('06')).getByRole('button', { name: 'Não' }));
    // desenvolvimento_interno: A.8.25, A.8.27, A.8.28
    expect(screen.getByText(/3 requisito\(s\) saem do escopo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Revisar o que sai/ }).hasAttribute('disabled')).toBe(true);
  });

  it('a trava muda a resposta e diz porquê, sem apagar as outras', () => {
    montar('pt-BR');
    fireEvent.click(within(cartao('07')).getByRole('button', { name: 'Não sei' }));
    fireEvent.click(within(cartao('01')).getByRole('button', { name: 'Não' }));

    expect(screen.getByText(/todo mundo trabalha fora dele/)).toBeTruthy();
    expect(within(cartao('04')).getByRole('button', { name: 'Sim' }).className).toContain('bg-primary/10');
    expect(
      within(cartao('07')).getByRole('button', { name: 'Não sei' }).className,
      'a trava apagou uma resposta que não era sua',
    ).toContain('bg-primary/10');
  });
});

describe('em inglês, o ecrã é inglês inteiro', () => {
  it('rótulos, pergunta e ajuda', () => {
    montar('en');
    expect(screen.getByText(/0 of 9 answered/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Confirm scope/ })).toBeTruthy();
    expect(within(cartao('01')).getByRole('button', { name: 'Not sure' })).toBeTruthy();
    expect(screen.getByText(/Does the company occupy any physical address/)).toBeTruthy();
    expect(screen.queryByText(/A empresa ocupa algum endereço/), 'pergunta em português').toBeNull();
  });

  it('a intro conta as perguntas certas', () => {
    montar('en');
    expect(screen.getByText(/These 9 questions describe how your company actually works/)).toBeTruthy();
  });

  it('o que só aparece depois de responder também está traduzido', () => {
    montar('en');
    fireEvent.click(within(cartao('06')).getByRole('button', { name: 'No' }));
    expect(screen.getByText(/3 requirement\(s\) leave the scope/)).toBeTruthy();
    expect(screen.getByText(/they apply to off-the-shelf systems too/)).toBeTruthy();
  });

  it('a justificativa que a empresa assina está em inglês', async () => {
    montar('en');
    fireEvent.click(within(cartao('06')).getByRole('button', { name: 'No' }));
    for (const n of ['01', '02', '03', '04', '05', '07', '08', '09']) {
      fireEvent.click(within(cartao(n)).getByRole('button', { name: 'Not sure' }));
    }
    const review = screen.getByRole('button', { name: /Review what leaves/ });
    await waitFor(() => expect(review.hasAttribute('disabled')).toBe(false));
    fireEvent.click(review);

    expect(screen.getByText(/WHAT WILL BE WRITTEN IN THE STATEMENT OF APPLICABILITY/)).toBeTruthy();
    const caixa = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(caixa.value).toContain('The organization does not develop software in house');
    expect(caixa.value, 'justificativa em português num documento inglês').not.toContain('organização');
  });
});
