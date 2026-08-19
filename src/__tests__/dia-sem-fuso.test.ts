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
import { describe, expect, it } from 'vitest';
import { fontesTsx, linhas } from './_fontes';

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

    for (const arquivo of fontesTsx()) {
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

  /** `new Date()` sem argumento é "agora": cortar aí dá o dia de hoje, e serve. */
  const eAgora = (linha: string) => /new Date\(\)\s*\.toISOString/.test(linha);

  it('nenhuma data de calendário é gravada via toISOString', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTsx()) {
      linhas(arquivo).forEach((linha, i) => {
        const t = linha.trimStart();
        if (t.startsWith('*') || t.startsWith('//')) return;
        if (escritaCrua.test(linha) && !eAgora(linha)) {
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
    expect(escritaCrua.test(mau) && !eAgora(mau)).toBe(true);
    // A forma correta.
    const boa = 'data_prazo: data.data_prazo ? formatarDiaParaDB(data.data_prazo) : null,';
    expect(escritaCrua.test(boa)).toBe(false);
    // E "hoje" continua permitido.
    const hoje = "const hoje = new Date().toISOString().split('T')[0];";
    expect(escritaCrua.test(hoje) && !eAgora(hoje)).toBe(false);
  });
});
