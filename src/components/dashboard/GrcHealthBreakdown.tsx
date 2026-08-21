/**
 * GrcHealthBreakdown — os oito domínios do GRC, do pior para o melhor.
 *
 * Substitui o radar. Os dados são os mesmos, de `useRadarChartData`; o que
 * muda é conseguir lê-los. Três razões, medidas no radar que estava no ar:
 *
 *  1. A forma não significava nada. A área do polígono depende da ORDEM dos
 *     eixos, que é arbitrária: trocar "Docs" com "Incid." mudava a silhueta
 *     inteira com os mesmos números. O olho lia a mancha como sinal, e não era.
 *
 *  2. Não se lia um valor. O eixo radial estava desligado
 *     (`tick={false} axisLine={false}`), por isso saber se Docs era 86 ou 95
 *     exigia passar o rato por cima de cada um dos oito, um a um. E os rótulos
 *     já vinham abreviados — "Denún.", "Incid.", "Due Dil." — porque oito
 *     eixos não cabem.
 *
 *  3. **Zero e "sem dados" desenhavam-se igual.** `hasData: false` produzia
 *     `score: 0`, um vértice colapsado no centro, no mesmo pixel de um domínio
 *     realmente a zero. "Não há incidentes registados" e "gestão de incidentes
 *     a 0%" são o oposto um do outro. Num painel de conformidade isso não pode
 *     acontecer, e é a razão principal desta troca.
 *
 * O caso concreto que decidiu: os valores reais eram Controles 95, Ativos 86,
 * Docs 86, Incidentes 53, Gap 51, Denúncias 26, Due Diligence 24 e **Riscos
 * 13**. O pior domínio, de longe, numa ferramenta cujo negócio é risco — e no
 * radar era um ponto pequeno perto do centro, enquanto o lóbulo grande à
 * direita (Controles e Ativos, os que estão bem) puxava o olho. O desenho
 * destacava o que funcionava e escondia o que estava partido.
 *
 * As linhas de apoio não são novas: `details.metrics` já era calculado e só
 * aparecia no tooltip.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { IconTarget, IconChevron } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useRadarChartData } from '@/hooks/useRadarChartData';
import { useGrcMaturityScore } from '@/hooks/useGrcMaturityScore';
import { useLanguage } from '@/contexts/LanguageContext';

interface Linha {
  subject: string;
  nome: string;
  score: number;
  hasData: boolean;
  metrics: string[];
  link: string;
}

/**
 * O tom vem do mesmo corte que o resto do produto usa (`getStatus` no hook):
 * <40 crítico, <60 atenção, o resto bom.
 */
function tomDo(score: number): { texto: string; barra: string; trilho: string } {
  if (score < 40) return { texto: 'text-destructive', barra: 'bg-destructive', trilho: 'bg-destructive/15' };
  if (score < 60) return { texto: 'text-warning', barra: 'bg-warning', trilho: 'bg-warning/15' };
  return { texto: 'text-success', barra: 'bg-success', trilho: 'bg-success/15' };
}

export function GrcHealthBreakdown() {
  const { data, isLoading } = useRadarChartData();
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

  const Header = (
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold flex items-center gap-2">
        {t('dashWidgets.radar.title')}
      </CardTitle>
      <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
        <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
          {maturity.score}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('dashWidgets.radar.maturitySuffix')}
          {pior && (
            <>
              {' · '}
              {t('dashWidgets.radar.piorDominio', { nome: pior.nome })}
            </>
          )}
        </span>
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
        {comDados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[240px] gap-3 rounded-lg border border-dashed border-border bg-muted/20">
            <IconTarget className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground text-center max-w-[240px]">
              {t('dashWidgets.radar.empty')}
            </p>
          </div>
        ) : (
          <ul>
            {linhas.map((l) => {
              const tom = tomDo(l.score);
              return (
                <li key={l.subject}>
                  <button
                    type="button"
                    onClick={() => navigate(l.link)}
                    className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border/60 py-2 text-left transition-ui hover:bg-accent"
                  >
                    <span className="min-w-0 truncate text-sm text-foreground group-hover:text-primary transition-colors">
                      {l.nome}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-sm font-medium tabular-nums',
                          l.hasData ? tom.texto : 'text-muted-foreground',
                        )}
                      >
                        {/*
                          Sem dados diz "sem dados". Era esta a confusão que o
                          radar não conseguia desfazer.
                        */}
                        {l.hasData ? l.score : '—'}
                      </span>
                      <IconChevron className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" strokeWidth={1.5} />
                    </span>

                    <span className="col-span-2 flex items-center gap-3">
                      <span
                        className={cn(
                          'h-1.5 flex-1 overflow-hidden rounded-full',
                          l.hasData ? tom.trilho : 'bg-muted',
                        )}
                      >
                        {l.hasData && (
                          <span
                            className={cn('block h-full rounded-full', tom.barra)}
                            style={{ width: `${Math.max(2, l.score)}%` }}
                          />
                        )}
                      </span>
                      <span className="shrink-0 truncate text-micro text-muted-foreground max-w-[52%]">
                        {l.hasData
                          ? l.metrics.filter(Boolean).slice(0, 2).join(' · ')
                          : t('dashWidgets.radar.statusNoData')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
