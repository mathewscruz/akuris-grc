import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/ui/status-badge';
import { GapAnalysisIcon } from '@/components/icons';
import { ChevronRight, CheckCircle2, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFrameworksOverview, type FrameworkOverview } from '@/hooks/useFrameworksOverview';
import { useLanguage } from '@/contexts/LanguageContext';

const MAX_VISIBLE = 4;

const statusToTone = (s: FrameworkOverview['status']) => {
  if (s === 'concluido') return { tone: 'success' as const, label: 'Concluído' };
  if (s === 'em_andamento') return { tone: 'info' as const, label: 'Em andamento' };
  return { tone: 'neutral' as const, label: 'Não iniciado' };
};

const barColor = (pct: number) => {
  if (pct >= 80) return 'bg-success';
  if (pct >= 60) return 'bg-primary';
  if (pct >= 40) return 'bg-warning';
  return 'bg-destructive/70';
};

const FrameworkRow = ({
  item,
  onClick,
}: {
  item: FrameworkOverview;
  onClick: () => void;
}) => {
  const st = statusToTone(item.status);
  const pct = item.mediaConformidade;
  const progress =
    item.totalRequisitos > 0
      ? Math.round((item.requisitosAvaliados / item.totalRequisitos) * 100)
      : 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="group flex items-center gap-3 w-full px-2 py-2.5 rounded-md hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex-shrink-0 h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center group-hover:bg-muted transition-colors">
            <GapAnalysisIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-medium text-foreground/90 truncate tracking-tight">
                {item.nome}
                {item.versao && (
                  <span className="text-muted-foreground/70 font-normal ml-1">
                    {item.versao}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">
                {pct}%
              </span>
            </div>
            <div className="w-full h-1 bg-muted/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(pct)}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-2">
              <span className="text-[10px] text-muted-foreground">
                {item.status === 'concluido' ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                    Concluído · {item.totalRequisitos} req.
                  </span>
                ) : (
                  <>
                    {item.requisitosAvaliados}/{item.totalRequisitos} requisitos · {progress}% avaliado
                  </>
                )}
              </span>
              <StatusBadge tone={st.tone} className="text-[9px] py-0 h-4">
                {st.label}
              </StatusBadge>
            </div>
          </div>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[240px]">
        <p className="font-semibold text-sm mb-1">{item.nome}</p>
        <p className="text-xs text-muted-foreground">
          Conformidade média: <strong>{pct}%</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          {item.requisitosAvaliados} de {item.totalRequisitos} requisitos avaliados
        </p>
        {item.ultimaAtividade && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Última atividade:{' '}
            {new Date(item.ultimaAtividade).toLocaleDateString('pt-BR')}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export const FrameworksOverviewCard = () => {
  const { data, isLoading } = useFrameworksOverview();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const ativos = (data || []).filter((d) => d.status === 'em_andamento').length;
  const concluidos = (data || []).filter((d) => d.status === 'concluido').length;
  const visible = (data || []).slice(0, MAX_VISIBLE);
  const remaining = (data?.length || 0) - visible.length;

  if (isLoading) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
        <CornerAccent />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" /> Frameworks de Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pt-0 flex items-center justify-center">
          <AkurisPulse size={40} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
      <CornerAccent />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" /> Frameworks de Compliance
            </CardTitle>
            {(ativos > 0 || concluidos > 0) && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {ativos} em andamento · {concluidos} concluído{concluidos === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/gap-analysis')}
            className="text-[11px] text-primary hover:underline shrink-0"
          >
            Ver todos
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0 pb-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
              <GapAnalysisIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1 max-w-[260px]">
              <p className="text-sm font-medium text-foreground">
                Nenhum framework iniciado
              </p>
              <p className="text-xs text-muted-foreground">
                Comece uma avaliação de Gap Analysis para acompanhar a conformidade aqui.
              </p>
              <button
                type="button"
                onClick={() => navigate('/gap-analysis')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Iniciar primeiro framework →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {visible.map((item) => (
              <FrameworkRow
                key={item.id}
                item={item}
                onClick={() => navigate(`/gap-analysis/${item.id}`)}
              />
            ))}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => navigate('/gap-analysis')}
                className="w-full text-[11px] text-muted-foreground hover:text-foreground py-2 text-center"
              >
                + {remaining} outro{remaining === 1 ? '' : 's'} framework{remaining === 1 ? '' : 's'} →
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
