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
}

export const DEFAULT_MATRIZ_NOME = 'Matriz Padrão 5×5';

export const DEFAULT_METODO_CALCULO: MetodoCalculo = 'multiplicacao';

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

/** Mensagem acionável quando a configuração não pôde ser carregada/provisionada. */
export const MATRIZ_CONFIG_ERRO_TITULO = 'Matriz de risco não configurada';

export const MATRIZ_CONFIG_ERRO_DESCRICAO =
  'Não foi possível carregar a configuração da matriz (escalas e faixas de nível). ' +
  'Sem ela o nível de risco não pode ser calculado e novos riscos não podem ser criados. ' +
  'Abra "Configurar Matriz" para criar ou revisar a matriz da sua empresa.';

/**
 * Nível de risco a partir de probabilidade × impacto e das faixas da matriz.
 * Retorna `null` — nunca um valor inventado — quando falta configuração ou o
 * resultado não cai em nenhuma faixa.
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

/** Score máximo tolerado (limite de apetite) declarado na configuração. */
export function apetiteScoreFromNiveis(niveis?: NivelRisco[] | null): number | null {
  if (!niveis || niveis.length === 0) return null;
  const norm = (s?: string) =>
    (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const lvl = niveis.find((n) => n.apetite) || niveis.find((n) => norm(n.nivel) === 'medio');
  return lvl ? lvl.max : null;
}
