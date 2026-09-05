/** Índice operacional por módulo. Barras representam o valor, não a conclusão do trabalho. */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { PanelAction } from '@/components/ui/panel-action';
import { AnimatedMetricValue } from '@/components/ui/stat-strip';
import { IconTarget, IconShield } from '@/components/icons';
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
    <section aria-labelledby="saude-grc">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2
          id="saude-grc"
          className="text-micro font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t('dashWidgets.radar.title')}
        </h2>

        {comDados.length > 0 && (
          /* Legenda binária: substitui a leitura de oito barras uma a uma. */
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-micro text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {t('dashWidgets.radar.prontos', { count: prontos })}
            </span>
            <span className="flex items-center gap-1.5 text-micro text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              {t('dashWidgets.radar.porFazer', { count: porFazer })}
            </span>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-bold leading-none tabular-nums text-foreground">
          {comDados.length ? <AnimatedMetricValue value={maturity.score} /> : '—'}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('dashWidgets.radar.maturitySuffix')}
          {/*
            A média é dos módulos QUE TÊM DADOS — um módulo vazio não é uma
            nota baixa, é uma pergunta por responder. Mas então o número não é
            a média dos oito cartões que estão à frente, e isso tem de ser
            dito: sem esta linha, "50 / 100" parece a média de tudo o que se
            vê, e não é.
          */}
          {maturity.modulesWithData < maturity.totalModules && (
            <>
              {' · '}
              {t('dashWidgets.radar.modulesWithData', {
                withData: maturity.modulesWithData,
                total: maturity.totalModules,
              })}
            </>
          )}
          {pior && (
            <>
              {' · '}
              {t('dashWidgets.radar.piorDominio', { nome: pior.nome })}
            </>
          )}
        </span>
      </div>

      {comDados.length === 0 ? (
        <div className="mt-3 flex h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20">
          <IconTarget className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          <p className="max-w-[240px] text-center text-xs text-muted-foreground">
            {t('dashWidgets.radar.empty')}
          </p>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {linhas.map((l) => {
            const pronto = l.score >= PRONTO;
            // `moduleIcon` não conhece /controles: ali o escudo é o glifo certo
            // e não colide com nenhum dos outros sete.
            const Glifo = moduleIcon(l.link) ?? IconShield;

            return (
              <li key={l.subject} className="flex">
                <article className="flex w-full min-w-0 flex-col rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => navigate(l.link)}
                    aria-label={l.nome}
                    className="group flex-1 rounded-t-lg px-3 pb-3 pt-3 text-left transition-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex items-center gap-2">
                      <Glifo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                      <span className="min-w-0 truncate text-xs font-medium text-foreground group-hover:text-accent-foreground">
                        {l.nome}
                      </span>
                      <span
                        className={cn(
                          'ml-auto text-base font-semibold tabular-nums',
                          !l.hasData
                            ? 'text-muted-foreground'
                            : pronto
                              ? 'text-foreground'
                              : 'text-warning',
                        )}
                      >
                        {/* Sem dados diz "sem dados" — a confusão que o radar
                            nunca conseguiu desfazer. */}
                        {l.hasData ? l.score : '—'}
                      </span>
                    </span>
                    {/* A largura acompanha o score exato, inclusive zero. */}
                    <span
                      className={cn(
                        'mt-2.5 block h-1.5 overflow-hidden rounded-full',
                        !l.hasData ? 'bg-muted' : pronto ? 'bg-success/15' : 'bg-warning/15',
                      )}
                    >
                      {l.hasData && (
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            pronto ? 'bg-success' : 'bg-warning',
                          )}
                          style={{ width: `${Math.max(0, Math.min(100, l.score))}%` }}
                        />
                      )}
                    </span>

                    <span className="mt-2 block min-h-8 text-xs leading-relaxed text-muted-foreground">
                      {l.hasData
                        ? l.metrics.filter(Boolean).slice(0, 2).join(' · ')
                        : t('dashWidgets.radar.statusNoData')}
                    </span>
                  </button>

                  <PanelAction
                    onClick={() => navigate(l.link)}
                    className="px-3 py-2"
                  >
                    {!l.hasData
                      ? t('dashWidgets.radar.acoes.comecarAgora')
                      : l.acao
                      ? t(`dashWidgets.radar.acoes.${l.acao.chave}`, { count: l.acao.n })
                      : t('experience.reviewModule')}
                  </PanelAction>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
