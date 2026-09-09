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
import { ExecutivePanel, ExecutiveBar, ScoreRing } from '@/components/ui/executive-summary';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getMaturityLevel } from './MaturityScale';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconShieldCheck, IconShieldAlert, IconArrowUpRight } from '@/components/icons';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
import { prontidaoDoFramework } from '@/lib/gap-prontidao';
import { fimDoPercurso } from '@/lib/gap-fases';

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
  /**
   * Conformes sem uma unica prova anexada. `null` quando nao se conseguiu
   * contar -- e ai nao se acusa ninguem.
   */
  conformesSemProva?: number | null;
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
  conformesSemProva = null,
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

  /*
    O veredito sai de `prontidaoDoFramework`, e nao de uma conta local.

    Duas coisas mudaram, e as duas eram buracos por onde passava um «pronto»
    falso:

     · «acima de 80% de cobertura» deixava dizer PRONTO com um quinto dos
       requisitos por avaliar. Vinte por cento de uma ISO sao 23 controlos que
       ninguem olhou -- e o auditor olha.
     · e nada olhava para a PROVA. Cento e dezassete conformes com zero
       ficheiros anexados liam «pronto para a auditoria», que e exactamente
       onde uma auditoria reprova: o auditor nao avalia o que a empresa
       afirma, avalia o que ela mostra.

    Agora pronto significa: nada por avaliar, nada nao conforme, nada parcial,
    e nada conforme sem prova. E a regra vive num sitio so, partilhada com a
    Declaracao de Aplicabilidade -- este modulo ja teve tres formulas paralelas
    de aderencia e uma guarda dedicada a impedir a quarta.
  */
  const prontidao = prontidaoDoFramework(
    {
      conforme, parcial, nao_conforme: naoConforme,
      nao_aplicavel: naoAplicavel, nao_avaliado: naoAvaliado,
      total: totalRequirements,
    },
    conformesSemProva,
  );

  let veredito: Veredito;
  if (prontidao.pronto) veredito = 'pronto';
  else if (cobertura < 80) veredito = 'incompleto';
  else if (naoConforme > 0) veredito = 'nao_pronto';
  else if (naoAvaliado > 0 || (conformesSemProva ?? 0) > 0) veredito = 'nao_pronto';
  else veredito = 'quase';

  const estilo = ESTILO_VEREDITO[veredito];

  const rotuloParcial = parcial === 1
    ? t('gapAnalysis.v2.certificationReadiness.partialPointSingular')
    : t('gapAnalysis.v2.certificationReadiness.partialPointPlural');

  const manchete: Record<Veredito, string> = {
    incompleto: t('gapAnalysis.v2.certificationReadiness.incompleteAssessment'),
    nao_pronto: t('gapAnalysis.v2.certificationReadiness.notReadyFor', { target: frameworkName }),
    quase: t('gapAnalysis.v2.certificationReadiness.almostReadyFor', { target: frameworkName }),
    /* «Pronto para a auditoria de LGPD» manda procurar uma coisa que nao
       existe: nao ha auditoria de certificacao de LGPD. O desfecho segue a
       familia -- certificado, relatorio, lei ou referencial. */
    pronto: t(`gapProntidao.pronto_${fimDoPercurso(frameworkName)}`),
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
    <ExecutivePanel aria-label={t('executive.frameworkSummary')}>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,.85fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(230px,.85fr)_minmax(0,1.4fr)_minmax(230px,.9fr)]">
        <div className="executive-tint flex flex-col justify-center gap-4 p-5">
          <div className="flex items-center gap-4">
            <ScoreRing value={avaliados > 0 ? score : null} label={t('gapAnalysis.v2.conformityCard.title')} suffix="%" />
            <div className="min-w-0">
              <p className="executive-label">{t('gapAnalysis.v2.conformityCard.title')}</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed">
                {aplicaveis === 0 ? t('calculationMethod.noApplicable') : avaliados > 0 ? `${t('calculationMethod.adherenceBand')} · ${maturidade.label}` : t('executive.notAssessed')}
              </p>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{t('executive.coverage')}</span>
              <span className="font-semibold tabular-nums">{aplicaveis > 0 ? `${cobertura}%` : '—'}</span>
            </div>
            <ExecutiveBar value={aplicaveis > 0 ? cobertura : null} label={t('executive.coverage')} />
            <p className="mt-2 text-xs text-muted-foreground">{t('gapV2.header.avaliadosDeAplicaveis', { avaliados, aplicaveis })}</p>
          </div>
        </div>
        <div className="min-w-0 border-t border-border/60 p-5 md:border-l md:border-t-0">
          <div className="flex items-center gap-2">
            <estilo.Icon className={cn('h-4 w-4 shrink-0', estilo.cor)} aria-hidden="true" />
            <p className="executive-label">{t('executive.overview')}</p>
            <span className={cn('ml-auto text-xs font-medium', estilo.cor)}>{selo[veredito]}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight">{manchete[veredito]}</h3>
          {prontidao.bloqueios.length > 0 ? (
            <ul aria-label={t('executive.blockers')} className="mt-4 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              {prontidao.bloqueios.map(b => (
                <li key={b.chave}>
                  <button type="button" disabled={!onFiltrarPorEstado}
                    onClick={() => onFiltrarPorEstado?.((b.chave === 'conforme_sem_prova' ? 'conforme' : b.chave) as EstadoFiltravel)}
                    className="executive-row flex min-h-11 w-full items-center gap-2 border-t border-border/60 py-2 text-left">
                    <span className="w-7 shrink-0 text-lg font-semibold tabular-nums">{b.quantos}</span>
                    <span className="flex-1 text-xs text-muted-foreground">{t(`executive.blocker.${b.chave}`)}</span>
                    <IconArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm leading-6 text-muted-foreground">{detalhe[veredito]}</p>}
          {conformesSemProva === null && conforme > 0 && <p className="mt-2 text-xs text-muted-foreground">{t('executive.unknownEvidence')}</p>}
          {onGoToRemediation && naoConforme > 0 && (
            <Button variant="link" size="sm" onClick={onGoToRemediation} className="mt-2 h-9 gap-1.5 px-0">
              {t('gapAnalysis.v2.certificationReadiness.remediationPlan')}<IconArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {/* Coluna 3 — Marco */}
        <div className="min-w-0 border-t border-border/60 p-5 xl:border-l xl:border-t-0">
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
                  className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline max-lg:min-h-[36px]"
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
                  className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline max-lg:min-h-[36px]"
                  onClick={onAbrirMarco}
                >
                  {t('gapV2.marco.definir')}
                </button>
              )}
            </>
          )}
        </div>

      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-5 py-2">
        {estados.map(e => (
          <button key={e.chave} type="button" onClick={() => onFiltrarPorEstado?.(e.chave)}
            disabled={!onFiltrarPorEstado || e.valor === 0}
            className="executive-row inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-xs disabled:opacity-60">
            <span className={cn('h-1.5 w-1.5 rounded-full', e.ponto)} aria-hidden="true" />
            <span className="text-muted-foreground">{e.rotulo}</span><span className="font-semibold tabular-nums">{e.valor}</span>
          </button>
        ))}
      </div>
      <p className="border-t border-border/60 px-5 py-2 text-xs leading-5 text-muted-foreground">{t('gapProntidao.ressalva')}</p>
    </ExecutivePanel>
  );
}
