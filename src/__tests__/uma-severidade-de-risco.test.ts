/**
 * "Quão grave é este risco" tem uma resposta só.
 *
 * O ecrã de Riscos usa `residual || inicial` — na tabela, no filtro de nível,
 * no pontinho da linha e nas contagens do topo. O resto do produto usava o
 * nível inerente: as estatísticas, o radar do painel e os DOIS geradores de
 * PDF. Com os seis riscos da base local, todos com residual diferente do
 * inerente, a divergência era total:
 *
 *              crítico  alto  médio  baixo
 *   ecrã          0       1     4      1
 *   PDF           1       4     1      0
 *
 * Ou seja: exportar o relatório do ecrã que se está a ver devolvia os números
 * contrários. Num relatório que vai para o conselho ou para o auditor, isso não
 * é inconsistência de interface — é o documento a dizer outra coisa.
 *
 * A regra: quem CONTA ou EXIBE severidade usa `severidadeRisco` (efetiva).
 * `severidadeRiscoInerente` existe para quem mostra o antes e o depois lado a
 * lado — a matriz e o detalhe — e nunca para contagem.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler } from './_fontes';
import {
  contarRiscosPorSeveridade,
  severidadeRisco,
  severidadeRiscoInerente,
} from '@/lib/metrics/riscos';

/**
 * A regra é por linha: mencionar o inerente sem mencionar o residual.
 *
 * Tentei primeiro um `lookahead` a exigir `||` a seguir, e a própria
 * auto-verificação apanhou o erro — `x.nivel_risco_inicial || '-'` tem um
 * `||`, mas o que vem a seguir é o traço, não o residual.
 */
const CITA_INERENTE = /nivel_risco_inicial/;
/**
 * Prova de que o residual entra na conta.
 *
 * Duas formas valem: nomear o campo, ou chamar o ajudante que o resolve. A
 * segunda faltava, e a guarda reprovava exactamente o código que a sua própria
 * mensagem manda escrever — a ordenação da tabela de riscos, que compara
 * `sortField` com a chave da coluna (`nivel_risco_inicial`) e depois ordena por
 * `severidadeRisco(risco)`.
 *
 * `severidadeRiscoInerente` não conta, e de propósito: essa lê o inerente, que
 * é o que esta regra existe para vigiar.
 */
