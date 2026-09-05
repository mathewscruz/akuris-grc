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

/**
 * Nenhuma aba fica escondida onde há rato.
 *
 * A barra rolava na horizontal e escondia a barra de rolagem, de propósito.
 * O preço era a última aba aparecer cortada a meio da palavra — «Planos de»
 * — e no rato não há gesto nenhum para chegar ao resto. Medido no detalhe
 * de um controlo, numa janela de 1275 px: seis abas somam 675 px, cinco
 * intervalos 112, e a barra tem 744. Faltavam 43.
 *
 * Encolher o intervalo comprava 37 px: resolvia aquele caso e voltava a
 * partir com uma aba a mais. Com `flex-wrap` nada fica escondido, a qualquer
 * largura e com qualquer número de abas; onde já cabia não muda nada.
 *
 * No telemóvel mantém-se a rolagem (`max-sm:flex-nowrap`): seis abas
 * empilhadas comiam três linhas do ecrã, e ali arrastar de lado é gesto
 * conhecido.
 */
describe('a barra de abas nunca esconde uma aba', () => {
  const lista = TABS.slice(TABS.indexOf('const TabsList'), TABS.indexOf('const TabsTrigger'));

  it('mantém uma linha e permite alcançar as abas com o rato', () => {
    expect(lista).toContain('flex-nowrap');
    expect(lista).toContain('scrollTabs(-1)');
    expect(lista).toContain('scrollTabs(1)');
    expect(lista).toContain('aria-label={t("experience.tabsNext")}');
    expect(lista).toContain('aria-label={t("experience.tabsPrevious")}');
  });

  it('no telemóvel continua a rolar', () => {
    expect(
      /flex-nowrap/.test(lista),
      'Empilhar seis abas num telemóvel come três linhas de ecrã; ali o gesto de arrastar existe.',
    ).toBe(true);
  });

  it('não cria scroll vertical nem desenha o indicador em menus laterais', () => {
    expect(lista).toContain('overflow-y-hidden');
    expect(lista).toContain('showIndicator = true');
    expect(lista).toContain('{showIndicator && (');

    const configuracoes = readFileSync(resolve(__dirname, '../pages/Configuracoes.tsx'), 'utf8');
    expect(configuracoes.match(/<TabsList showIndicator=\{false\}/g)).toHaveLength(2);
  });

  it('a barra vertical do assistente não quebra', () => {
    const falhas: string[] = [];
    for (const ficheiro of arquivos) {
      const fonte = readFileSync(ficheiro, 'utf8');
      for (const linha of fonte.split('\n')) {
        if (!/<TabsList/.test(linha)) continue;
        if (!/flex-col/.test(linha)) continue;
        if (!/flex-nowrap/.test(linha)) falhas.push(ficheiro.replace(/\\/g, '/'));
      }
    }
    expect(
      falhas,
      'Numa barra vertical, quebrar põe um passo numa segunda COLUNA em vez de numa segunda linha.',
    ).toEqual([]);
  });
});
