import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { useRadarChartData, RadarDataPoint } from "@/hooks/useRadarChartData";
import { useGrcMaturityScore } from "@/hooks/useGrcMaturityScore";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, FileText, ChevronRight, Minus, BarChart3 } from 'lucide-react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import {
  RiscosIcon,
  ControlesIcon,
  AtivosIcon,
  IncidentesIcon,
  GapAnalysisIcon,
  DueDiligenceIcon,
  DocumentosIcon,
  DenunciasIcon,
} from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Mapeia as chaves do useRadarChartData para os ícones proprietários Akuris.
const iconMap: Record<string, React.ComponentType<any>> = {
  AlertTriangle: RiscosIcon,
  Shield: ControlesIcon,
  Monitor: AtivosIcon,
  Zap: IncidentesIcon,
  Target: GapAnalysisIcon,
  ClipboardCheck: DueDiligenceIcon,
  FileText: DocumentosIcon,
  MessageSquareWarning: DenunciasIcon,
};

// Paleta sóbria padronizada — variações do primary + destructive atenuado para crítico.
const getScoreColor = (score: number, hasData: boolean) => {
  if (!hasData) return 'bg-muted-foreground/20';
  if (score >= 80) return 'bg-primary';
  if (score >= 60) return 'bg-primary/70';
  if (score >= 40) return 'bg-primary/40';
  return 'bg-destructive/70';
};

const getScoreTextColor = (score: number, hasData: boolean) => {
  if (!hasData) return 'text-muted-foreground';
  if (score >= 40) return 'text-foreground';
  return 'text-destructive';
};

const MaturityRow = ({ item, navigate, t }: { item: RadarDataPoint; navigate: any; t: any }) => {
  const Icon = iconMap[item.icon] || FileText;
  const colorClass = getScoreColor(item.score, item.hasData);
  const textColor = getScoreTextColor(item.score, item.hasData);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => navigate(item.link)}
          className="group flex items-center gap-3 w-full px-2 py-2.5 rounded-md hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex-shrink-0 h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center group-hover:bg-muted transition-colors">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground/90 truncate tracking-tight">
                {item.subject}
              </span>
              {item.hasData ? (
                <span className={`text-xs font-semibold tabular-nums ${textColor}`}>
                  {item.score}%
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/70 font-normal">
                  {t('dashboard.noData') || 'Sem dados'}
                </span>
              )}
            </div>
            <div className="w-full h-1 bg-muted/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
                style={{ width: item.hasData ? `${Math.max(item.score, 2)}%` : '0%' }}
              />
            </div>
          </div>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[220px]">
        <p className="font-semibold text-sm mb-1">{item.subject}</p>
        <p className="text-xs text-muted-foreground mb-1.5">{item.details.total} registros</p>
        <div className="space-y-0.5">
          {item.details.metrics.map((m, i) => (
            <p key={i} className="text-xs flex items-center gap-1">
              <Minus className="h-2 w-2 text-primary" /> {m}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export const MultiDimensionalRadar = () => {
  const { data, isLoading } = useRadarChartData();
  const maturity = useGrcMaturityScore();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const statusConfig = useMemo(() => {
    if (maturity.status === 'excellent') return { label: t('dashboard.excellent'), variant: 'success' as const, icon: CheckCircle2, color: maturity.colorClass };
    if (maturity.status === 'good') return { label: t('dashboard.good'), variant: 'default' as const, icon: CheckCircle2, color: maturity.colorClass };
    if (maturity.status === 'warning') return { label: t('dashboard.warning'), variant: 'warning' as const, icon: AlertCircle, color: maturity.colorClass };
    if (maturity.status === 'critical') return { label: t('dashboard.criticalStatus'), variant: 'destructive' as const, icon: XCircle, color: maturity.colorClass };
    return { label: t('dashboard.noData') || 'Sem dados', variant: 'outline' as const, icon: Minus, color: maturity.colorClass };
  }, [maturity.status, maturity.colorClass, t]);

  if (isLoading) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
        <CornerAccent />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> {t('dashboard.maturity')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pt-0"><Skeleton className="h-full w-full" /></CardContent>
      </Card>
    );
  }

  const StatusIcon = statusConfig.icon;

  return (
    <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
      <CornerAccent />
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" /> {t('dashboard.maturity')}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
          <Badge variant={statusConfig.variant} className="text-[10px]">
            {statusConfig.label}
          </Badge>
          {maturity.totalModules > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {maturity.modulesWithData} de {maturity.totalModules} módulos com dados
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0 pb-4">
        <div className="space-y-0.5">
          {(data ?? []).map((item) => (
            <MaturityRow key={item.subject} item={item} navigate={navigate} t={t} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