const CITA_RESIDUAL = /nivel_risco_residual|severidadeRisco(?:Efetiva)?\(/;

/** Isentos, cada um com o seu motivo. */
const ISENTOS = [
  // Onde a regra vive.
  'src/lib/metrics/riscos.ts',
  // Gerado a partir do banco.
  'src/integrations/supabase/types.ts',
  // `case 'nivel_risco_inicial':` comuta sobre NOME de campo, para escolher o
  // rótulo. Não decide severidade nenhuma.
  'src/lib/enum-labels.ts',
  // Plota probabilidade × impacto INERENTES — é o que uma matriz de risco
  // mostra por definição. O residual, quando existir, é outra vista.
  'src/components/riscos/MatrizVisualizacao.tsx',
];

/** Mostram o antes e o depois lado a lado — é o ponto deles. */
const ISENTOS_POR_PREFIXO = [
  'src/components/riscos/matrix/',
  'src/components/riscos/RiscoFormWizard.tsx',
  'src/components/riscos/RiscoDetalheDialog.tsx',
];

describe('uma severidade de risco', () => {
  it('ninguém conta severidade só pelo nível inerente', () => {
    const infratores: string[] = [];

    for (const arquivo of fontes()) {
      if (ISENTOS.includes(arquivo)) continue;
      if (ISENTOS_POR_PREFIXO.some((p) => arquivo.startsWith(p))) continue;

      const linhas = ler(arquivo).split('\n');
      /*
         Dentro de um bloco `/* ... *\/` é prosa, não código.

         Só se saltava a PRIMEIRA linha de um bloco, e as seguintes voltavam a
         ser lidas como se fossem código. Um comentário a explicar o defeito —
         que é o que se pede a quem o corrige — passava a ser denunciado como o
         defeito. Aconteceu com a própria correcção da ordenação por
         severidade, e resolvê-lo a reescrever a frase seria calar a guarda em
         vez de a arranjar.
      */
      let dentroDeBloco = false;
      linhas.forEach((linha, i) => {
        const t = linha.trimStart();
        const abre = linha.lastIndexOf('/*');
        const fecha = linha.lastIndexOf('*/');
        const eraBloco = dentroDeBloco;
        if (!dentroDeBloco && abre > fecha) dentroDeBloco = true;
        else if (dentroDeBloco && fecha > abre) dentroDeBloco = false;
        if (eraBloco || dentroDeBloco) return;
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
        // Declaração de tipo e chave de coluna da tabela são nome de campo, não
        // decisão de severidade — quem decide é o `render` ao lado.
        if (/^\s*nivel_risco_inicial\??\s*:/.test(linha)) return;
        if (/\bkey:\s*'nivel_risco_inicial'/.test(linha)) return;
        /*
          Série temporal é outra pergunta.

          Esta regra existe para a severidade APRESENTADA: o que o utilizador vê
          hoje é `residual || inicial`. Numa curva histórica, porém, a pergunta é
          "qual era o nível NAQUELE mês", e a resposta é a avaliação vigente na
          data; o `nivel_risco_inicial` entra como LINHA DE BASE, para o período
          anterior à primeira reavaliação. Usar `residual` aqui seria voltar a
          pintar o passado com o presente — exactamente o defeito que fazia a
          curva do painel nunca poder descer (ver tendencia-le-o-historico).
        */
        if (/vigente\?\.nivel_risco\s*\?\?/.test(linha)) return;
        /*
          O bloco rotulado «Inerente» mostra o inerente — é a razão de ele
          existir, e está dito no próprio rótulo. Foi por passar aqui com
          `residual || inicial` que ele andou a anunciar Baixo onde a base
          guardava Médio. A guarda seguinte é a metade que falta: nesta
          linha o residual é que não entra.
        */
        if (/detail\.inerente/.test(linha)) return;
        if (!CITA_INERENTE.test(linha)) return;
        // Janela de três linhas: numa lista de colunas partida por linhas o
        // residual aparece na linha seguinte, e a leitura por linha não o via.
        const janela = linhas.slice(Math.max(0, i - 2), i + 3).join('\n');
        if (!CITA_RESIDUAL.test(janela)) {
          infratores.push(`${arquivo}:${i + 1} → ${linha.trim()}`);
        }
      });
    }

    expect(
      infratores,
      'Use severidadeRisco() (residual || inicial). O inerente sozinho só na matriz e no detalhe.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe', () => {
    // O caso que enganou a primeira versão da guarda: há um `||`, mas o que
    // vem a seguir é o traço e não o residual.
    const mau = "value={x.nivel_risco_inicial || '-'}";
    expect(CITA_INERENTE.test(mau) && !CITA_RESIDUAL.test(mau)).toBe(true);
    const correta = 'x.nivel_risco_residual || x.nivel_risco_inicial';
    expect(CITA_INERENTE.test(correta) && !CITA_RESIDUAL.test(correta)).toBe(false);
  });

  it('a severidade canónica é a residual quando existe', () => {
    const tratado = { nivel_risco_inicial: 'critico', nivel_risco_residual: 'alto' };
    expect(severidadeRisco(tratado)).toBe('alto');
    expect(severidadeRiscoInerente(tratado)).toBe('critico');

    const semTratamento = { nivel_risco_inicial: 'medio', nivel_risco_residual: null };
    expect(severidadeRisco(semTratamento)).toBe('medio');
  });

  it('a contagem segue a mesma regra — é o que separava o ecrã do PDF', () => {
    // Os seis riscos da base local, todos com residual diferente do inerente.
    const riscos = [
      { nivel_risco_inicial: 'critico', nivel_risco_residual: 'alto' },
      { nivel_risco_inicial: 'alto', nivel_risco_residual: 'medio' },
      { nivel_risco_inicial: 'alto', nivel_risco_residual: 'medio' },
      { nivel_risco_inicial: 'alto', nivel_risco_residual: 'medio' },
      { nivel_risco_inicial: 'alto', nivel_risco_residual: 'medio' },
      { nivel_risco_inicial: 'medio', nivel_risco_residual: 'baixo' },
    ];
    expect(contarRiscosPorSeveridade(riscos)).toMatchObject({
      total: 6,
      criticos: 0,
      altos: 1,
      medios: 4,
      baixos: 1,
    });
  });
});

/**
 * O bloco que se chama «Inerente» mostra o inerente.
 *
 * `residual || inicial` é o nível efectivo, e está certo onde o rótulo não
 * promete outra coisa. No painel do risco prometia: a etiqueta dizia
 * «Inerente», o número ao lado era o score inerente e o P×I por baixo era o
 * inerente — só a severidade vinha do residual. Medido no R-0011: «Inerente
 * B Baixo 5 P1×I5», quando 5 é Médio na matriz. Dezasseis dos vinte e cinco
 * riscos daquela empresa liam-se assim, e a seta ao lado anunciava «−2» de
 * Baixo para Baixo.
 */
describe('o bloco do inerente', () => {
  it('não vai buscar o nível ao residual', () => {
    const falhas: string[] = [];

    for (const ficheiro of fontes()) {
      if (!ficheiro.endsWith('.tsx')) continue;
      const fonte = ler(ficheiro);
      if (!fonte.includes('detail.inerente')) continue;

      for (const linha of fonte.split('\n')) {
        if (!linha.includes('detail.inerente')) continue;
        if (/nivel=\{[^}]*nivel_risco_residual/.test(linha)) {
          falhas.push(ficheiro.replace(/\\/g, '/'));
        }
      }
    }

    expect(
      falhas,
      'Um bloco rotulado «Inerente» com o nível residual diz o contrário do número que tem ao lado.',
    ).toEqual([]);
  });
});
