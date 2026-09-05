/**
 * O «Ver todos» leva o recorte que a gaveta mostrou.
 *
 * Os cartões de KPI abrem uma gaveta com o recorte pedido — «Ativos críticos»,
 * «Contas expiradas», «Licenças a vencer» — e mostram cinco linhas, porque é o
 * que lá cabe. Por baixo há um «Ver todos», que era a única saída para as
 * restantes. Ia para a rota nua do módulo.
 *
 * Medido: «10 Alta ou crítica» → gaveta com 5 activos críticos → «Ver todos» →
 * `/ativos` com as doze linhas todas e o filtro de criticidade em «Todas». A
 * lista aparecia, parecia a resposta, e não era. São 66 KPIs assim.
 *
 * A correcção tem duas metades, e as duas têm de continuar de pé:
 *
 *  1. O `fetcher` lê o recorte INTEIRO (até ao tecto do endereço) e a gaveta
 *     corta na apresentação. Ler duas vezes — uma para a gaveta, outra para o
 *     botão, com o predicado escrito outra vez — era o caminho para a gaveta
 *     dizer uma coisa e o botão levar a outra.
 *  2. A `DataTable` aplica o recorte só quando ele conhece alguma linha
 *     daquela tabela. Alguns KPIs contam uma coisa e navegam para a lista de
 *     outra; sem esta válvula davam ecrã vazio com um chip a explicá-lo, que é
 *     pior do que a lista larga que havia antes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const GAVETA = 'src/components/dashboard/KpiDrillDownDrawer.tsx';
const TABELA = 'src/components/ui/data-table.tsx';

const semComentarios = (fonte: string) =>
  fonte
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');

describe('ver todos leva o recorte', () => {
  it('nenhum fetcher corta o recorte por conta própria', () => {
    /*
       Um `.limit(5)` ou um `.slice(0, 5)` à mão volta a pôr a gaveta e o botão
       a discordar: a gaveta mostraria cinco e o botão levaria esses cinco como
       se fossem o recorte todo.
    */
    const fonte = semComentarios(readFileSync(GAVETA, 'utf8'));
    const cortes = [
      ...fonte.matchAll(/\.limit\((\d+)\)/g),
      ...fonte.matchAll(/\.slice\(0,\s*(\d+)\)/g),
    ].map((m) => m[0]);
    expect(
      cortes,
      'Use `LIMITE_DO_RECORTE` na leitura e `LINHAS_NA_GAVETA` na apresentação.',
    ).toEqual([]);
  });

  it('a gaveta corta na apresentação, não na leitura', () => {
    const fonte = readFileSync(GAVETA, 'utf8');
    expect(fonte.includes('.limit(LIMITE_DO_RECORTE)')).toBe(true);
    expect(fonte.includes('.slice(page * LINHAS_NA_GAVETA, (page + 1) * LINHAS_NA_GAVETA)')).toBe(true);
    expect(fonte).toContain('setPage(page + 1)');
    expect(fonte).toContain('setPage(page - 1)');
  });

  it('o tecto de leitura cabe no endereço', () => {
    // Ler menos do que o «Ver todos» pode levar seria truncar em silêncio.
    const fonte = readFileSync(GAVETA, 'utf8');
    expect(fonte).toContain('const LIMITE_DO_RECORTE = MAX_IDS_NO_ENDERECO + 1;');
  });

  it('a tabela ignora um recorte que não é dela', () => {
    const fonte = readFileSync(TABELA, 'utf8');
    expect(
      /recortados\.length > 0 \? recortados : data/.test(fonte),
      'Sem a válvula, um KPI que conta uma tabela e navega para outra dá ecrã vazio.',
    ).toBe(true);
  });

  it('a tabela só trata do recorte que veio do painel', () => {
    /*
       `ids` sozinho é da matriz de riscos, que tem chip próprio e limpa também
       a célula seleccionada. O `de` é o que distingue os dois; sem ele a
       tabela mostrava dois chips para o mesmo filtro.
    */
    const hook = readFileSync('src/hooks/useRecorteDaUrl.ts', 'utf8');
    expect(/if \(!ids \|\| !de\) return null/.test(hook)).toBe(true);
  });
});

describe('todo o recorte se sabe nomear', () => {
  it('cada KPI tem título nas duas línguas', () => {
    /*
       O chip da tabela escreve `dashWidgets.drill.<chave>.title`. Sem tradução
       mostraria a chave crua — «ativos_criticos» — a um utilizador.
    */
    const gaveta = readFileSync(GAVETA, 'utf8');
    const bloco = gaveta.slice(gaveta.indexOf('export type DrillDownKey'));
    const chaves = [...bloco.slice(0, bloco.indexOf(';')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(chaves.length).toBeGreaterThan(50);

    const dic = readFileSync('src/i18n/modules/dashboard-widgets.ts', 'utf8');
    // O ficheiro tem os dois dicionários; cada chave tem de aparecer duas vezes.
    const semTitulo = chaves.filter((k) => {
      const ocorrencias = [...dic.matchAll(new RegExp(`\\b${k}:\\s*\\{[^}]*title:`, 'g'))];
      return ocorrencias.length < 2;
    });
    expect(semTitulo, 'Falta `title` em pt ou en (src/i18n/modules/dashboard-widgets.ts).').toEqual([]);
  });
});
