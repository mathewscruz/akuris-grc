/**
 * GrcHealthBreakdown — os oito domínios do GRC, do pior para o melhor.
 *
 * Substituiu o radar, por três razões que continuam válidas e que estão
 * medidas: a forma do polígono dependia da ORDEM arbitrária dos eixos; não se
 * conseguia ler um valor sem passar o rato por cima de cada um dos oito; e
 * "zero" desenhava-se igual a "sem dados", que num painel de conformidade é o
 * oposto um do outro.
 *
 * O que muda agora, e porquê:
 *
 *  · **Uma escala de cor, com um corte só.** Havia duas escalas de progresso
 *    no mesmo ecrã que discordavam: quatro faixas no cartão de frameworks,
 *    três aqui. Um framework a 65% saía roxo e um domínio a 65% saía verde —
 *    mesmo número, cores opostas, a quinze pixels de distância. Passa a haver
 *    um corte binário: pronto ou precisa de trabalho. A legenda no topo diz
 *    quantos são de cada, o que dispensa ler oito barras uma a uma.
 *
 *  · **Cada domínio termina num verbo.** O score diz como está; não dizia o
 *    que fazer. O próximo passo vem de `acao`, calculado em `useRadarChartData`
 *    a partir dos mesmos números que já alimentavam as linhas de apoio.
 *
 *  · **O score de maturidade vive aqui.** Estava no gauge do banner E como
 *    título deste cartão — o mesmo 50 duas vezes, a 200px de distância. Fica
 *    onde é explicado: à frente dos oito domínios que o compõem.
 *
 * O ícone identifica o módulo e nada mais: um só cinzento, sem estado. Quem
 * carrega o alarme é o número.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { PanelAction } from '@/components/ui/panel-action';
import { IconTarget, IconShield } from '@/components/icons';
import { moduleIcon } from '@/lib/module-icons';
import { cn } from '@/lib/utils';
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
          {maturity.score}
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

                    {/*
                      Um domínio em dia mostra a barra CHEIA e verde.

                      Antes o verde-equivalente era uma barra roxa parada em
                      73% ou 93% — e uma barra por encher lê-se como trabalho
                      por fazer, mesmo quando o domínio está em dia. O valor
                      exacto continua ao lado, em número; a barra responde à
                      pergunta binária, que é a que a legenda do topo faz.
                    */}
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
                            pronto ? 'w-full bg-success' : 'bg-warning',
                          )}
                          style={pronto ? undefined : { width: `${Math.max(2, l.score)}%` }}
                        />
                      )}
                    </span>

                    <span className="mt-2 block truncate text-micro text-muted-foreground">
                      {l.hasData
                        ? l.metrics.filter(Boolean).slice(0, 2).join(' · ')
                        : t('dashWidgets.radar.statusNoData')}
                    </span>
                  </button>

                  <PanelAction
                    limpo={l.hasData && !l.acao}
                    onClick={() => navigate(l.link)}
                    className="px-3 py-2"
                  >
                    {!l.hasData
                      ? t('dashWidgets.radar.acoes.comecarAgora')
                      : l.acao
                      ? t(`dashWidgets.radar.acoes.${l.acao.chave}`, { count: l.acao.n })
                      : t('dashWidgets.radar.acoes.tudoEmDia')}
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
