import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { PanelAction } from '@/components/ui/panel-action';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/ui/status-badge';
import { GapAnalysisIcon, IconChevron } from '@/components/icons';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';
import { useNavigate } from 'react-router-dom';
import { useFrameworksOverview, type FrameworkOverview } from '@/hooks/useFrameworksOverview';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';

const MAX_VISIBLE = 4;

const statusToTone = (s: FrameworkOverview['status']) => {
  if (s === 'concluido') return { tone: 'success' as const, key: 'statusDone' };
  if (s === 'em_andamento') return { tone: 'info' as const, key: 'statusInProgress' };
  return { tone: 'neutral' as const, key: 'statusNotStarted' };
};

/**
 * Uma escala de progresso, com um corte só.
 *
 * Eram quatro faixas aqui e três em `GrcHealthBreakdown`, e as duas
 * discordavam: um framework a 65% saía roxo e um domínio a 65% saía verde —
 * mesmo número, cores opostas, no mesmo ecrã. O corte é 60, o mesmo que o
 * `getStatus` do produto já usava para separar "bom" de "atenção".
 */
const PRONTO = 60;
const barColor = (pct: number) => (pct >= PRONTO ? 'bg-primary' : 'bg-severity-high');
const trackColor = (pct: number) => (pct >= PRONTO ? 'bg-primary/15' : 'bg-severity-high/15');

const FrameworkRow = ({
  item,
  onClick,
}: {
  item: FrameworkOverview;
  onClick: () => void;
}) => {
  const { t } = useLanguage();
  const st = statusToTone(item.status);
  const pct = item.mediaConformidade;
  const porAvaliar = Math.max(item.totalRequisitos - item.requisitosAvaliados, 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="group flex items-center gap-3 w-full px-2 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
        >
          <FrameworkBadge name={item.nome} versao={item.versao} size="sm" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-medium text-foreground/90 truncate tracking-tight">
                {item.nome}
                {item.versao && (
                  <span className="text-muted-foreground font-normal ml-1">
                    {item.versao}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">
                {pct}%
              </span>
            </div>
            <div className={`w-full h-1 rounded-full overflow-hidden ${trackColor(pct)}`}>
              <div
                className={`h-full rounded-full transition-ui duration-700 ease-out ${barColor(pct)}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            {/*
              Legenda binária, como a da Saúde do GRC: avaliados e por avaliar,
              cada um com o seu ponto. Era "114/121 requisitos · 94% avaliado",
              três números para dizer duas coisas.

              O crachá de estado saiu de todas as linhas menos das concluídas.
              "Em andamento" estava em 100% delas — pintar o que nunca varia
              gasta a cor que faz falta à excepção.
            */}
            <div className="flex items-center justify-between mt-1.5 gap-2">
              <span className="flex items-center gap-3 text-micro text-muted-foreground min-w-0">
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${barColor(pct)}`} />
                  {t('dashWidgets.frameworks.avaliados', { count: item.requisitosAvaliados })}
                </span>
                {porAvaliar > 0 && (
                  <span className="inline-flex items-center gap-1.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/35 shrink-0" />
                    {t('dashWidgets.frameworks.porAvaliar', { count: porAvaliar })}
                  </span>
                )}
              </span>
              {item.status === 'concluido' && (
                <StatusBadge tone={st.tone}>
                  {t(`dashWidgets.frameworks.${st.key}`)}
                </StatusBadge>
              )}
            </div>
          </div>

          <IconChevron className="h-3.5 w-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors flex-shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[240px]">
        <p className="font-semibold text-sm mb-1">{item.nome}</p>
        <p className="text-xs text-muted-foreground">
          {t('dashWidgets.frameworks.avgCompliance')} <strong>{pct}%</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          {t('dashWidgets.frameworks.evaluatedOf', { done: item.requisitosAvaliados, total: item.totalRequisitos })}
        </p>
        {item.ultimaAtividade && (
          <p className="text-micro text-muted-foreground mt-1">
            {t('dashWidgets.frameworks.lastActivity')} {formatDateOnly(item.ultimaAtividade)}
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
  /* O que falta fazer no módulo inteiro, não só nos frameworks visíveis. */
  const porAvaliarTotal = (data || []).reduce(
    (s, d) => s + Math.max(d.totalRequisitos - d.requisitosAvaliados, 0),
    0,
  );

  if (isLoading) {
    return (
      <Card className="relative h-full w-full flex flex-col overflow-hidden min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {t('dashWidgets.frameworks.title')}
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
      <CardHeader className="pb-3">
        {/* O "Ver todos" do canto saiu: a acção do rodapé leva ao mesmo sítio,
            e dizer para onde vai com o número que o justifica. */}
        <CardTitle className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dashWidgets.frameworks.title')}
        </CardTitle>
        {(ativos > 0 || concluidos > 0) && (
          <p className="text-micro text-muted-foreground mt-1">
            {t('dashWidgets.frameworks.summary', { active: ativos, done: concluidos })}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1 pt-0 pb-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <GapAnalysisIcon className="h-5 w-5 text-muted-foreground" />
            <div className="text-center space-y-1 max-w-[260px]">
              <p className="text-sm font-medium text-foreground">
                {t('dashWidgets.frameworks.emptyTitle')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('dashWidgets.frameworks.emptyDescription')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/gap-analysis')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {t('dashWidgets.frameworks.startFirst')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {visible.map((item) => (
              <FrameworkRow
                key={item.id}
                item={item}
                onClick={() => navigate(`/gap-analysis/framework/${item.id}`)}
              />
            ))}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => navigate('/gap-analysis')}
                className="w-full text-micro text-muted-foreground hover:text-foreground py-2 text-center"
              >
                {t('dashWidgets.frameworks.more', { count: remaining })}
              </button>
            )}
          </div>
        )}
      </CardContent>

      {visible.length > 0 && (
        <PanelAction
          limpo={porAvaliarTotal === 0}
          onClick={() => navigate('/gap-analysis')}
        >
          {porAvaliarTotal === 0
            ? t('dashWidgets.radar.acoes.tudoEmDia')
            : t('dashWidgets.radar.acoes.requisitosPorAvaliar', { count: porAvaliarTotal })}
        </PanelAction>
      )}
    </Card>
  );
};
