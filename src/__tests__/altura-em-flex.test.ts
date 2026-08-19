/**
 * Altura dentro de um diálogo mede-se por flex, nunca por percentagem.
 *
 * O defeito real, encontrado a 1366×768: o botão Salvar do "Novo Risco" ficava
 * cortado pela borda do diálogo. A causa não era o diálogo — era `height:100%`
 * a resolver contra um pai cuja altura vinha do flex. Percentagem só resolve
 * contra altura definida, e altura vinda do flex não conta como tal; o
 * `h-full` caía para `auto`, o conteúdo crescia à vontade e empurrava o rodapé
 * para fora da moldura. O `ScrollArea` do Radix tinha o mesmo `h-full` por
 * dentro, o que punha duas camadas do mesmo erro empilhadas.
 *
 * As duas regras abaixo são o que impede a volta:
 *   1. um item de flex com `overflow` tem de poder encolher (`min-h-0`);
 *   2. nada de `h-full` dentro do `ScrollArea` nem no corpo do diálogo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTsx, ler, linhas } from './_fontes';

const arquivos = fontesTsx();

/** Todas as strings de className de um arquivo. */
function classes(f: string): { linha: number; valor: string }[] {
  const ls = linhas(f);
  const achados: { linha: number; valor: string }[] = [];
  ls.forEach((l, i) => {
    for (const m of l.matchAll(/className="([^"]*)"/g)) achados.push({ linha: i + 1, valor: m[1] });
  });
  return achados;
}

describe('altura dentro de contentores que rolam', () => {
  it('um item de flex com overflow pode encolher', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      for (const { linha, valor } of classes(f)) {
        const l = valor.split(/\s+/);
        if (!l.includes('flex-1')) continue;
        if (!l.some((c) => c === 'overflow-hidden' || c === 'overflow-y-auto')) continue;
        // altura fixa já resolve o problema — é o caso das barras de progresso
        if (l.some((c) => /^h-(\d|\[)/.test(c))) continue;
        if (l.includes('min-h-0')) continue;
        infratores.push(`${f}:${linha}`);
      }
    }
    expect(
      infratores,
      'Acrescente min-h-0: sem ele o item recusa encolher abaixo do conteúdo e o que vem a seguir sai pela borda.',
    ).toEqual([]);
  });

  it('o ScrollArea mede-se por flex, não por percentagem', () => {
    const sa = readFileSync('src/components/ui/scroll-area.tsx', 'utf8');
    expect(sa, 'O Root do ScrollArea tem de ser uma coluna de flex.').toContain('flex flex-col');
    expect(sa, 'O viewport tem de ser flex-1 min-h-0, não h-full.').toContain('min-h-0 flex-1');
    expect(/Viewport className="[^"]*\bh-full\b/.test(sa), 'h-full no viewport foi a causa do rodapé cortado.').toBe(false);
  });

  it('nenhum ScrollArea pede altura em percentagem', () => {
    const infratores = arquivos.filter((f) =>
      /<ScrollArea[^>]*className="[^"]*\bh-full\b/.test(ler(f)),
    );
    expect(
      infratores,
      'Troque h-full por flex-1 min-h-0 e ponha o pai em flex flex-col.',
    ).toEqual([]);
  });

  it('o corpo do diálogo não usa percentagem', () => {
    const shell = readFileSync('src/components/ui/dialog-shell.tsx', 'utf8');
    const corpo = shell.slice(shell.indexOf('flex-1 min-h-0'), shell.indexOf('hideFooter'));
    expect(/\bh-full\b/.test(corpo), 'O corpo do DialogShell tem de ser medido por flex.').toBe(false);
  });
});
