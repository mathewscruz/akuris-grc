import { ComplianceIcon, GestaoAcessosIcon, GestaoAtivosIcon } from '@/components/icons';
import { MODULE_ICON } from '@/lib/module-icons';

type MenuItem = {
  title: string;
  shortTitle?: string;
  url?: string;
  icon: any;
  moduleName?: string;
  subItems?: { title: string; url: string; icon: any; moduleName?: string; description?: string }[];
};

type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

export const getMenuSections = (t: (key: string) => string): MenuSection[] => [
  {
    id: 'main',
    label: t('sidebar.sectionOperation'),
    items: [
      { title: t('sidebar.dashboard'), url: '/dashboard', icon: MODULE_ICON['/dashboard'], moduleName: 'dashboard' },
      {
        title: t('sidebar.groupExecution'), icon: MODULE_ICON['/planos-acao'],
        subItems: [
          { title: t('sidebar.actionPlans'), url: '/planos-acao', description: t('sidebar.desc.actionPlans'), icon: MODULE_ICON['/planos-acao'], moduleName: 'planos-acao' },
          { title: t('sidebar.projects'), url: '/projetos', description: t('sidebar.desc.projects'), icon: MODULE_ICON['/projetos'], moduleName: 'projetos' },
        ],
      },
      {
        title: t('sidebar.groupRisks'), icon: MODULE_ICON['/riscos'],
        subItems: [
          { title: t('sidebar.riskManagement'), url: '/riscos', description: t('sidebar.desc.risks'), icon: MODULE_ICON['/riscos'], moduleName: 'riscos' },
          { title: t('sidebar.incidents'), url: '/incidentes', description: t('sidebar.desc.incidents'), icon: MODULE_ICON['/incidentes'], moduleName: 'incidentes' },
          { title: t('sidebar.businessContinuity'), url: '/continuidade', description: t('sidebar.desc.continuity'), icon: MODULE_ICON['/continuidade'], moduleName: 'continuidade' },
        ],
      },
      {
        title: t('sidebar.groupCompliance'), icon: MODULE_ICON['/gap-analysis'],
        subItems: [
          { title: t('sidebar.gapAnalysis'), url: '/gap-analysis/frameworks', description: t('sidebar.desc.gapAnalysis'), icon: MODULE_ICON['/gap-analysis'], moduleName: 'gap-analysis' },
          { title: t('sidebar.governance'), url: '/governanca', description: t('sidebar.desc.governance'), icon: MODULE_ICON['/governanca'], moduleName: 'controles' },
          { title: t('sidebar.documents'), url: '/documentos', description: t('sidebar.desc.documents'), icon: MODULE_ICON['/documentos'], moduleName: 'documentos' },
        ],
      },
      {
        title: t('sidebar.assetManagement'), shortTitle: t('sidebar.short.assetManagement'),
        icon: GestaoAtivosIcon,
        subItems: [
          { title: t('sidebar.assets'), url: '/ativos', description: t('sidebar.desc.assets'), icon: MODULE_ICON['/ativos'], moduleName: 'ativos' },
          { title: t('sidebar.licenses'), url: '/ativos/licencas', description: t('sidebar.desc.licenses'), icon: MODULE_ICON['/ativos/licencas'], moduleName: 'ativos' },
          { title: t('sidebar.keys'), url: '/ativos/chaves', description: t('sidebar.desc.keys'), icon: MODULE_ICON['/ativos/chaves'], moduleName: 'ativos' },
        ],
      },
      {
        title: t('sidebar.accessManagement'), shortTitle: t('sidebar.short.accessManagement'),
        icon: GestaoAcessosIcon,
        subItems: [
          { title: t('sidebar.systems'), url: '/sistemas', description: t('sidebar.desc.systems'), icon: MODULE_ICON['/sistemas'], moduleName: 'controles' },
          { title: t('sidebar.privilegedAccounts'), url: '/contas-privilegiadas', description: t('sidebar.desc.privilegedAccounts'), icon: MODULE_ICON['/contas-privilegiadas'], moduleName: 'contas-privilegiadas' },
          { title: t('sidebar.accessReview'), url: '/revisao-acessos', description: t('sidebar.desc.accessReview'), icon: MODULE_ICON['/revisao-acessos'], moduleName: 'contas-privilegiadas' },
        ],
      },
      {
        title: t('experience.thirdPartiesEthics'), shortTitle: t('sidebar.short.thirdParties'),
        icon: ComplianceIcon,
        subItems: [
          { title: t('sidebar.dueDiligence'), url: '/due-diligence', description: t('sidebar.desc.dueDiligence'), icon: MODULE_ICON['/due-diligence'], moduleName: 'due-diligence' },
          { title: t('sidebar.contracts'), url: '/contratos', description: t('sidebar.desc.contracts'), icon: MODULE_ICON['/contratos'], moduleName: 'contratos' },
          { title: t('sidebar.whistleblowing'), url: '/denuncia', description: t('sidebar.desc.whistleblowing'), icon: MODULE_ICON['/denuncia'], moduleName: 'denuncia' },
        ],
      },
      { title: t('sidebar.privacy'), url: '/privacidade', icon: MODULE_ICON['/privacidade'], moduleName: 'dados' },
      { title: t('sidebar.reports'), url: '/relatorios', icon: MODULE_ICON['/relatorios'], moduleName: 'relatorios' },
    ],
  },
];

export function getSearchModules(t: (key: string) => string) {
  const sections = getMenuSections(t);
  const items = sections.flatMap((section) => section.items.flatMap<MenuItem>((item) => item.subItems ?? [item]));
  return [...items,
    { title: t('sidebar.internalControls'), url: '/governanca/controles', icon: MODULE_ICON['/governanca/controles'], moduleName: 'controles' },
    { title: t('sidebar.audits'), url: '/governanca/auditorias', icon: MODULE_ICON['/governanca/auditorias'], moduleName: 'auditorias' },
    { title: t('experience.personalWork'), url: '/projetos/minhas-tarefas', icon: MODULE_ICON['/planos-acao'], moduleName: 'projetos' },
    { title: t('sidebar.settings'), url: '/configuracoes', icon: MODULE_ICON['/configuracoes'], moduleName: 'configuracoes' },
  ].filter((item) => item.url);
}

/** Grupo do menu lateral que contém o caminho (null para itens de topo). */
export function getModuleGroup(pathname: string, t: (key: string) => string): string | null {
  const base = (url: string) => url.replace(/\/frameworks$/, '');
  let best: { title: string; len: number } | null = null;
  for (const item of getMenuSections(t).flatMap((s) => s.items)) {
    for (const sub of item.subItems ?? []) {
      const b = base(sub.url);
      if ((pathname === sub.url || pathname === b || pathname.startsWith(b + '/')) && (!best || b.length > best.len)) {
        best = { title: item.title, len: b.length };
      }
    }
  }
  return best?.title ?? null;
}
