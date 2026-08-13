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
import { gapUi } from './gap-ui';
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
import { dashboardWidgets } from './dashboard-widgets';
import { publicPortal } from './public-portal';
import { denunciasAdmin } from './denuncias';
import { admin } from './admin-empresas';
import { acessosDd } from './acessos-dd';
import { modDialogs } from './modulos-dialogs';
import { contratosDialogs } from './contratos-dialogs';
import { dadosDialogs } from './dados-dialogs';
import { govDialogs } from './gov-dialogs';
import { configIntegrations } from './config-integrations';
import { configPerms } from './config-permissoes';
import { configPlanos } from './config-planos';
import { configGeral } from './config-geral';
import { finalI18n } from './final-i18n';
import { campos } from './campos';
import { cardsKpi } from './cards-kpi';

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
  gapUi,
  gapExports,
  contratosAtivos,
  planosAcao,
  minhasTarefas,
  projetos,
  controlesAuditorias,
  dueDiligence,
  dadosDashboard,
  dashboardWidgets,
  incidentesComp,
  continuidadeComp,
  contasPrivilegiadasComp,
  revisaoAcessosComp,
  relatoriosComp,
  governancaComp,
  publicPortal,
  denunciasAdmin,
  admin,
  acessosDd,
  modDialogs,
  contratosDialogs,
  dadosDialogs,
  govDialogs,
  configIntegrations,
  configPerms,
  configPlanos,
  configGeral,
  finalI18n,
  campos,
  cardsKpi,
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
