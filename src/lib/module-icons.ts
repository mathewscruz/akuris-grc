import type { ComponentType } from 'react';
import {
  RiscosIcon,
  ControlesIcon,
  AtivosIcon,
  GapAnalysisIcon,
  DocumentosIcon,
  IncidentesIcon,
  DueDiligenceIcon,
  DenunciasIcon,
  IconDashboard,
  IconChecklist,
  IconBoard,
  IconLicense,
  IconKey,
  IconHandshake,
  IconLock,
  IconServer,
  IconPerson,
  IconUserCheck,
  IconLifebuoy,
  IconChart,
  IconSettings,
  IconFramework,
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
  '/dashboard': IconDashboard,
  '/planos-acao': IconChecklist,
  '/projetos': IconBoard,
  '/riscos': RiscosIcon,
  '/governanca': ControlesIcon,
  '/gap-analysis': GapAnalysisIcon,
  '/gap-analysis/frameworks': IconFramework,
  '/ativos': AtivosIcon,
  '/ativos/licencas': IconLicense,
  '/ativos/chaves': IconKey,
  '/contratos': IconHandshake,
  '/documentos': DocumentosIcon,
  '/privacidade': IconLock,
  '/sistemas': IconServer,
  '/contas-privilegiadas': IconPerson,
  '/revisao-acessos': IconUserCheck,
  '/incidentes': IncidentesIcon,
  '/due-diligence': DueDiligenceIcon,
  '/denuncia': DenunciasIcon,
  '/continuidade': IconLifebuoy,
  '/relatorios': IconChart,
  '/configuracoes': IconSettings,
};

/** O ícone do módulo servido por esta rota. */
export const moduleIcon = (rota: string) => MODULE_ICON[rota];
