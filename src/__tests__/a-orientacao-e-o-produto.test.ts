/**
 * A orientação do requisito é o que o módulo vende — e tem de existir em
 * português.
 *
 * ## A promessa
 *
 * O Gap Analysis existe para que alguém que nunca viu a norma se adeque a ela
 * sem contratar consultoria. Tudo o resto — score, fases, SoA, exportação — é
 * andaime. A peça que substitui o consultor é uma só: abrir um requisito e ler
 * **o que é** e **o que fazer**, em linguagem de quem não é da área.
 *
 * No esquema isso são três colunas por requisito:
 *   · `orientacao_implementacao` — o que fazer
 *   · `exemplos_evidencias`      — que prova o auditor aceita
 *   · `perguntas_diagnostico`    — como saber se já cumpre
 * e as suas gémeas `_en`.
 *
 * ## O que estava
 *
 * O catálogo traz 2.518 requisitos semeados por migration e **36 orientações**
 * (`20260820100000_orientacao_dos_requisitos_versionada.sql`, que o diz por
 * escrito: das 1.573, 36 existiam, e por acaso — eram as que alguém abriu
 * primeiro). O resto nasce sob demanda: quem abre um requisito sem texto
 * dispara `populate-requirement-guidance`, espera pelo modelo, e a empresa
 * paga um crédito. O resultado fica global, portanto o segundo cliente não
 * paga o que o primeiro pagou — bom desenho.
 *
 * O problema era o aquecimento central. `TraducaoFrameworksTab` é o único
 * sítio do produto que produz orientação em massa, e passava `locale: 'en'`
 * cravado. Ou seja: dava para deixar o inglês a 100% e o **português — a
 * língua do mercado — ficava nos 2,3%**, requisito a requisito, à custa e à
 * espera de cada cliente.
 *
 * Esta guarda não obriga o catálogo a estar cheio: obriga a ferramenta que o
 * enche a não esquecer metade dos utilizadores.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PAINEL = 'src/components/configuracoes/TraducaoFrameworksTab.tsx';
const FUNCAO = 'supabase/functions/populate-requirement-guidance/index.ts';

describe('o aquecimento cobre as duas línguas', () => {
  const painel = readFileSync(PAINEL, 'utf8');

  it('não crava um idioma na chamada da orientação', () => {
    /*
       Procurar a cadeia `locale: 'en'` no ficheiro apanhava este comentário e a
       tradução do CONTEÚDO do framework, que é para inglês de propósito. O que
       interessa é o corpo da chamada a `populate-requirement-guidance`.
    */
    const chamada = painel.slice(
      painel.indexOf("'populate-requirement-guidance'"),
      painel.indexOf('isAiCall: true', painel.indexOf("'populate-requirement-guidance'")),
    );
    expect(chamada.length).toBeGreaterThan(0);
    expect(chamada, 'idioma cravado deixa o português por escrever').not.toMatch(/locale:\s*['"]en['"]/);
    expect(chamada, 'o idioma tem de vir da volta do ciclo').toContain('locale,');
    expect(painel).toMatch(/for \(const locale of \[['"]pt['"], ['"]en['"]\]/);
  });

  it('conta o que existe em cada língua, não só numa', () => {
    expect(painel).toContain("is('orientacao_implementacao', null)");
    expect(painel).toContain("is('orientacao_implementacao_en', null)");
    expect(painel).toContain('guidancePt');
  });

  it('só se dá por pronto quando as duas estão escritas', () => {
    /* Com o mínimo das duas, o painel não pode mostrar 100% tendo o português
       a zero — que era o estado exacto em que o produto estava. */
    expect(painel).toMatch(/Math\.min\(fw\.guidancePt, fw\.guidanceEn\)/);
  });

  it('a função de borda aceita as duas', () => {
    const fn = readFileSync(FUNCAO, 'utf8');
    expect(fn).toMatch(/body\.locale === ['"]en['"] \? ['"]en['"] : ['"]pt['"]/);
  });
});

describe('o caminho sob demanda continua a existir', () => {
  /*
     O aquecimento central é o atalho; o caminho normal é abrir o requisito.
     As duas superfícies de trabalho — gaveta e diálogo — têm de pedir pela
     mesma conta, senão volta a haver um caminho principal sem a peça
     principal (foi o que aconteceu: a gaveta mostrava a norma e nunca pedia
     orientação, e é para a gaveta que a fila de prioridades manda toda a
     gente).
  */
  const SUPERFICIES = [
    'src/components/gap-analysis/v2/RequirementDrawer.tsx',
    'src/components/gap-analysis/dialogs/RequirementDetailDialog.tsx',
  ];

  it.each(SUPERFICIES)('%s pede a orientação pelo hook único', (f) => {
    const s = readFileSync(f, 'utf8');
    expect(s, 'não usa useOrientacaoRequisito').toContain('useOrientacaoRequisito');
    expect(s, 'chama a função de borda por fora do hook').not.toContain(
      "invoke('populate-requirement-guidance'",
    );
  });

  it('a falta de orientação é dita, não disfarçada', () => {
    /* Um requisito sem orientação não pode limitar-se a mostrar o texto da
       norma como se fosse a resposta: quem não conhece a norma não distingue
       «isto é o que a lei diz» de «isto é o que tens de fazer». */
    const s = readFileSync(SUPERFICIES[0], 'utf8');
    /* Três razões diferentes para não haver texto, três frases diferentes:
       «acabaram os créditos» não é «falhou» nem é «ainda não foi escrita», e
       quem lê precisa de saber qual delas é para saber o que fazer. */
    for (const chave of ['guidanceSemCreditos', 'guidanceFalhou', 'guidanceIndisponivel']) {
      expect(s, `estado sem mensagem própria: ${chave}`).toContain(chave);
    }
    expect(s).toContain('guidanceTentarDeNovo');
  });

  it('gerar não é gratuito, e o produto sabe disso', () => {
    /* Um crédito por requisito e por empresa. Se a chamada deixasse de passar
       pelo consumo, o custo desaparecia da conta do cliente sem desaparecer
       da nossa. */
    const fn = readFileSync(FUNCAO, 'utf8');
    expect(fn).toContain('consume_ai_credit');
    expect(fn).toContain('temCreditoIA');
    // E só debita quando entregou: falha do modelo não custa ao cliente.
    expect(fn).toMatch(/Só debita o crédito quando a IA entregou/);
  });
});
