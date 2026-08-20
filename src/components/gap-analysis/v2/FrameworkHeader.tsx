/**
* FrameworkHeader — o cabeçalho único da avaliação de um framework.
*
* Substitui `CertificationReadinessCard` + `ConformityCard`, que estavam
* empilhados e respondiam à mesma pergunta com os mesmos números. Medido antes
* da fusão: 556px de altura só nos dois cartões, "não conforme" escrito quatro
* vezes no mesmo painel e quatro botões formando dois pares que faziam
* exatamente a mesma coisa.
*
* Três colunas, cada uma com uma pergunta:
*
*   Aderência   — quanto do framework está de pé
*   Prontidão   — dá para ir à auditoria, e o que bloqueia
*   Marco       — até quando, e quanto falta
*
* A distribuição da coluna do meio **é o filtro**: clicar em "Não conforme 1"
* leva à tabela já filtrada. Era isso que o botão "Ver não conformidades"
* fazia, ocupando uma linha inteira para uma só das cinco situações.
*
* Nada aqui depende do nome do framework. O veredito fala de "auditoria de
* {framework}", que serve tanto para uma certificação ISO como para uma
* fiscalização LGPD ou uma atestação SOC 2 — o produto oferece os mesmos
* recursos seja qual for o framework escolhido.
*/
import { useMemo } from 'react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getMaturityLevel } from './MaturityScale';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconShieldCheck, IconShieldAlert, IconArrowUpRight } from '@/components/icons';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';

export type EstadoFiltravel =
  | 'conforme'
  | 'parcial'
  | 'nao_conforme'
  | 'nao_avaliado'
  | 'nao_aplicavel';

export interface MarcoDoFramework {
  rotulo: string;
  /** ISO `YYYY-MM-DD`. */
  dataAlvo: string;
  scoreAlvo: number;
}

interface Props {
  frameworkName: string;
  overallScore: number;
  totalRequirements: number;
  conforme: number;
  parcial: number;
  naoConforme: number;
  naoAplicavel: number;
  naoAvaliado: number;
  marco?: MarcoDoFramework | null;
  /** Filtra a tabela pelo estado e rola até ela. */
  onFiltrarPorEstado?: (estado: EstadoFiltravel) => void;
  /** Abre a aba de remediação. */
  onGoToRemediation?: () => void;
  /** Abre o diálogo de marco deste framework. */
  onAbrirMarco?: () => void;
}

type Veredito = 'incompleto' | 'nao_pronto' | 'quase' | 'pronto';

const ESTILO_VEREDITO: Record<
  Veredito,
  { Icon: typeof IconShieldCheck; cor: string; selo: string }
> = {
  incompleto: { Icon: IconShieldAlert, cor: 'text-info', selo: 'bg-info/10 text-info' },
  nao_pronto: { Icon: IconShieldAlert, cor: 'text-destructive', selo: 'bg-destructive/10 text-destructive' },
  quase: { Icon: IconShieldCheck, cor: 'text-warning', selo: 'bg-warning/10 text-warning' },
  pronto: { Icon: IconShieldCheck, cor: 'text-success', selo: 'bg-success/10 text-success' },
};

const DONUT = 116;
const TRACO = 13;
const RAIO = (DONUT - TRACO) / 2;
const PERIMETRO = 2 * Math.PI * RAIO;

