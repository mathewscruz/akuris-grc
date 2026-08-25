/**
 * O rodapé de um diálogo é o casco do diálogo, não uma superfície nova.
 *
 * ## O que estava errado
 *
 * A barra de "Cancelar / Criar" levava `bg-card`. Parece inofensivo até se ver
 * quem mais usa esse token: `input`, `textarea` e `select` — os CAMPOS. No tema
 * escuro `--card` (216 40% 14%) é mais escuro que `--popover` (216 36% 18%), que
 * é o casco do diálogo. Resultado: uma faixa azul-escura, recuada, com
 * exactamente a cor de um campo de formulário — e era assim que se lia, como se
 * o rodapé fosse mais um campo por preencher.
 *
 * ## A regra
 *
 * O rodapé não pinta fundo nenhum: herda o casco (`bg-popover` do
 * `DialogContent`), e assim acompanha-o nos dois temas sem ter de os conhecer.
 * Só um rodapé verdadeiramente `sticky` — em que o conteúdo passa POR BAIXO —
 * precisa de fundo opaco, e aí usa o casco explicitamente (`bg-popover`), nunca
 * o token dos campos nem a tela da aplicação (`bg-background`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes } from './_fontes';

describe('rodapé de diálogo não é campo', () => {
  it('nenhum rodapé de diálogo se pinta com o token dos campos', () => {
    /*
      Um rodapé reconhece-se por `border-t` (o fio que o separa do corpo) na
      mesma classe que uma cor de fundo de superfície. `bg-card` é o token dos
      campos; `bg-background` é a tela da aplicação, que dentro de um diálogo
      entra como um quarto de outra cor.
    */
    const proibido = /className="[^"]*\bborder-t\b[^"]*\bbg-(card|background)(\/\d+)?\b[^"]*"/;

    /*
      Uma excepção, e é mesmo excepção: no chatbot da AkurIA o casco JÁ é
      `bg-card` (é um painel flutuante, não um diálogo), e a barra de baixo não
      é uma barra de acções — é a caixa onde se escreve. Ali parecer um campo
      não é defeito: é o que a barra é.
    */
    const excepcoes = ['dashboard/AkurIAChatbot.tsx'];

    const infratores: string[] = [];
    for (const ficheiro of fontes()) {
      if (excepcoes.some((e) => ficheiro.replace(/\\/g, '/').endsWith(e))) continue;
      const texto = readFileSync(ficheiro, 'utf8');
      texto.split('\n').forEach((linha, i) => {
        if (proibido.test(linha)) {
          infratores.push(`${ficheiro}:${i + 1} → ${linha.trim().slice(0, 90)}`);
        }
      });
    }

    expect(
      infratores,
      'Rodapé de diálogo com fundo de campo (`bg-card`) ou da tela ' +
        '(`bg-background`). Tire a classe de fundo — o rodapé herda o casco do ' +
        'diálogo. Se for mesmo `sticky`, use `bg-popover`.',
    ).toEqual([]);
  });
});
