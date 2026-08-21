/**
 * O cálculo de risco tem de continuar a ser um só.
 *
 * O módulo chegou a ter OITO funções a responder "qual é a severidade disto?"
 * — `severityFromNivel`, `severityFromScore`, `severityFromScoreConfig`,
 * `scoreFromPI`, `nivelRiscoFromConfig`, uma cópia local no formulário,
 * `bucketOf` no painel e `resolveSeverityTone` nas cores — cada uma com uma
 * regra ligeiramente diferente. Qual delas respondia dependia do ecrã, e por
 * isso o mesmo risco aparecia "Crítico" no cartão e "Alto" no mapa de calor,
 * lado a lado.
 *
 * Estes testes guardam as três invariantes que impedem a recaída:
 *   1. o front-end não volta a calcular o que o banco calcula;
 *   2. as faixas geradas cobrem a escala e nenhuma fica inatingível;
 *   3. o vocabulário de severidade é um só, em toda a interface.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  faixasPara,
  scoresPossiveis,
  validarFaixas,
  apetiteScoreDaConfig,
  DEFAULT_NIVEIS_RISCO,
} from '../matriz-config';
import { severidadeRisco, severidadeDeFaixas, isAcimaDoApetite } from '@/lib/metrics/riscos';

/**
 * Percorre a árvore a partir do disco.
 *
 * Deliberadamente NÃO usa `git ls-files`: ficheiros novos ainda não indexados
 * ficavam invisíveis à guarda, que passava a verde precisamente quando havia
 * mais código para verificar.
 */
function ficheirosDe(dir: string, ext = ['.ts', '.tsx']): string[] {
  const raiz = resolve(process.cwd(), dir);
  const saida: string[] = [];
  const andar = (atual: string) => {
    for (const nome of readdirSync(atual)) {
      const caminho = join(atual, nome);
      if (statSync(caminho).isDirectory()) {
        if (nome === '__tests__' || nome === 'node_modules') continue;
        andar(caminho);
      } else if (ext.some((e) => nome.endsWith(e))) {
        saida.push(caminho);
      }
    }
  };
  andar(raiz);
  return saida;
}

describe('o cálculo de risco vive num sítio só', () => {
  it('nenhum ecrã grava nível, score ou severidade de risco', () => {
    // Estas colunas são escritas por `trg_risco_calcular` e `trg_ropa_risco_calcular`.
    // Enviá-las do cliente é a porta por onde entravam os rótulos que depois
    // divergiam da matriz — 7 dos 84 riscos da base estavam nesse estado.
    const proibidos = [
      /nivel_risco_inicial\s*:/,
      /nivel_risco_residual\s*:/,
      /\bscore_inicial\s*:/,
      /\bscore_residual\s*:/,
      /severidade_inicial\s*:/,
      /severidade_residual\s*:/,
      /risco_nivel\s*:/,
    ];

    /**
     * Só o que está DENTRO de `.insert(...)` / `.update(...)` conta. Uma
     * interface que declara `nivel_risco_inicial: string` está a ler a
     * coluna, não a escrevê-la.
     */
    const corposDeEscrita = (conteudo: string): string[] => {
      const blocos: string[] = [];
      const re = /\.(insert|update|upsert)\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(conteudo))) {
        let profundidade = 1;
        let i = m.index + m[0].length;
        while (i < conteudo.length && profundidade > 0) {
          if (conteudo[i] === '(') profundidade++;
          else if (conteudo[i] === ')') profundidade--;
          i++;
        }
        blocos.push(conteudo.slice(m.index, i));
      }
      return blocos;
    };

    const infractores: string[] = [];
    for (const caminho of [...ficheirosDe('src/components'), ...ficheirosDe('src/pages'), ...ficheirosDe('src/hooks')]) {
      const conteudo = readFileSync(caminho, 'utf8');
      for (const bloco of corposDeEscrita(conteudo)) {
        for (const padrao of proibidos) {
          for (const linha of bloco.split(String.fromCharCode(10))) {
            if (/^\s*(\/\/|\*)/.test(linha)) continue;
            if (padrao.test(linha)) infractores.push(`${caminho.split('src')[1]}: ${linha.trim()}`);
          }
        }
      }
    }
    expect(infractores, 'colunas calculadas enviadas pelo cliente').toEqual([]);
  });

  it('não há uma segunda implementação de severidade por limiar fixo', () => {
    // `severityFromScore` decidia por 16/10/5 — números que só fazem sentido
    // numa 5×5 multiplicativa e que mentiam em qualquer outra escala.
    const suspeitos: string[] = [];
    for (const caminho of ficheirosDe('src')) {
      const conteudo = readFileSync(caminho, 'utf8');
      if (/score\s*>=\s*16|score\s*>=\s*10\b/.test(conteudo)) {
        suspeitos.push(caminho.split('src')[1]);
      }
    }
    expect(suspeitos, 'limiares de severidade fixos no código').toEqual([]);
  });
});

