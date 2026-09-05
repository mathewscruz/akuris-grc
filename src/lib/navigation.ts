import { ComplianceIcon, GestaoAcessosIcon, GestaoAtivosIcon } from '@/components/icons';
import { MODULE_ICON } from '@/lib/module-icons';

type MenuItem = {
  title: string;
  url?: string;
  icon: any;
  moduleName?: string;
  subItems?: { title: string; url: string; icon: any; moduleName?: string }[];
};

type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

export const getMenuSections = (t: (key: string) => string): MenuSection[] => [
  {
    id: 'operation',
    label: t('sidebar.sectionOperation'),
    items: [
      { title: t('sidebar.dashboard'), url: '/dashboard', icon: MODULE_ICON['/dashboard'], moduleName: 'dashboard' },
      { title: t('sidebar.actionPlans'), url: '/planos-acao', icon: MODULE_ICON['/planos-acao'], moduleName: 'planos-acao' },
      { title: t('sidebar.projects'), url: '/projetos', icon: MODULE_ICON['/projetos'], moduleName: 'projetos' },
    ],
  },
  {
    id: 'grc-core',
    label: t('sidebar.sectionGrcCore'),
    items: [
      { title: t('sidebar.riskManagement'), url: '/riscos', icon: MODULE_ICON['/riscos'], moduleName: 'riscos' },
      {
        title: t('sidebar.governance'),
        url: '/governanca', icon: MODULE_ICON['/governanca'],
        moduleName: 'controles',
      },
      { title: t('sidebar.gapAnalysis'), url: '/gap-analysis/frameworks', icon: MODULE_ICON['/gap-analysis'], moduleName: 'gap-analysis' },
      {
        title: t('sidebar.assetManagement'),
        icon: GestaoAtivosIcon,
        subItems: [
          { title: t('sidebar.assets'), url: '/ativos', icon: MODULE_ICON['/ativos'], moduleName: 'ativos' },
          { title: t('sidebar.licenses'), url: '/ativos/licencas', icon: MODULE_ICON['/ativos/licencas'], moduleName: 'ativos' },
          { title: t('sidebar.keys'), url: '/ativos/chaves', icon: MODULE_ICON['/ativos/chaves'], moduleName: 'ativos' },
        ],
      },
    ],
  },
  {
    id: 'compliance',
    label: t('sidebar.sectionCompliance'),
    items: [
      { title: t('sidebar.contracts'), url: '/contratos', icon: MODULE_ICON['/contratos'], moduleName: 'contratos' },
      { title: t('sidebar.documents'), url: '/documentos', icon: MODULE_ICON['/documentos'], moduleName: 'documentos' },
      { title: t('sidebar.privacy'), url: '/privacidade', icon: MODULE_ICON['/privacidade'], moduleName: 'dados' },
      {
        title: t('sidebar.accessManagement'),
        icon: GestaoAcessosIcon,
        subItems: [
          { title: t('sidebar.systems'), url: '/sistemas', icon: MODULE_ICON['/sistemas'], moduleName: 'controles' },
          { title: t('sidebar.privilegedAccounts'), url: '/contas-privilegiadas', icon: MODULE_ICON['/contas-privilegiadas'], moduleName: 'contas-privilegiadas' },
          { title: t('sidebar.accessReview'), url: '/revisao-acessos', icon: MODULE_ICON['/revisao-acessos'], moduleName: 'contas-privilegiadas' },
        ],
      },
      { title: t('sidebar.incidents'), url: '/incidentes', icon: MODULE_ICON['/incidentes'], moduleName: 'incidentes' },
      {
        title: t('experience.thirdPartiesEthics'),
        icon: ComplianceIcon,
        subItems: [
          { title: t('sidebar.dueDiligence'), url: '/due-diligence', icon: MODULE_ICON['/due-diligence'], moduleName: 'due-diligence' },
          { title: t('sidebar.whistleblowing'), url: '/denuncia', icon: MODULE_ICON['/denuncia'], moduleName: 'denuncia' },
        ],
      },
      { title: t('sidebar.businessContinuity'), url: '/continuidade', icon: MODULE_ICON['/continuidade'], moduleName: 'continuidade' },
    ],
  },
  {
    id: 'insights',
    label: t('sidebar.sectionInsights'),
    items: [
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
