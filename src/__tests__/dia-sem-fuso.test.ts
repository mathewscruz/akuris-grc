/**
 * Uma coluna `date` não tem hora, e `new Date('2026-08-20')` inventa uma:
 * meia-noite UTC. Em Brasília isso é dia 19 às 21h. O resultado é a mesma
 * data aparecendo como dois dias diferentes em duas telas do mesmo produto —
 * na lista de tratamentos do risco lia-se 20/08, e no formulário de edição do
 * MESMO tratamento, 19/08.
 *
 * A correção entrou três vezes, sempre só no módulo onde o defeito tinha sido
 * visto: no núcleo de métricas, em Contratos e em Documentos. Foi esta guarda,
 * escrita ao corrigir Riscos, que mostrou que sobravam 45 leituras cruas em 24
 * arquivos de onze módulos — Projetos, Planos de Ação, Due Diligence, ROPA,
 * Incidentes, Auditorias, Denúncia, Licenças, Gap Analysis e outros.
 *
 * Todas foram convertidas. Daqui para a frente é regressão.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/i18n-format';
import { formatDateOnly } from '@/lib/date-utils';
import { setAppLocale } from '@/lib/i18n-locale';
import { fontesTodas, linhas } from './_fontes';

/**
 * Colunas `date` (sem hora) do schema, conferidas em
 * information_schema.columns. Quatro destes nomes existem também como
 * `timestamptz` noutras tabelas — não é problema: `parseDataLocal` só aplica a
 * correção quando a string é `YYYY-MM-DD`, e deixa o resto passar.
 */
const COLUNAS_DATE = [
  'aceite_valido_ate',
  'data_alvo',
  'data_alvo_certificacao',
  'data_aprovacao',
  'data_aquisicao',
  'data_assinatura',
  'data_avaliacao',
  'data_cadastro',
  'data_concessao',
  'data_conclusao',
  'data_criacao',
  'data_expiracao',
  'data_fim',
  'data_fim_anterior',
  'data_fim_nova',
  'data_fim_prevista',
  'data_fim_real',
  'data_identificacao',
  'data_implementacao',
  'data_inicio',
  'data_inicio_anterior',
  'data_inicio_nova',
  'data_limite',
  'data_manutencao',
  'data_ocorrencia',
  'data_prazo',
  'data_prevista',
  'data_prevista_conclusao',
  'data_proxima_revisao',
  'data_proxima_rotacao',
  'data_realizacao',
  'data_realizada',
  'data_renovacao',
  'data_teste',
  'data_ultima_rotacao',
  'data_vencimento',
  'nova_data_expiracao',
  'periodo_fim',
  'periodo_inicio',
  'prazo',
  'prazo_implementacao',
  'prazo_resposta',
  'proxima_avaliacao',
  'proxima_manutencao',
  'proxima_revisao',
  'release_date',
  'valido_ate',
];

/** `new Date(qualquer.coisa.coluna)` — o construtor cru sobre uma coluna date. */
const construtorCru = new RegExp(
  String.raw`new Date\(\s*[\w?.\[\]'"]*\b(${COLUNAS_DATE.join('|')})\b[\w?.\[\]'"]*\s*[),]`,
);

describe('dia sem fuso', () => {
  it('ninguém lê uma coluna date com new Date cru', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTodas()) {
      linhas(arquivo).forEach((linha, i) => {
        const t = linha.trimStart();
        if (t.startsWith('*') || t.startsWith('//')) return;
        if (construtorCru.test(linha)) infratores.push(`${arquivo}:${i + 1}`);
      });
    }

    expect(
      infratores,
      'Use parseDataLocal() de @/lib/date-utils — new Date("YYYY-MM-DD") é meia-noite UTC, ou seja, o dia anterior a oeste de Greenwich.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que ela proíbe', () => {
    // Sem isto, um erro na regex transformaria a guarda num teste que passa sempre.
    expect(construtorCru.test('const d = new Date(tratamento.prazo);')).toBe(true);
    expect(construtorCru.test('const d = new Date(risco.data_proxima_revisao)')).toBe(true);
    expect(construtorCru.test('differenceInDays(new Date(l.data_vencimento), hoje)')).toBe(true);
    // E não pode apanhar quem já faz certo, nem o `new Date()` de "agora".
    expect(construtorCru.test('const d = parseDataLocal(tratamento.prazo);')).toBe(false);
    expect(construtorCru.test('const agora = new Date();')).toBe(false);
  });

  /**
   * O mesmo erro no caminho de ESCRITA, que a guarda original não via.
   *
   * `toISOString()` converte para UTC antes de cortar. Uma data escolhida no
   * calendário às 21h em Brasília sai como o DIA SEGUINTE — o utilizador marca
   * o prazo em 4 de julho e a base guarda 5.
   *
   * Encontrado em treze sítios, incluindo o prazo de tratamento de incidente e
   * as cinco datas de um aditivo contratual. Aquele mesmo `data_prazo` é o que
   * depois diz se o tratamento está atrasado.
   */
  const escritaCrua = /\.toISOString\(\)\s*\.\s*(split\(\s*'T'\s*\)\s*\[0\]|slice\(\s*0\s*,\s*10\s*\)|substring\(\s*0\s*,\s*10\s*\))/;

  /*
    A excepção que deixou passar a classe toda.
    ------------------------------------------------------------------------
    Dizia: `new Date()` sem argumento é "agora", cortar aí dá o dia de hoje e
    serve. Não serve. `toISOString()` converte para UTC ANTES de cortar, e a
    oeste de Greenwich "agora" e "hoje" separam-se todas as noites: às 21:00 em
    Brasília o corte devolve o dia SEGUINTE.

    Custou trinta e seis sítios. O mais caro foi `todayIso()` na gaveta de KPIs,
    que a partir das 21:00 comparava vencimentos contra amanhã enquanto o cartão
    ao lado contava contra hoje — uma licença mudava de "a vencer" para
    "vencida" sem que nada tivesse acontecido. `useReviewStats` contava as
    revisões vencidas pelo mesmo dia errado.

    `formatarDiaParaDB(new Date())` dá o dia local e é o que o repositório já
    tinha para isto. Não há caso legítimo para a forma crua, nem sequer em nomes
    de ficheiro exportado: um relatório tirado às 21:30 deve dizer hoje.
  */

  it('nenhuma data de calendário é gravada via toISOString', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTodas()) {
      linhas(arquivo).forEach((linha, i) => {
        const t = linha.trimStart();
        if (t.startsWith('*') || t.startsWith('//')) return;
        if (escritaCrua.test(linha)) {
          infratores.push(`${arquivo}:${i + 1} → ${linha.trim()}`);
        }
      });
    }

    expect(
      infratores,
      'Use formatarDiaParaDB() de @/lib/date-utils — toISOString() converte para UTC e pode adiantar o dia.',
    ).toEqual([]);
  });

  it('a guarda de escrita enxerga o padrão que proíbe', () => {
    const mau = "data_prazo: data.data_prazo?.toISOString().split('T')[0],";
    expect(escritaCrua.test(mau)).toBe(true);
    // A forma correta.
    const boa = 'data_prazo: data.data_prazo ? formatarDiaParaDB(data.data_prazo) : null,';
    expect(escritaCrua.test(boa)).toBe(false);
    // E "hoje" deixou de ser excepção: é o caso que custou a classe toda.
    const hoje = "const hoje = new Date().toISOString().split('T')[0];";
    expect(escritaCrua.test(hoje)).toBe(true);
    expect(escritaCrua.test('const hoje = formatarDiaParaDB(new Date());')).toBe(false);
  });
});

