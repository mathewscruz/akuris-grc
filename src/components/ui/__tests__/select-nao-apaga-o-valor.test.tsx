/**
 * O Select não apaga o valor que ainda não sabe desenhar.
 *
 * Reproduz o defeito do risco R-0011: as opções vêm de uma consulta e o valor
 * guardado chega primeiro. O Radix mantém um `<select>` nativo escondido para
 * os formulários; sem nenhuma `<option>` correspondente o navegador devolve
 * cadeia vazia, e o Radix entrega essa vazia ao `onValueChange` como se fosse
 * escolha de alguém. Quem gravasse a seguir escrevia `null`.
 *
 * O primeiro teste mostra o defeito com o Radix cru — é ele que garante que o
 * segundo não está a passar por acaso.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';

const VALOR = 'c9975e25-fb47-49e0-9ba3-ab10d62fed21';

/** As opções chegam depois do valor, como numa edição real. */
function Formulario({
  Raiz,
  aoMudar,
}: {
  Raiz: typeof Select | typeof SelectPrimitive.Root;
  aoMudar: (v: string) => void;
}) {
  const [valor, setValor] = useState('');
  const [opcoes, setOpcoes] = useState<string[]>([]);

  useEffect(() => {
    // o `form.reset` do formulário: o valor guardado entra primeiro
    setValor(VALOR);
    // e a consulta só responde depois
    const t = setTimeout(() => setOpcoes([VALOR, 'outra']), 20);
    return () => clearTimeout(t);
  }, []);

  const Conteudo = (
    <>
      <SelectTrigger>
        <SelectValue placeholder="Selecione uma categoria" />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o} value={o}>
            {o === VALOR ? 'Operacional' : 'Outra'}
          </SelectItem>
        ))}
      </SelectContent>
    </>
  );

  return (
    // O `<form>` é o que faz o Radix montar o `<select>` nativo escondido.
    <form>
      <Raiz
        value={valor}
        onValueChange={(v: string) => {
          aoMudar(v);
          setValor(v);
        }}
      >
        {Conteudo}
      </Raiz>
    </form>
  );
}

describe('o Select perante um valor que a lista ainda não tem', () => {
  it('o Radix cru devolve cadeia vazia — é este o defeito', async () => {
    const aoMudar = vi.fn();
    render(<Formulario Raiz={SelectPrimitive.Root} aoMudar={aoMudar} />);

    await waitFor(() => expect(aoMudar).toHaveBeenCalled(), { timeout: 1000 });
    expect(
      aoMudar.mock.calls.map((c) => c[0]),
      'Se isto deixar de acontecer, o Radix corrigiu-o e a nossa guarda pode sair.',
    ).toContain('');
  });

  it('o nosso Select segura o valor', async () => {
    const aoMudar = vi.fn();
    render(<Formulario Raiz={Select} aoMudar={aoMudar} />);

    // tempo de sobra para as opções chegarem e o `<select>` nativo reagir
    await new Promise((r) => setTimeout(r, 200));

    expect(
      aoMudar.mock.calls.map((c) => c[0]),
      'A vazia nunca pode vir de uma escolha: o Radix recusa um SelectItem com value="". ' +
        'Se ela chegou ao formulário, é o navegador a recusar um valor que a lista ainda não tinha.',
    ).not.toContain('');
  });
});