describe('faixas geradas a partir da escala', () => {
  const casos: Array<[number, number, 'multiplicacao' | 'soma']> = [
    [3, 3, 'multiplicacao'],
    [4, 4, 'multiplicacao'],
    [5, 5, 'multiplicacao'],
    [6, 6, 'multiplicacao'],
    [5, 5, 'soma'],
    [3, 3, 'soma'],
    [7, 5, 'soma'],
    [2, 2, 'multiplicacao'],
  ];

  it.each(casos)('%ix%i por %s: cobrem tudo e nenhuma fica vazia', (p, i, metodo) => {
    const faixas = faixasPara(p, i, metodo);
    const possiveis = scoresPossiveis(p, i, metodo);

    const semFaixa = possiveis.filter((s) => !faixas.some((f) => s >= f.min && s <= f.max));
    expect(semFaixa, 'resultados fora de todas as faixas').toEqual([]);

    const vazias = faixas.filter((f) => !possiveis.some((s) => s >= f.min && s <= f.max));
    expect(vazias.map((f) => f.nivel), 'faixas que nunca acontecem').toEqual([]);

    expect(validarFaixas(faixas, p, i, metodo)).toBeNull();
  });

  it('a 5×5 multiplicativa mantém as faixas consagradas', () => {
    const faixas = faixasPara(5, 5, 'multiplicacao');
    expect(faixas.map((f) => [f.min, f.max])).toEqual(
      DEFAULT_NIVEIS_RISCO.map((f) => [f.min, f.max]),
    );
  });

  it('trocar para Soma numa 5×5 não deixa "Crítico" inatingível', () => {
    // A armadilha original: P+I chega no máximo a 10 e as faixas ficavam
    // 1–4 / 5–9 / 10–16 / 17–25. "Crítico" era impossível e "acima do
    // apetite" ficava preso em zero, sem aviso nenhum no ecrã.
    const antigas = DEFAULT_NIVEIS_RISCO;
    expect(validarFaixas(antigas, 5, 5, 'soma')?.tipo).toBe('inalcancavel');

    const novas = faixasPara(5, 5, 'soma', antigas);
    expect(validarFaixas(novas, 5, 5, 'soma')).toBeNull();
    expect(Math.max(...novas.map((f) => f.max))).toBe(10);
  });

  it('recusa faixas com buraco e faixas sobrepostas', () => {
    expect(
      validarFaixas(
        [
          { min: 1, max: 4, nivel: 'Baixo' },
          { min: 10, max: 25, nivel: 'Alto' },
        ],
        5, 5, 'multiplicacao',
      )?.tipo,
    ).toBe('nao_cobrem');

    expect(
      validarFaixas(
        [
          { min: 1, max: 12, nivel: 'Baixo' },
          { min: 8, max: 25, nivel: 'Alto' },
        ],
        5, 5, 'multiplicacao',
      )?.tipo,
    ).toBe('sobreposicao');
  });
});