function formatarData(iso: string) {
  try {
    // `parseDataLocal` porque `gap_analysis_marcos.data_alvo` é coluna `date`:
    // `new Date('2026-07-04')` é lido como meia-noite UTC e recua um dia em
    // qualquer fuso negativo. E `intlLocale()` porque o produto tem três
    // idiomas — estava fixo em pt-BR.
    return parseDataLocal(iso).toLocaleDateString(intlLocale(), {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

/**
 * Dias até a data; negativo quando o prazo já passou.
 *
 * A conta é entre DIAS de calendário, não entre instantes: subtrair `Date.now()`
 * fazia o mesmo prazo dar 1 ou 2 conforme a hora a que se abrisse o ecrã, e o
 * dia do vencimento aparecia como atrasado a partir do meio-dia.
 */
function diasAte(iso: string): number {
  const alvo = parseDataLocal(iso);
  const hoje = new Date();
  const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((meiaNoite(alvo) - meiaNoite(hoje)) / 86400000);
}

export function FrameworkHeader({
  frameworkName,
  overallScore,
  totalRequirements,
  conforme,
  parcial,
  naoConforme,
  naoAplicavel,
  naoAvaliado,
  marco,
  onFiltrarPorEstado,
  onGoToRemediation,
  onAbrirMarco,
}: Props) {
  const { t } = useLanguage();
  const score = Math.round(Number(overallScore) || 0);
  const maturidade = getMaturityLevel(score, t);

  const aplicaveis = Math.max(0, totalRequirements - naoAplicavel);
  const avaliados = conforme + parcial + naoConforme;
  const cobertura = aplicaveis > 0 ? Math.round((avaliados / aplicaveis) * 100) : 0;

  // O veredito só é confiável acima de 80% de cobertura: dizer "pronto" com
  // metade dos requisitos por avaliar é o tipo de otimismo que se descobre na
  // auditoria.
  let veredito: Veredito;
  if (cobertura < 80) veredito = 'incompleto';
  else if (naoConforme > 0) veredito = 'nao_pronto';
  else if (parcial > 0) veredito = 'quase';
  else veredito = 'pronto';

  const estilo = ESTILO_VEREDITO[veredito];

  const rotuloParcial = parcial === 1
    ? t('gapAnalysis.v2.certificationReadiness.partialPointSingular')
    : t('gapAnalysis.v2.certificationReadiness.partialPointPlural');

  const manchete: Record<Veredito, string> = {
    incompleto: t('gapAnalysis.v2.certificationReadiness.incompleteAssessment'),
    nao_pronto: t('gapAnalysis.v2.certificationReadiness.notReadyFor', { target: frameworkName }),
    quase: t('gapAnalysis.v2.certificationReadiness.almostReadyFor', { target: frameworkName }),
    pronto: t('gapAnalysis.v2.certificationReadiness.readyForAuditOf', { target: frameworkName }),
  };

  const selo: Record<Veredito, string> = {
    incompleto: t('gapAnalysis.v2.certificationReadiness.incompleteCoverage'),
    nao_pronto: t('gapAnalysis.v2.certificationReadiness.withBlockers'),
    quase: t('gapAnalysis.v2.certificationReadiness.almostThere'),
    pronto: t('gapAnalysis.v2.certificationReadiness.noBlockers'),
  };

  const extra = parcial > 0
    ? t('gapAnalysis.v2.certificationReadiness.detailNotReadyExtra', { count: parcial, label: rotuloParcial })
    : '';

  const detalhe: Record<Veredito, string> = {
    incompleto: t('gapAnalysis.v2.certificationReadiness.detailIncomplete', { pct: cobertura }),
    nao_pronto: t('gapAnalysis.v2.certificationReadiness.detailNotReady', {
      count: naoConforme,
      plural: naoConforme === 1 ? '' : 's',
      pluralEs: naoConforme === 1 ? '' : 'es',
      pluralM: naoConforme === 1 ? '' : 'm',
      extra,
    }),
    quase: t('gapAnalysis.v2.certificationReadiness.detailAlmost', { count: parcial, label: rotuloParcial }),
    pronto: t('gapAnalysis.v2.certificationReadiness.detailReady', { count: avaliados }),
  };

  const totalDonut = conforme + parcial + naoConforme + naoAplicavel || 1;
  const fatias = [
    { valor: conforme, cor: 'hsl(var(--success))' },
    { valor: parcial, cor: 'hsl(var(--warning))' },
    { valor: naoConforme, cor: 'hsl(var(--destructive))' },
    { valor: naoAplicavel, cor: 'hsl(var(--info))' },
  ];
  let acumulado = 0;
  const arcos = fatias.map((f) => {
    const comprimento = (f.valor / totalDonut) * PERIMETRO;
    const arco = { ...f, comprimento, deslocamento: acumulado };
    acumulado += comprimento;
    return arco;
  });

  const estados: Array<{ chave: EstadoFiltravel; ponto: string; rotulo: string; valor: number }> = [
    { chave: 'conforme', ponto: 'bg-success', rotulo: t('gapAnalysis.v2.conformityCard.compliant'), valor: conforme },
    { chave: 'parcial', ponto: 'bg-warning', rotulo: t('gapAnalysis.v2.conformityCard.partial'), valor: parcial },
    { chave: 'nao_conforme', ponto: 'bg-destructive', rotulo: t('gapAnalysis.v2.conformityCard.nonCompliant'), valor: naoConforme },
    { chave: 'nao_avaliado', ponto: 'bg-muted-foreground/50', rotulo: t('gapV2.header.naoAvaliado'), valor: naoAvaliado },
    { chave: 'nao_aplicavel', ponto: 'bg-info', rotulo: t('gapAnalysis.v2.conformityCard.na'), valor: naoAplicavel },
  ];

  const diasParaMarco = marco ? diasAte(marco.dataAlvo) : 0;

  /*
    Ritmo, não contagem regressiva.

    O convite do diálogo de marco diz "para acompanhar o ritmo" e o cabeçalho
    entregava "em 84 dias". Um número de dias não diz a ninguém o que fazer na
    segunda-feira de manhã; "4 requisitos por semana" diz, e permite avisar
    quando a data deixou de ser possível.

    Conta REQUISITOS, não pontos: é a unidade em que a pessoa trabalha. Falta o
    que não está conforme e está dentro do escopo — parciais contam, porque um
    parcial ainda dá trabalho até fechar.
  */
  const ritmo = useMemo(() => {
    if (!marco) return null;
    const faltam = parcial + naoConforme + naoAvaliado;
    if (faltam === 0) return { estado: 'concluido' as const, faltam, semanas: 0, porSemana: 0 };
    if (diasParaMarco < 0) return { estado: 'vencido' as const, faltam, semanas: 0, porSemana: 0 };
    // Uma semana é o mínimo: com três dias pela frente, "1 semana" é uma
    // aproximação honesta e evita dividir por zero.
    const semanas = Math.max(1, Math.ceil(diasParaMarco / 7));
    const porSemana = Math.ceil(faltam / semanas);
    // Acima de dez requisitos por semana o plano deixou de ser um plano.
    return {
      estado: porSemana > 10 ? ('insuficiente' as const) : ('possivel' as const),
      faltam,
      semanas,
      porSemana,
    };
  }, [marco, parcial, naoConforme, naoAvaliado, diasParaMarco]);

  return (
    <article className="relative overflow-hidden rounded-lg border border-border bg-card">
      <CornerAccent position="top-left" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr]">
        {/* Coluna 1 — Aderência */}
        <div className="p-6 flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: DONUT, height: DONUT }}>
            <svg width={DONUT} height={DONUT} viewBox={`0 0 ${DONUT} ${DONUT}`} aria-hidden>
              <circle cx={DONUT / 2} cy={DONUT / 2} r={RAIO} fill="none" stroke="hsl(var(--muted))" strokeWidth={TRACO} />
              {arcos.map((a, i) => (
                <circle
                  key={i}
                  cx={DONUT / 2}
                  cy={DONUT / 2}
                  r={RAIO}
                  fill="none"
                  stroke={a.cor}
                  strokeWidth={TRACO}
                  strokeDasharray={`${a.comprimento} ${PERIMETRO - a.comprimento}`}
                  strokeDashoffset={-a.deslocamento}
                  transform={`rotate(-90 ${DONUT / 2} ${DONUT / 2})`}
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground">
                {score}<span className="text-lg text-muted-foreground">%</span>
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">
              {t('gapAnalysis.v2.conformityCard.title')}
            </div>
            <div className="mt-1.5">
              <StatusBadge tone="info">
                {t('gapAnalysis.v2.conformityCard.level', { id: maturidade.id, label: maturidade.label })}
              </StatusBadge>
            </div>
            <div className="mt-2 text-sm text-muted-foreground tabular-nums">
              {t('gapV2.header.avaliadosDeAplicaveis', { avaliados, aplicaveis })}
            </div>
          </div>
        </div>

        {/* Coluna 2 — Prontidão */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60">
          <div className="flex items-center gap-2 flex-wrap">
            <estilo.Icon className={cn('h-4 w-4 shrink-0', estilo.cor)} strokeWidth={1.75} />
              <span className="text-xs text-muted-foreground">
              {t('gapV2.header.prontidao')}
            </span>
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', estilo.selo)}>
              {selo[veredito]}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-semibold text-foreground leading-snug">{manchete[veredito]}</h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{detalhe[veredito]}</p>

          {/* A legenda é o filtro. */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {estados.map((e) => (
              <button
                key={e.chave}
                type="button"
                onClick={() => onFiltrarPorEstado?.(e.chave)}
                disabled={!onFiltrarPorEstado || e.valor === 0}
                className="inline-flex items-center gap-1.5 text-sm rounded-md -mx-1 px-1 py-0.5 transition-colors enabled:hover:bg-accent disabled:cursor-default disabled:opacity-60"
              >
                <span className={cn('h-2 w-2 rounded-full shrink-0', e.ponto)} />
                <span className="text-muted-foreground">{e.rotulo}</span>
                <span className="font-semibold tabular-nums text-foreground">{e.valor}</span>
              </button>
            ))}
          </div>

          {onGoToRemediation && naoConforme > 0 && (
            <Button variant="outline" size="sm" onClick={onGoToRemediation} className="mt-4 gap-1.5">
              {t('gapAnalysis.v2.certificationReadiness.remediationPlan')}
              <IconArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Button>
          )}
        </div>

        {/* Coluna 3 — Marco */}
        <div className="p-6 border-t lg:border-t-0 lg:border-l border-border/60">
          <div className="text-xs text-muted-foreground">
            {t('gapV2.maturityHero.nextMilestone')}
          </div>
          {marco ? (
            <>
              <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">{marco.rotulo}</h3>
              <div className="mt-1 text-sm text-muted-foreground tabular-nums">
                {formatarData(marco.dataAlvo)} ·{' '}
                {diasParaMarco < 0 ? (
                  <span className="text-destructive">{t('gapV2.marco.atrasado')}</span>
                ) : (
                  t('gapV2.maturityHero.inDays', { days: diasParaMarco })
                )}
              </div>
              <div className="mt-4">
                <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${score}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${marco.scoreAlvo}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{score}%</span>
                  <span>{t('gapV2.maturityHero.target', { target: marco.scoreAlvo })}</span>
                  <span>100%</span>
                </div>
                <div className="mt-1.5 text-sm tabular-nums">
                  {score >= marco.scoreAlvo ? (
                    <span className="text-success">{t('gapV2.marco.metaAtingida')}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t('gapV2.marco.faltam', { pts: marco.scoreAlvo - score })}
                    </span>
                  )}
                </div>

                {/* O ritmo que a data-alvo exige, na unidade em que se trabalha. */}
                {ritmo && ritmo.estado !== 'concluido' && (
                  <p
                    className={cn(
                      'mt-2 text-xs leading-6',
                      ritmo.estado === 'possivel' ? 'text-muted-foreground' : 'text-destructive',
                    )}
                  >
                    {ritmo.estado === 'vencido'
                      ? t('gapV2.certificacao.prazoVencido', { faltam: ritmo.faltam })
                      : ritmo.estado === 'insuficiente'
                        ? t('gapV2.certificacao.ritmoInsuficiente', {
                            faltam: ritmo.faltam, semanas: ritmo.semanas, porSemana: ritmo.porSemana,
                          })
                        : t('gapV2.certificacao.ritmoNecessario', {
                            faltam: ritmo.faltam, semanas: ritmo.semanas, porSemana: ritmo.porSemana,
                          })}
                  </p>
                )}
              </div>
              {onAbrirMarco && (
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                  onClick={onAbrirMarco}
                >
                  {t('gapV2.marco.editar')}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t('gapV2.marco.semMarcoNoFramework')}
              </p>
              {onAbrirMarco && (
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                  onClick={onAbrirMarco}
                >
                  {t('gapV2.marco.definir')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
