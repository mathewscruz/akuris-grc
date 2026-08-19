import { useNavigate } from 'react-router-dom';
import { AtivosIcon, RiscosIcon, IncidentesIcon, DocumentosIcon, DueDiligenceIcon, DenunciasIcon, IconInfo, IconScale, IconChecklist } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';

export type KpiKey =
  | 'ativos'
  | 'riscos'
  | 'incidentes'
  | 'planos'
  | 'contratos'
  | 'documentos'
  | 'due_diligence'
  | 'denuncias';

interface KPIPillData {
  key: KpiKey;
  icon: React.ElementType;
  label: string;
  /** Explica exatamente o que o número conta (tooltip nativo). */
  hint?: string;
  value: number | string;
  route: string;
  color: string;
  alertBadge?: { label: string; variant: 'destructive' | 'warning' | 'success' | 'info' };
  onClick?: () => void;
}

interface KPIPillsProps {
  ativos: number;
  activeIncidents: number;
  incidentsThisMonth: number;
  activeContracts: number;
  contractsExpiring: number;
  contractsExpired: number;
  activeDocs: number;
  totalDocs: number;
  docsExpiring: number;
  docsPending: number;
  // Novos pills (acionáveis, não duplicam Hero)
  totalRiscos: number;
  riscosCriticos: number;
  riscosAltos: number;
  planosPendentes: number;
  planosAtrasados: number;
  ddAtivos: number;
  ddExpirados: number;
  denunciasAbertas: number;
  denunciasNovas: number;
  /** Quando definido, intercepta clique para drill-down em Drawer ao invés de navegar. */
  onPillClick?: (key: KpiKey) => void;
}

export function KPIPills(props: KPIPillsProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const pills: KPIPillData[] = [
    {
      key: 'ativos',
      icon: AtivosIcon,
      label: t('kpi.assets'),
      hint: t('kpi.hint.assets'),
      value: props.ativos,
      route: '/ativos',
      color: 'text-primary',
    },
    {
      key: 'riscos',
      icon: RiscosIcon,
      label: t('kpi.risks'),
      hint: t('kpi.hint.risks'),
      value: props.totalRiscos,
      route: '/riscos',
      color: props.riscosCriticos > 0 ? 'text-destructive' : 'text-primary',
      alertBadge:
        props.riscosCriticos > 0
          ? { label: `${props.riscosCriticos} ${t('kpi.critical')}`, variant: 'destructive' as const }
          : props.riscosAltos > 0
            ? { label: `${props.riscosAltos} ${t('kpi.high')}`, variant: 'warning' as const }
            : undefined,
    },
    {
      key: 'incidentes',
      icon: IconInfo,
      label: t('kpi.incidentsOpen'),
      hint: t('kpi.hint.incidentsOpen'),
      value: props.activeIncidents,
      route: '/incidentes',
      color: props.activeIncidents > 0 ? 'text-destructive' : 'text-muted-foreground',
      alertBadge:
        props.incidentsThisMonth > 0
          ? { label: `+${props.incidentsThisMonth} ${t('kpi.month')}`, variant: 'info' as const }
          : undefined,
    },
    {
      key: 'planos',
      icon: IconChecklist,
      label: t('kpi.actionPlansOpen'),
      hint: t('kpi.hint.actionPlansOpen'),
      value: props.planosPendentes,
      route: '/planos-acao',
      color: props.planosAtrasados > 0 ? 'text-destructive' : 'text-primary',
      alertBadge:
        props.planosAtrasados > 0
          ? { label: `${props.planosAtrasados} ${t('kpi.overdue')}`, variant: 'destructive' as const }
          : undefined,
    },
    {
      key: 'contratos',
      icon: IconScale,
      label: t('kpi.contractsActive'),
      hint: t('kpi.hint.contractsActive'),
      value: props.activeContracts,
      route: '/contratos',
      color: 'text-primary',
      alertBadge:
        props.contractsExpired > 0
          ? { label: `${props.contractsExpired} ${t('kpi.expired')}`, variant: 'destructive' as const }
          : props.contractsExpiring > 0
            ? { label: `${props.contractsExpiring} ${t('kpi.expiring')}`, variant: 'warning' as const }
            : undefined,
    },
    {
      key: 'documentos',
      icon: DocumentosIcon,
      label: t('kpi.documents'),
      hint: t('kpi.hint.documents', { active: props.activeDocs }),
      value: props.totalDocs,
      route: '/documentos',
      color: 'text-primary',
      alertBadge:
        props.docsExpiring > 0
          ? { label: `${props.docsExpiring} ${t('kpi.expiring')}`, variant: 'warning' as const }
          : props.docsPending > 0
            ? { label: `${props.docsPending} ${t('kpi.pending')}`, variant: 'info' as const }
            : undefined,
    },
    {
      key: 'due_diligence',
      icon: DueDiligenceIcon,
      label: t('kpi.dueDiligenceActive'),
      hint: t('kpi.hint.dueDiligenceActive'),
      value: props.ddAtivos,
      route: '/due-diligence',
      color: props.ddExpirados > 0 ? 'text-destructive' : 'text-primary',
      alertBadge:
        props.ddExpirados > 0
          ? { label: `${props.ddExpirados} ${t('kpi.expired')}`, variant: 'destructive' as const }
          : undefined,
    },
    {
      key: 'denuncias',
      icon: DenunciasIcon,
      label: t('kpi.reportsOpen'),
      hint: t('kpi.hint.reportsOpen'),
      value: props.denunciasAbertas,
      route: '/denuncia',
      color: props.denunciasNovas > 0 ? 'text-warning' : 'text-primary',
      alertBadge:
        props.denunciasNovas > 0
          ? { label: `${props.denunciasNovas} ${t('kpi.new')}`, variant: 'warning' as const }
          : undefined,
    },
  ];

  return (
    <div className="relative">
      {/* Fade indicator for scroll */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none sm:hidden" />
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:scrollbar-thin">
        {pills.map((pill) => (
          <button
            key={pill.key}
            /* O aviso ("2 críticos", "4 atrasados") saiu do corpo da pílula:
               com oito pílulas em fila, oito crachás coloridos competiam entre
               si e com o número, que é o que a pílula existe para mostrar. A
               informação não se perde — vem no tooltip, junto com a dica. */
            title={[pill.hint, pill.alertBadge?.label].filter(Boolean).join(' · ')}
            onClick={() => (props.onPillClick ? props.onPillClick(pill.key) : pill.onClick ? pill.onClick() : navigate(pill.route))}
            className="group flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-ui duration-200 cursor-pointer flex-shrink-0"
          >
            <pill.icon className={`h-4 w-4 shrink-0 ${pill.color}`} />
            {/* Um só corpo de letra na pílula. O número estava a `text-sm` e o
                rótulo a `text-micro`, e a diferença de dois degraus fazia a
                fila de pílulas parecer desalinhada. A hierarquia fica no peso
                e na cor, que chegam para separar o número do rótulo. */}
            <span className="text-micro font-bold tabular-nums text-foreground">{pill.value}</span>
            <span className="text-micro text-muted-foreground whitespace-nowrap">{pill.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