describe('severidade e apetite não dependem do rótulo', () => {
  it('uma faixa renomeada conta na posição certa', () => {
    // A Fast2Mine chama às faixas Baixo/Moderado/Elevado/Extremo. Com o mapa
    // de rótulos antigo, "Intolerável" ou "Tolerável" não batiam com palavra
    // nenhuma e a carteira inteira colapsava para "baixo".
    const faixas = [
      { min: 1, max: 6, nivel: 'Tolerável' },
      { min: 7, max: 12, nivel: 'Moderado' },
      { min: 13, max: 19, nivel: 'Sério' },
      { min: 20, max: 25, nivel: 'Intolerável' },
    ];
    expect(severidadeDeFaixas('Intolerável', faixas)).toBe('critico');
    expect(severidadeDeFaixas('Sério', faixas)).toBe('alto');
    expect(severidadeDeFaixas('Moderado', faixas)).toBe('medio');
    expect(severidadeDeFaixas('Tolerável', faixas)).toBe('baixo');
  });

  it('a coluna canónica manda sobre o rótulo gravado', () => {
    // O risco R-0006 da base estava gravado como "critico" com score 15, que
    // cai em "Alto (10–16)". O cartão dizia 2 críticos e o mapa de calor ao
    // lado mostrava um só.
    expect(
      severidadeRisco({ severidade_efetiva: 'alto', nivel_risco_inicial: 'critico' }),
    ).toBe('alto');
  });

  it('o apetite vem da coluna, não de uma flag escondida no JSON', () => {
    expect(apetiteScoreDaConfig({ apetite_score: 16, niveis_risco: [] })).toBe(16);

    // Sem marcação e com faixas renomeadas, o caminho antigo devolvia null e
    // "Acima do apetite" deixava de valer em silêncio.
    expect(
      apetiteScoreDaConfig({
        niveis_risco: [
          { min: 1, max: 4, nivel: 'Baixo' },
          { min: 5, max: 9, nivel: 'Moderado' },
          { min: 10, max: 16, nivel: 'Elevado' },
          { min: 17, max: 25, nivel: 'Extremo' },
        ],
      }),
    ).toBe(9);
  });

  it('acima do apetite compara números, não severidades', () => {
    expect(isAcimaDoApetite({ score_efetivo: 20 }, 16)).toBe(true);
    expect(isAcimaDoApetite({ score_efetivo: 16 }, 16)).toBe(false);
    // Sem apetite configurado não se inventa um veredicto.
    expect(isAcimaDoApetite({ score_efetivo: 25 }, null)).toBe(false);
    // Risco por avaliar não está acima de nada.
    expect(isAcimaDoApetite({}, 16)).toBe(false);
  });
});

describe('vocabulário de severidade único na interface', () => {
  it('nenhum formulário grava criticidade ou gravidade no feminino', () => {
    /*
      `prioridade` (auditorias, planos, tarefas) e a `gravidade` dos eventos de
      integração continuam com o seu vocabulário: são conceitos de execução e
      de notificação, não a escala de risco. O que não pode voltar é COMPARAR
      a coluna de severidade com o feminino — `criticidade === 'alta'` passou
      a ser sempre falso e apagava contagens sem erro nenhum, nem no ecrã nem
      na consola.
    */
    const infractores: string[] = [];
    const comparacao = /\.(criticidade|gravidade)\s*={2,3}\s*["'](critica|alta|media|baixa)["']/;

    for (const caminho of [...ficheirosDe('src/components'), ...ficheirosDe('src/pages')]) {
      const conteudo = readFileSync(caminho, 'utf8');
      for (const linha of conteudo.split(String.fromCharCode(10))) {
        if (/^\s*(\/\/|\*)/.test(linha)) continue;
        if (comparacao.test(linha)) infractores.push(`${caminho.split('src')[1]}: ${linha.trim()}`);
      }
    }
    expect(infractores, 'severidade em género feminino').toEqual([]);
  });
});
