/**
 * Configuração da matriz de risco — fonte única de verdade (AKURIS QA-055).
 *
 * Sem uma linha em `riscos_matriz_configuracao` não existe faixa de níveis e,
 * portanto, não há nível de risco calculável: a criação de risco fica
 * bloqueada e a consulta com `.single()` devolve HTTP 406 / `PGRST116`.
 *
 * A migração `20260806130000_riscos_matriz_padrao.sql` provisiona a
 * configuração padrão abaixo para toda empresa (existentes por backfill,
 * novas por trigger). Os defaults aqui são os MESMOS da migração — o teste
 * `riscos-matriz-padrao.test.ts` falha se as duas pontas divergirem.
 */

export interface EscalaItem {
  valor: string;
  descricao: string;
}

export interface NivelRisco {
  min: number;
  max: number;
  nivel: string;
  cor?: string;
  apetite?: boolean;
}

export type MetodoCalculo = 'multiplicacao' | 'soma';

export interface MatrizConfiguracao {
  escala_probabilidade?: EscalaItem[];
  escala_impacto?: EscalaItem[];
  niveis_risco?: NivelRisco[];
  metodo_calculo?: string | null;
  /** Limite de apetite em score. Coluna própria desde a migration 20260821100000. */
  apetite_score?: number | null;
}

export const DEFAULT_MATRIZ_NOME = 'Matriz Padrão 5×5';

const DEFAULT_METODO_CALCULO: MetodoCalculo = 'multiplicacao';

export const DEFAULT_ESCALA_PROBABILIDADE: EscalaItem[] = [
  { valor: '1', descricao: 'Muito Raro' },
  { valor: '2', descricao: 'Raro' },
  { valor: '3', descricao: 'Ocasional' },
  { valor: '4', descricao: 'Provável' },
  { valor: '5', descricao: 'Muito Provável' },
];

export const DEFAULT_ESCALA_IMPACTO: EscalaItem[] = [
  { valor: '1', descricao: 'Insignificante' },
  { valor: '2', descricao: 'Menor' },
  { valor: '3', descricao: 'Moderado' },
  { valor: '4', descricao: 'Maior' },
  { valor: '5', descricao: 'Catastrófico' },
];

/**
 * Faixas 1–25 sem gaps nem sobreposição (mesma validação do MatrizForm).
 * "Médio" carrega `apetite: true`: é o limite de apetite padrão já assumido
 * pelo fallback da página de Riscos.
 */
export const DEFAULT_NIVEIS_RISCO: NivelRisco[] = [
  { min: 1, max: 4, nivel: 'Baixo', cor: '#22c55e' },
  { min: 5, max: 9, nivel: 'Médio', cor: '#eab308', apetite: true },
  { min: 10, max: 16, nivel: 'Alto', cor: '#f97316' },
  { min: 17, max: 25, nivel: 'Crítico', cor: '#dc2626' },
];

/**
 * Nível de risco a partir de probabilidade × impacto e das faixas da matriz.
 * Retorna `null` — nunca um valor inventado — quando falta configuração ou o
 * resultado não cai em nenhuma faixa.
 *
 * PRÉ-VISUALIZAÇÃO apenas: mostra o nível enquanto o utilizador preenche o
 * formulário e no cartão de residual sugerido. O valor que fica gravado é
 * sempre o que `public.risco_avaliar` calcula — a mesma regra, do lado do
 * banco, onde não há como um ecrã esquecer-se de a aplicar.
 */
export function nivelRiscoFromConfig(
  probabilidade: string | number | null | undefined,
  impacto: string | number | null | undefined,
  config: MatrizConfiguracao | null | undefined,
): string | null {
  const niveis = config?.niveis_risco;
  if (!niveis || niveis.length === 0) return null;

  const p = Number(probabilidade);
  const i = Number(impacto);
  if (!Number.isFinite(p) || !Number.isFinite(i)) return null;

  const metodo = config?.metodo_calculo === 'soma' ? 'soma' : DEFAULT_METODO_CALCULO;
  const resultado = metodo === 'soma' ? p + i : p * i;

  const faixa = niveis.find((n) => resultado >= n.min && resultado <= n.max);
  return faixa?.nivel || null;
}

/**
 * Score máximo tolerado (limite de apetite).
 *
 * Vem da coluna `apetite_score`. O caminho antigo — procurar `apetite: true`
 * dentro do JSON das faixas e, não encontrando, uma faixa chamada "médio" —
 * devolvia `null` a qualquer empresa que tivesse renomeado as faixas. Nesse
 * estado, "Acima do apetite" caía num atalho por severidade e o limite
 * configurado deixava de valer, sem nada no ecrã dizer isso.
 */
export function apetiteScoreDaConfig(config?: MatrizConfiguracao | null): number | null {
  if (!config) return null;
  if (typeof config.apetite_score === 'number') return config.apetite_score;
  const niveis = config.niveis_risco;
  if (!niveis || niveis.length === 0) return null;
  const marcado = niveis.find((n) => n.apetite);
  if (marcado) return marcado.max;
  // Sem marcação: a segunda faixa a contar de baixo — mesmo critério do backfill.
  const ordenadas = [...niveis].sort((a, b) => a.min - b.min);
  return (ordenadas[1] ?? ordenadas[0])?.max ?? null;
}

