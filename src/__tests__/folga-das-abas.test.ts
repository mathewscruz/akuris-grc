/**
 * A folga por baixo da barra de abas vive na barra, não em quem vem depois.
 *
 * O defeito: nos Planos de Ação a faixa de indicadores encostava nas abas.
 * A margem estava no `TabsContent`, portanto só quem fosse um painel ganhava
 * espaço — e cinco páginas põem uma `StatStrip` ENTRE a barra e o painel, que
 * não é painel nenhum e não herdava margem. Com a margem na `TabsList`, tudo
 * o que venha a seguir respira, seja painel, cartão ou barra de filtros.
 *
 * As duas regras que restam impedem que a folga volte a divergir: eram 0, 15,
 * 19 e 23px no mesmo produto.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTsx, linhas } from './_fontes';
import { resolve } from 'node:path';

const TABS = readFileSync(resolve(__dirname, '../components/ui/tabs.tsx'), 'utf8');

const arquivos = fontesTsx();

describe('folga por baixo das abas', () => {
  it('o bloco de abas tem ritmo vertical próprio', () => {
    const raiz = TABS.slice(0, TABS.indexOf('const TabsList'));
    expect(
      /space-y-4/.test(raiz),
      'A folga tem de estar no <Tabs>, e não só na barra: cinco páginas metem uma faixa de indicadores ENTRE a barra e o painel, e com a margem só na barra a faixa respirava em cima e encostava no painel em baixo.',
    ).toBe(true);
  });

  it('a margem está na barra de abas', () => {
    const lista = TABS.slice(TABS.indexOf('const TabsList'), TABS.indexOf('const TabsTrigger'));
    expect(/\bmb-4\b/.test(lista), 'A TabsList tem de trazer a folga — é o que garante que TUDO o que vier a seguir respira.').toBe(true);
  });

  it('o painel não tem margem própria', () => {
    const conteudo = TABS.slice(TABS.indexOf('const TabsContent'));
    expect(/"mt-\d+ /.test(conteudo), 'Somada à da barra, dá o dobro — e cada página corrige à sua maneira.').toBe(false);
  });

  it('nenhum painel escreve a margem à mão', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      const ls = linhas(f);
      ls.forEach((l, i) => {
        if (/<TabsContent\b[^>]*\bmt-\d+/.test(l)) infratores.push(`${f}:${i + 1}`);
      });
    }
    expect(infratores, 'Tire o mt-* — a folga vem da TabsList.').toEqual([]);
  });

  it('nenhum contentor de abas define o seu próprio espaçamento vertical', () => {
    const infratores: string[] = [];
    for (const f of arquivos) {
      const ls = linhas(f);
      ls.forEach((l, i) => {
        if (/<Tabs\b[^>]*className="[^"]*\bspace-y-\d+/.test(l)) infratores.push(`${f}:${i + 1}`);
      });
    }
    expect(
      infratores,
      'space-y no <Tabs> passa por cima da folga da barra — dava 23px onde as outras páginas dão 15px.',
    ).toEqual([]);
  });
});
