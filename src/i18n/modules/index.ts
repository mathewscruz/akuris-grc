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
import { riscosDialogs } from './riscos-dialogs';
import { riscosDetalhe } from './riscos-detalhe';
import { documentos } from './documentos';
import { documentosExtras } from './documentos-extras';
import { docgen } from './docgen';
import { gapAnalysis } from './gap-analysis';
import { gapAdherence } from './gap-adherence';
import { gapV2 } from './gap-v2';
import { gapExports } from './gap-exports';
import { planosAcao } from './planos-acao';
import { minhasTarefas } from './minhas-tarefas';
import { contratosAtivos } from './contratos-ativos';
import { dueDiligence } from './due-diligence';
import { controlesAuditorias } from './controles-auditorias';
import { projetos } from './projetos';
import { incidentesComp } from './incidentes-comp';
import { continuidadeComp } from './continuidade-comp';
import { contasPrivilegiadasComp } from './contas-privilegiadas-comp';
import { revisaoAcessosComp } from './revisao-acessos-comp';
import { relatoriosComp } from './relatorios-comp';
import { governancaComp } from './governanca-comp';
import { dadosDashboard } from './dados-dashboard';

type ModuleDict = { pt: Record<string, unknown>; en: Record<string, unknown> };

const modules: Record<string, ModuleDict> = {
  riscos,
  riscosVisoes,
  riscosDialogs,
  riscosDetalhe,
  documentos,
  documentosExtras,
  docgen,
  gapAnalysis,
  gapAdherence,
  gapV2,
  gapExports,
  planosAcao,
  minhasTarefas,
  projetos,
  controlesAuditorias,
  dueDiligence,
  dadosDashboard,
  incidentesComp,
  continuidadeComp,
  contasPrivilegiadasComp,
  revisaoAcessosComp,
  relatoriosComp,
  governancaComp,
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