/** Rótulo da faixa correspondente ao limite de apetite — o da empresa, não "Médio". */
export function apetiteLabelDaConfig(config?: MatrizConfiguracao | null): string | null {
  const score = apetiteScoreDaConfig(config);
  if (score === null) return null;
  return config?.niveis_risco?.find((n) => n.max === score)?.nivel ?? null;
}

/** Cores por omissão das faixas, do menos para o mais grave. */
const CORES_FAIXA = ['#22c55e', '#eab308', '#f97316', '#dc2626'];
const NOMES_FAIXA = ['Baixo', 'Médio', 'Alto', 'Crítico'];

/**
 * Todos os resultados que a escala escolhida consegue produzir, ordenados.
 *
 * Não é o intervalo entre o menor e o maior: numa 5×5 multiplicativa não
 * existe nenhum score entre 17 e 19, nem 11, 13 ou 14. Uma faixa 17–19 seria
 * inatingível e ninguém no ecrã perceberia.
 */
export function scoresPossiveis(pMax: number, iMax: number, metodo?: string | null): number[] {
  const set = new Set<number>();
  for (let p = 1; p <= pMax; p++) {
    for (let i = 1; i <= iMax; i++) {
      set.add(metodo === 'soma' ? p + i : p * i);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Faixas que cobrem a escala inteira e em que nenhuma fica vazia.
 *
 * É isto que desarma a armadilha do método "Soma": trocar P × I por P + I numa
 * 5×5 baixa o resultado máximo de 25 para 10, e as faixas 1–4 / 5–9 / 10–16 /
 * 17–25 continuavam lá — "Crítico" tornava-se impossível e "acima do apetite"
 * ficava preso em zero. Em vez de só recusar ao gravar, o formulário reajusta.
 *
 * Divide os resultados POSSÍVEIS em quatro grupos de tamanho semelhante, e não
 * o intervalo em quatro partes iguais: com produtos, os valores baixos são
 * densos e os altos esparsos.
 */
export function faixasPara(
  pMax: number,
  iMax: number,
  metodo?: string | null,
  anteriores?: NivelRisco[] | null,
): NivelRisco[] {
  // A 5×5 multiplicativa é o caso canónico e tem faixas consagradas
  // (1–4 / 5–9 / 10–16 / 17–25). Não vale a pena derivá-las e sair com
  // números que ninguém reconhece.
  if (pMax === 5 && iMax === 5 && metodo !== 'soma') {
    return DEFAULT_NIVEIS_RISCO.map((f, k) => ({
      ...f,
      nivel: anteriores?.[k]?.nivel || f.nivel,
      cor: anteriores?.[k]?.cor || f.cor,
      apetite: false,
    }));
  }

  const possiveis = scoresPossiveis(pMax, iMax, metodo);
  const n = possiveis.length;
  if (n === 0) return [];

  const quantas = Math.min(4, n);
  const faixas: NivelRisco[] = [];

  for (let k = 0; k < quantas; k++) {
    const fimIdx = k === quantas - 1 ? n - 1 : Math.floor(((k + 1) * n) / quantas) - 1;
    const min = k === 0 ? possiveis[0] : faixas[k - 1].max + 1;
    const max = possiveis[Math.max(fimIdx, possiveis.indexOf(min))];
    // Rótulo e cor que a empresa já tinha na mesma posição, quando existem.
    const antiga = anteriores?.[k];
    faixas.push({
      min,
      max,
      nivel: antiga?.nivel || NOMES_FAIXA[Math.floor((k * 4) / quantas)] || `Nível ${k + 1}`,
      cor: antiga?.cor || CORES_FAIXA[Math.floor((k * 4) / quantas)],
      apetite: false,
    });
  }
  return faixas;
}

export interface ProblemaFaixas {
  tipo: 'nao_cobrem' | 'inalcancavel' | 'sobreposicao' | 'min_maior';
  mensagem: string;
  /** Faixas envolvidas, para destacar no formulário. */
  niveis?: string[];
}

/**
 * As mesmas três regras que `criar_matriz_com_configuracao` aplica no banco —
 * aqui para o utilizador as ver ANTES de carregar em Guardar.
 */
export function validarFaixas(
  faixas: NivelRisco[],
  pMax: number,
  iMax: number,
  metodo?: string | null,
): ProblemaFaixas | null {
  if (faixas.length === 0) return null;

  const ordenadas = [...faixas].sort((a, b) => a.min - b.min);
  for (let k = 0; k < ordenadas.length; k++) {
    const f = ordenadas[k];
    if (f.min > f.max) {
      return { tipo: 'min_maior', mensagem: f.nivel, niveis: [f.nivel] };
    }
    const seguinte = ordenadas[k + 1];
    if (seguinte && f.max >= seguinte.min) {
      return { tipo: 'sobreposicao', mensagem: `${f.nivel} · ${seguinte.nivel}`, niveis: [f.nivel, seguinte.nivel] };
    }
  }

  const possiveis = scoresPossiveis(pMax, iMax, metodo);
  const semFaixa = possiveis.filter((s) => !faixas.some((f) => s >= f.min && s <= f.max));
  if (semFaixa.length > 0) {
    return { tipo: 'nao_cobrem', mensagem: semFaixa.join(', ') };
  }

  const vazias = faixas.filter((f) => !possiveis.some((s) => s >= f.min && s <= f.max));
  if (vazias.length > 0) {
    return {
      tipo: 'inalcancavel',
      mensagem: `${possiveis[0]}–${possiveis[possiveis.length - 1]}`,
      niveis: vazias.map((f) => f.nivel),
    };
  }
  return null;
}
