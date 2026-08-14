/**
 * T4 — apoio aos testes de controlo.
 * Espelha `public.proxima_data_por_frequencia` para que a interface consiga
 * antecipar a próxima data prevista sem esperar pelo trigger da base de dados.
 * Agnóstico de framework: a frequência é a do controlo, seja de que norma for.
 */
const MESES: Record<string, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  quadrimestral: 4,
  semestral: 6,
  anual: 12,
  bianual: 24,
};

const DIAS: Record<string, number> = {
  diaria: 1,
  diario: 1,
  semanal: 7,
  quinzenal: 15,
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function proximaDataPorFrequencia(
  dataTeste: string | null | undefined,
  frequencia: string | null | undefined,
): string | null {
  if (!dataTeste || !frequencia) return null;
  const base = new Date(`${dataTeste}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const freq = frequencia.toLowerCase().trim();

  if (DIAS[freq]) {
    base.setDate(base.getDate() + DIAS[freq]);
    return iso(base);
  }
  if (MESES[freq]) {
    base.setMonth(base.getMonth() + MESES[freq]);
    return iso(base);
  }
  return null;
}

export type ResultadoTesteControle =
  | 'eficaz'
  | 'parcialmente_eficaz'
  | 'ineficaz'
  | 'nao_aplicavel';

const ALIAS: Record<string, ResultadoTesteControle> = {
  eficaz: 'eficaz',
  efetivo: 'eficaz',
  efectivo: 'eficaz',
  aprovado: 'eficaz',
  conforme: 'eficaz',
  parcial: 'parcialmente_eficaz',
  parcialmente_eficaz: 'parcialmente_eficaz',
  parcialmente_efetivo: 'parcialmente_eficaz',
  ineficaz: 'ineficaz',
  nao_eficaz: 'ineficaz',
  nao_efetivo: 'ineficaz',
  reprovado: 'ineficaz',
  nao_conforme: 'ineficaz',
  nao_aplicavel: 'nao_aplicavel',
  na: 'nao_aplicavel',
};

export const normalizarResultadoTeste = (
  valor: string | null | undefined,
): ResultadoTesteControle | null =>
  ALIAS[(valor || '').toLowerCase().trim()] ?? null;

type Translate = (key: string, params?: Record<string, unknown>) => string;

export const resultadoTesteLabel = (valor: string | null | undefined, t: Translate) => {
  const canon = normalizarResultadoTeste(valor);
  return canon ? t(`t4.testes.resultado.${canon}`) : (valor || '—');
};

export const resultadoTesteTone = (
  valor: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' => {
  switch (normalizarResultadoTeste(valor)) {
    case 'eficaz':
      return 'success';
    case 'parcialmente_eficaz':
      return 'warning';
    case 'ineficaz':
      return 'danger';
    default:
      return 'neutral';
  }
};

export const frequenciaLabel = (frequencia: string | null | undefined, t: Translate) => {
  if (!frequencia) return '—';
  const key = `campos.frequencia.${frequencia.toLowerCase().trim()}`;
  const label = t(key);
  return label === key ? frequencia : label;
};

export interface TesteResumo {
  controle_id: string;
  total: number;
  ultimoResultado: string | null;
  ultimaData: string | null;
  proxima: string | null;
}

/** Resumo por controlo: quantos testes existem e como correu o último. */
export function resumirTestesPorControlo(
  testes: Array<{ controle_id: string; resultado?: string | null; data_teste?: string | null; proxima_avaliacao?: string | null }> | null | undefined,
): Map<string, TesteResumo> {
  const mapa = new Map<string, TesteResumo>();
  (testes ?? []).forEach((teste) => {
    const id = teste.controle_id;
    if (!id) return;
    const atual = mapa.get(id);
    const maisRecente =
      !atual?.ultimaData || new Date(teste.data_teste || 0) >= new Date(atual.ultimaData);
    mapa.set(id, {
      controle_id: id,
      total: (atual?.total ?? 0) + 1,
      ultimoResultado: maisRecente ? teste.resultado ?? null : atual?.ultimoResultado ?? null,
      ultimaData: maisRecente ? teste.data_teste ?? null : atual?.ultimaData ?? null,
      proxima: maisRecente ? teste.proxima_avaliacao ?? null : atual?.proxima ?? null,
    });
  });
  return mapa;
}
