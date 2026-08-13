/**
 * Dicionários modulares (Onda de internacionalização).
 *
 * Cada módulo mantém seu próprio arquivo `<modulo>.ts` exportando
 * `{ pt: {...}, en: {...} }`. Isso evita conflitos em `pt.ts`/`en.ts`
 * (arquivos gigantes) e mantém as chaves de cada módulo colocalizadas.
 *
 * Uso normal continua sendo `const { t } = useLanguage()` com a chave
 * completa, ex.: t('riscos.title').
 */
import { riscos } from './riscos';
import { riscosVisoes } from './riscos-visoes';
import { documentos } from './documentos';
import { docgen } from './docgen';
import { gapAnalysis } from './gap-analysis';
import { planosAcao } from './planos-acao';
import { minhasTarefas } from './minhas-tarefas';

type ModuleDict = { pt: Record<string, unknown>; en: Record<string, unknown> };

const modules: Record<string, ModuleDict> = {
  riscos,
  riscosVisoes,
  documentos,
  docgen,
  gapAnalysis,
  planosAcao,
  minhasTarefas,
};


function collect(locale: 'pt' | 'en'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const mod of Object.values(modules)) {
    Object.assign(out, mod[locale]);
  }
  return out;
}

export const modulesPt = collect('pt');
export const modulesEn = collect('en');