/**
 * O MESMO defeito, uma camada abaixo — onde a guarda de cima não chega.
 *
 * As duas guardas acima leem código-fonte e proíbem `new Date(x.data_inicio)`
 * escrito à mão. Mas o `new Date` cru mudou de sítio: passou a viver DENTRO de
 * `formatDate`, o formatador de uso geral. Quem escreve
 * `formatDate(p.data_inicio, locale)` não infringe regex nenhuma — e recebe o
 * dia anterior à mesma.
 *
 * Medido no navegador, em America/Sao_Paulo: um projeto guardado com
 * `data_inicio = 2026-07-01` e `data_fim_prevista = 2026-12-31` aparecia no
 * cartão como «30/06/2026 → 30/12/2026». As duas datas erradas, no mesmo
 * cartão, sem ninguém ter escrito `new Date` naquele ficheiro.
 *
 * Esta guarda é de COMPORTAMENTO, não de texto: os dois formatadores de dia do
 * repositório têm de concordar sobre que dia é. Era exactamente aí que
 * divergiam — `formatDateOnly` parte a cadeia e acerta; `formatDate`
 * construía um Date e falhava. E como compara um com o outro, vale em
 * qualquer fuso onde os testes corram.
 */
describe('os dois formatadores concordam sobre o dia', () => {
  const DIAS = ['2026-07-01', '2026-12-31', '2026-01-01', '2026-03-15'];

  /*
    O fuso é FIXADO aqui, e não herdado da máquina.

    Sem isto a guarda seria um teste que passa sempre: em CI a correr em UTC,
    `new Date('2026-07-01')` dá 1 de julho e o defeito fica invisível. Só se vê
    a oeste de Greenwich — que é onde estão os utilizadores. Testam-se os dois
    lados: Brasília adianta o erro para o dia anterior, Kiritimati para o
    seguinte.
  */
  const fusoOriginal = process.env.TZ;
  afterAll(() => {
    process.env.TZ = fusoOriginal;
  });

  for (const fuso of ['America/Sao_Paulo', 'Pacific/Kiritimati', 'UTC']) {
    it(`em ${fuso}, o dia formatado é o dia que está na cadeia`, () => {
      /* O TZ vale por chamada: os dois formatadores constroem o seu
         `Intl.DateTimeFormat` na hora, por isso basta trocar a variável.
         (Os `import()` dinâmicos que aqui estavam custavam mais de 5s sob
         a suíte inteira e faziam o teste falhar por tempo, não por regra.) */
      process.env.TZ = fuso;
      /* `formatDateOnly` lê o idioma de um global do módulo
         (`setAppLocale`), e outro ficheiro de teste do mesmo worker
         deixava-o em `en` — a guarda passava sozinha e falhava na suíte
         inteira, com `07/01` contra `01/07`. Fixa-se aqui. */
      setAppLocale('pt-BR');

      for (const dia of DIAS) {
        const [ano, mes, d] = dia.split('-');
        expect(
          formatDate(dia, 'pt-BR'),
          `${dia} em ${fuso}: é o bug do dia a menos, agora dentro de formatDate.`,
        ).toBe(`${d}/${mes}/${ano}`);
        // E os dois formatadores do repositório não podem discordar entre si.
        expect(formatDate(dia, 'pt-BR')).toBe(formatDateOnly(dia));
      }
    });
  }

  it('a guarda enxerga o defeito que proíbe', () => {
    // A forma crua, que era a de `formatDate` antes desta correção.
    process.env.TZ = 'America/Sao_Paulo';
    expect(new Date('2026-07-01').getDate()).toBe(30); // 30 de junho
    // A forma corrigida: meio-dia local, longe de qualquer fronteira.
    expect(new Date('2026-07-01T12:00:00').getDate()).toBe(1);
  });
});
