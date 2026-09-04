import type { ComponentType } from 'react';
import {
  RiscosIcon,
  ControlesIcon,
  AuditoriasIcon,
  GovernancaIcon,
  AtivosIcon,
  GapAnalysisIcon,
  DocumentosIcon,
  IncidentesIcon,
  DueDiligenceIcon,
  DenunciasIcon,
  DashboardIcon,
  PlanosAcaoIcon,
  ProjetosIcon,
  FrameworksIcon,
  LicencasIcon,
  ChavesIcon,
  ContratosIcon,
  PrivacidadeIcon,
  SistemasIcon,
  ContasPrivilegiadasIcon,
  RevisaoAcessosIcon,
  ContinuidadeIcon,
  RelatoriosIcon,
  ConfiguracoesIcon,
} from '@/components/icons';

/**
 * Um módulo, um ícone — em qualquer sítio onde ele apareça.
 *
 * O mesmo módulo era desenhado por três listas independentes: o menu lateral,
 * a paleta de busca e a navegação móvel. Cada uma escolhia o seu glifo, e as
 * três divergiam: o painel era `IconDashboard` no menu e `IconGrid` na busca;
 * Riscos era o ícone próprio do módulo no menu e um triângulo de aviso na
 * busca; Denúncias era uma caixa de seleção na navegação móvel. Quem procura
 * "Riscos" e vê um desenho diferente do que está no menu não reconhece que é o
 * mesmo sítio — o ícone deixou de ser endereço.
 *
 * A chave é a rota, porque é o que identifica o módulo sem ambiguidade. Quem
 * acrescentar um módulo acrescenta aqui, e as três listas seguem sozinhas.
 */
export const MODULE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  '/dashboard': DashboardIcon,
  '/planos-acao': PlanosAcaoIcon,
  '/projetos': ProjetosIcon,
  '/riscos': RiscosIcon,
  '/governanca': GovernancaIcon,
  '/governanca/controles': ControlesIcon,
  '/governanca/auditorias': AuditoriasIcon,
  '/gap-analysis': GapAnalysisIcon,
  '/gap-analysis/frameworks': FrameworksIcon,
  '/ativos': AtivosIcon,
  '/ativos/licencas': LicencasIcon,
  '/ativos/chaves': ChavesIcon,
  '/contratos': ContratosIcon,
  '/documentos': DocumentosIcon,
  '/privacidade': PrivacidadeIcon,
  '/sistemas': SistemasIcon,
  '/contas-privilegiadas': ContasPrivilegiadasIcon,
  '/revisao-acessos': RevisaoAcessosIcon,
  '/incidentes': IncidentesIcon,
  '/due-diligence': DueDiligenceIcon,
  '/denuncia': DenunciasIcon,
  '/continuidade': ContinuidadeIcon,
  '/relatorios': RelatoriosIcon,
  '/configuracoes': ConfiguracoesIcon,
};

/** O ícone do módulo servido por esta rota. */
export const moduleIcon = (rota: string) => MODULE_ICON[rota];
