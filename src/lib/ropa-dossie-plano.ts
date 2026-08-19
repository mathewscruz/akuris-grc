/**
 * Onde cada campo do ROPA aparece no dossiê — e só onde.
 *
 * O dossiê tem quatro superfícies: a capa (identidade), a linha de sinais
 * (risco), o percurso do dado (a história) e os capítulos (o resto da ficha).
 * A primeira versão desenhava as três primeiras e depois repetia os mesmos
 * campos nos capítulos: o parágrafo de "Fonte dos dados" lia-se em Origem e
 * outra vez em Dados, e o "Alto" do risco aparecia na capa e no capítulo Risco.
 *
 * A repartição vive aqui, fora do componente, para que possa ser verificada:
 * cada campo do esquema pertence a exactamente uma superfície. Renomear um
 * campo em `ropa-schema.ts` sem actualizar isto deixa de ser um erro invisível
 * — passa a partir o teste `dossie-sem-repeticao`.
 */
import { PERCURSO_DO_DADO } from '@/lib/ropa-percurso';
import { ROPA_FIELDS } from '@/lib/ropa-schema';

/** Identidade do documento: cabeçalho da capa. */
export const CAMPOS_DA_CAPA = ['nome_tratamento', 'codigo', 'area_responsavel'] as const;

/**
 * O que a capa mostra como sinal: só o nível de risco, na pílula de severidade.
 *
 * Havia também uma linha de leituras — "Status · Probabilidade · Impacto ·
 * Bases legais". Saiu por ser ruído: o estado já está na lista, a contagem de
 * bases repete a frase da secção logo abaixo, e probabilidade e impacto são
 * detalhe de ficha, não manchete. Voltam ao capítulo Risco, onde se leem ao
 * lado da sua descrição.
 */
export const CAMPOS_DOS_SINAIS = ['risco_nivel'] as const;

/** As sete etapas da história do dado. */
export const CAMPOS_DO_PERCURSO = PERCURSO_DO_DADO.map((e) => e.campo);

/**
 * Projeções da primeira linha de `ropa_bases_legais` — o gatilho da migração
 * `20260819200000` copia-as para `ropa_registros` para que o filtro da lista e
 * o PDF continuem a funcionar. Só saem dos capítulos quando existe a secção de
 * bases legais para as mostrar; num registo antigo sem linhas normalizadas, os
 * campos brutos são a única prova que há.
 */
export const CAMPOS_DAS_BASES_LEGAIS = ['base_legal', 'justificativa_base_legal'] as const;

/** Campos que as secções acima dos capítulos já mostram. */
export const camposJaMostrados = (temBasesNormalizadas: boolean): Set<string> => {
  const fora = new Set<string>([
    ...CAMPOS_DA_CAPA,
    ...CAMPOS_DOS_SINAIS,
    ...CAMPOS_DO_PERCURSO,
  ]);
  if (temBasesNormalizadas) CAMPOS_DAS_BASES_LEGAIS.forEach((c) => fora.add(c));
  return fora;
};

/** Campos que sobram para os capítulos. */
export const camposDosCapitulos = (temBasesNormalizadas: boolean): string[] => {
  const fora = camposJaMostrados(temBasesNormalizadas);
  return ROPA_FIELDS.map((f) => f.key).filter((k) => !fora.has(k));
};

/** Chaves declaradas aqui que já não existem no esquema. */
export const camposDoPlanoForaDoEsquema = (): string[] =>
  [
    ...CAMPOS_DA_CAPA,
    ...CAMPOS_DOS_SINAIS,
    ...CAMPOS_DO_PERCURSO,
    ...CAMPOS_DAS_BASES_LEGAIS,
  ].filter((chave) => !ROPA_FIELDS.some((f) => f.key === chave));
