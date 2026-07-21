import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CornerAccent } from '@/components/identity/CornerAccent';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Hexagon, CheckCircle2, AlertCircle, XCircle, Minus } from 'lucide-react';
import { useRadarChartData } from '@/hooks/useRadarChartData';
import { useGrcMaturityScore } from '@/hooks/useGrcMaturityScore';
import { useLanguage } from '@/contexts/LanguageContext';

// Rótulos curtos para os eixos não estourarem nas laterais do radar.
const SHORT_LABEL: Record<string, string> = {
  'Gap Analysis': 'Gap',
  'Due Diligence': 'Due Dil.',
  Documentos: 'Docs',
  Incidentes: 'Incid.',
  Denúncias: 'Denún.',
  Controles: 'Controles',
};

const STATUS_META = {
  excellent: { label: 'Excelente', variant: 'success' as const, icon: CheckCircle2 },
  good: { label: 'Bom', variant: 'default' as const, icon: CheckCircle2 },
  warning: { label: 'Atenção', variant: 'warning' as const, icon: AlertCircle },
  critical: { label: 'Crítico', variant: 'destructive' as const, icon: XCircle },
  no_data: { label: 'Sem dados', variant: 'outline' as const, icon: Minus },
};

interface RadarPoint {
  subject: string;
  full: string;
  score: number;
  hasData: boolean;
  metrics: string[];
}

const RadarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as RadarPoint;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-popover-foreground">{p.full}</span>
        <span className="text-sm font-bold tabular-nums text-primary">
          {p.hasData ? `${p.score}%` : '—'}
        </span>
      </div>
      {p.hasData && p.metrics?.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {p.metrics.map((m, i) => (
            <p key={i} className="text-xs text-muted-foreground">{m}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export function GrcHealthRadar() {
  const { data, isLoading } = useRadarChartData();
  const maturity = useGrcMaturityScore();
  const { t } = useLanguage();

  const chartData = useMemo<RadarPoint[]>(
    () =>
      (data ?? []).map((d) => ({
        subject: SHORT_LABEL[d.subject] ?? d.subject,
        full: d.subject,
        score: d.score,
        hasData: d.hasData,
        metrics: d.details.metrics,
      })),
    [data]
  );

  const hasAny = chartData.some((d) => d.hasData);
  const status = STATUS_META[maturity.status] ?? STATUS_META.no_data;
  const StatusIcon = status.icon;

  const Header = (
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-semibold flex items-center gap-2">
        <Hexagon className="h-4 w-4 text-muted-foreground" /> Saúde do GRC
      </CardTitle>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
          {maturity.score}
        </span>
        <span className="text-xs text-muted-foreground">/ 100 · maturidade</span>
        <Badge variant={status.variant} className="text-[10px] gap-1">
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
        {maturity.totalModules > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {maturity.modulesWithData}/{maturity.totalModules} módulos com dados
          </span>
        )}
      </div>
    </CardHeader>
  );

  if (isLoading) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
        <CornerAccent />
        {Header}
        <CardContent className="flex-1 pt-0 flex items-center justify-center min-h-[260px]">
          <AkurisPulse size={40} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
      <CornerAccent />
      {Header}
      <CardContent className="flex-1 flex flex-col min-h-0 pt-0 pb-3">
        {!hasAny ? (
          <div className="flex flex-col items-center justify-center h-[240px] gap-3 rounded-lg border border-dashed border-border bg-muted/20">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
              <Hexagon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-[240px]">
              {t('dashboard.noData') || 'Sem dados'} — cadastre itens nos módulos para ver a saúde do GRC.
            </p>
          </div>
        ) : (
          // Altura fixa evita o loop de crescimento do ResponsiveContainer do Recharts.
          <div className="relative w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} outerRadius="70%" margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
                <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.22}
                  dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                  isAnimationActive
                />
                <Tooltip content={<RadarTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GrcHealthRadar;
