/**
 * Seleção de conteúdo bilíngue (PT/EN) dos frameworks e requisitos do Gap Analysis.
 *
 * O conteúdo dos frameworks é DADO (vive no banco), não texto de tela. As colunas
 * `*_en` guardam a versão em inglês; quando ela ainda não existe, cai no português.
 *
 * IMPORTANTE: apenas a exibição muda. Scoring, filtros e agrupamentos devem continuar
 * usando os campos originais como chave para não alterar nenhum cálculo.
 */
import { getAppLocale } from './i18n-locale';

const pick = (pt?: string | null, en?: string | null): string => {
  if (getAppLocale() === 'en') {
    const v = (en ?? '').trim();
    if (v) return v;
  }
  return pt ?? '';
};

export interface LocalizableRequirement {
  titulo?: string | null;
  titulo_en?: string | null;
  descricao?: string | null;
  descricao_en?: string | null;
  categoria?: string | null;
  categoria_en?: string | null;
  orientacao_implementacao?: string | null;
  orientacao_implementacao_en?: string | null;
  exemplos_evidencias?: string | null;
  exemplos_evidencias_en?: string | null;
  perguntas_diagnostico?: string | null;
  perguntas_diagnostico_en?: string | null;
}

export interface LocalizableFramework {
  nome?: string | null;
  nome_en?: string | null;
  descricao?: string | null;
  descricao_en?: string | null;
}

export const reqTitulo = (r?: LocalizableRequirement | null) => pick(r?.titulo, r?.titulo_en);
export const reqDescricao = (r?: LocalizableRequirement | null) => pick(r?.descricao, r?.descricao_en);
export const reqCategoria = (r?: LocalizableRequirement | null) => pick(r?.categoria, r?.categoria_en);
export const reqOrientacao = (r?: LocalizableRequirement | null) =>
  pick(r?.orientacao_implementacao, r?.orientacao_implementacao_en);
export const reqEvidencias = (r?: LocalizableRequirement | null) =>
  pick(r?.exemplos_evidencias, r?.exemplos_evidencias_en);
export const reqPerguntas = (r?: LocalizableRequirement | null) =>
  pick(r?.perguntas_diagnostico, r?.perguntas_diagnostico_en);

export const fwNome = (f?: LocalizableFramework | null) => pick(f?.nome, f?.nome_en);
export const fwDescricao = (f?: LocalizableFramework | null) => pick(f?.descricao, f?.descricao_en);

/** Campos localizados de um requisito, prontos para exibição. */
export function localizeRequirement<T extends LocalizableRequirement>(r: T) {
  return {
    ...r,
    titulo: reqTitulo(r),
    descricao: reqDescricao(r),
    categoria: reqCategoria(r),
    orientacao_implementacao: reqOrientacao(r),
    exemplos_evidencias: reqEvidencias(r),
    perguntas_diagnostico: reqPerguntas(r),
  };
}

/** Campos localizados de um framework, prontos para exibição. */
export function localizeFramework<T extends LocalizableFramework>(f: T) {
  return { ...f, nome: fwNome(f), descricao: fwDescricao(f) };
}

/** Colunas a selecionar no Supabase quando o conteúdo bilíngue for exibido. */
export const REQUIREMENT_I18N_COLUMNS =
  'titulo_en, descricao_en, categoria_en, orientacao_implementacao_en, exemplos_evidencias_en, perguntas_diagnostico_en';
export const FRAMEWORK_I18N_COLUMNS = 'nome_en, descricao_en';
