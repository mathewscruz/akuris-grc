/** Índice operacional por módulo. Barras representam o valor, não a conclusão do trabalho. */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { PanelAction } from '@/components/ui/panel-action';
import { ExecutivePanel, ExecutiveBar, ScoreRing } from '@/components/ui/executive-summary';
import { IconArrowUpRight, IconShield } from '@/components/icons';
import { moduleIcon } from '@/lib/module-icons';
import { cn } from '@/lib/utils';
import { QueryError } from '@/components/ui/query-error';
import { useRadarChartData, type AcaoDoDominio } from '@/hooks/useRadarChartData';
import { useGrcMaturityScore } from '@/hooks/useGrcMaturityScore';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * O corte único.
 *
 * 60 é o mesmo limiar que `getStatus` já usava para separar "bom" de "atenção"
 * — não é um número novo, é o que ficou depois de as duas escalas convergirem.
 */
const PRONTO = 60;

interface Linha {
  subject: string;
  nome: string;
  score: number;
  hasData: boolean;
  metrics: string[];
  acao: AcaoDoDominio | null;
  link: string;
}

export function GrcHealthBreakdown() {
  const { data, isLoading, isError, refetch } = useRadarChartData();
  const maturity = useGrcMaturityScore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const linhas = useMemo<Linha[]>(() => {
    return (data ?? [])
      .map((d) => ({
        subject: d.subject,
        nome: t(`dashWidgets.radar.subjects.${d.subject}`) || d.subject,
        score: d.score,
        hasData: d.hasData,
        metrics: d.details.metrics,
        acao: d.acao,
        link: d.link,
      }))
      /*
        Pior primeiro, e quem não tem dados vai para o fim.

        Um domínio sem nada cadastrado não é "o pior" — é uma pergunta por
        responder. Misturá-lo com os que estão mesmo mal era o defeito do
        radar, e ordenar por score sem separar repeti-lo-ia.
      */
      .sort((a, b) => {
        if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
        return a.score - b.score;
      });
  }, [data, t]);

  const comDados = linhas.filter((l) => l.hasData);
  const pior = comDados[0];
  const prontos = comDados.filter((l) => l.score >= PRONTO).length;
  const porFazer = comDados.length - prontos;

  if (isError) return <QueryError onRetry={() => void refetch()} />;

  if (isLoading) {
    return (
      <section className="flex min-h-[220px] items-center justify-center rounded-lg border border-border bg-card">
        <AkurisPulse size={40} />
      </section>
    );
  }

  return (
    <section aria-labelledby="saude-grc" className="space-y-4">
      <ExecutivePanel>
        <div className="grid md:grid-cols-[minmax(260px,.85fr)_minmax(0,2fr)]">
          <div className="executive-tint flex flex-col justify-center gap-4 p-5">
            <div className="flex items-center gap-4">
              <ScoreRing value={comDados.length ? maturity.score : null} label={t('executive.operational')} className="h-24 w-24 sm:h-32 sm:w-32" />
              <div className="min-w-0">
                <p className="executive-label">{t('executive.operational')}</p>
                <p className="mt-1 text-sm font-medium">{maturity.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{t('executive.coverageModules', { count: maturity.modulesWithData, total: maturity.totalModules })}</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{t('executive.operationalHint')}</p>
            <p className="text-xs leading-5 text-muted-foreground">{t('calculationMethod.assets')}</p>
          </div>
          <div className="min-w-0 border-t border-border/60 p-5 md:border-l md:border-t-0">
            <p className="executive-label">{t('executive.overview')}</p>
            <h2 id="saude-grc" className="mt-2 text-xl font-semibold leading-snug tracking-tight">
              {!pior ? t('executive.noDataTitle') : porFazer > 0 ? t('executive.attentionTitle', { module: pior.nome }) : t('executive.stableTitle')}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {!pior ? t('dashWidgets.radar.empty') : porFazer > 0 ? t('executive.attentionSummary', { count: porFazer }) : t('executive.stableSummary')}
            </p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {linhas.slice(0, 3).map((l, index) => (
                <li key={l.subject}>
                  <button type="button" onClick={() => navigate(l.link)}
                    className="executive-row flex h-full w-full items-start gap-2 border-t border-border pt-3 text-left">
                    <span className="mt-0.5 text-xs font-semibold tabular-nums text-primary">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{l.nome}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {!l.hasData ? t('dashWidgets.radar.acoes.comecarAgora') : l.acao ? t(`dashWidgets.radar.acoes.${l.acao.chave}`, { count: l.acao.n }) : t('experience.reviewModule')}
                      </span>
                    </span>
                    <IconArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </ExecutivePanel>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{t('executive.moduleHeading')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('executive.moduleHint')}</p>
        </div>
        {comDados.length > 0 && <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" />{t('dashWidgets.radar.prontos', { count: prontos })}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" />{t('dashWidgets.radar.porFazer', { count: porFazer })}</span>
        </div>}
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {linhas.map(l => {
          const pronto = l.score >= PRONTO;
          const Glifo = moduleIcon(l.link) ?? IconShield;
          return <li key={l.subject} className="flex min-w-0">
            <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
              <button type="button" onClick={() => navigate(l.link)} aria-label={l.nome}
                className="executive-row group flex-1 p-4 text-left">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
                    <Glifo className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold">{l.nome}</span>
                </span>
                <span className="mb-2 mt-4 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{t('executive.moduleIndex')}</span>
                  <span className={cn('text-2xl font-semibold tabular-nums tracking-tight', l.hasData && !pronto ? 'text-warning' : 'text-foreground')}>
                    {l.hasData ? l.score : '—'}{l.hasData && <span className="ml-0.5 text-xs font-normal text-muted-foreground">/100</span>}
                  </span>
                </span>
                <ExecutiveBar value={l.hasData ? l.score : null} label={l.nome} className={pronto ? 'text-success' : 'text-warning'} />
                <span className="mt-3 block min-h-10 text-xs leading-5 text-muted-foreground">
                  {l.hasData ? l.metrics.filter(Boolean).slice(0, 2).join(' · ') : t('dashWidgets.radar.statusNoData')}
                </span>
              </button>
              <PanelAction onClick={() => navigate(l.link)} className="min-h-10 px-4 py-2">
                {!l.hasData ? t('dashWidgets.radar.acoes.comecarAgora') : l.acao ? t(`dashWidgets.radar.acoes.${l.acao.chave}`, { count: l.acao.n }) : t('experience.reviewModule')}
              </PanelAction>
            </article>
          </li>;
        })}
      </ul>
    </section>
  );
}
