/**
 * RiscoDetailDrawer — Sheet 540px (fullscreen mobile) com 4 abas: Visão · Tratamentos · Histórico · Controles.
 * Footer fixo com CTAs "Aceitar formalmente" e "Editar risco".
 */
import { useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlanosAcaoVinculados } from '@/components/riscos/PlanosAcaoVinculados';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  resolveNivelRiscoTone,
  resolveRiscoStatusTone,
} from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  initials,
  scoreFromPI,
  severityFromNivel,
  shortRiskId,
  slaFromRevisao,
  getSlaLabels,
  financialExposure,
  type Severity,
} from '@/components/riscos/risk-utils';
import { useEmpresaMoeda } from '@/hooks/useEmpresaMoeda';
import { tGlobal } from '@/lib/i18n-global';
import { useRiscoDetail } from '@/hooks/useRiscoDetail';
import {
  deriveRiscoStatus,
  isTratamentoConcluido,
  motivoBloqueioTratado,
  podeMarcarTratado,
  resumirTratamentos,
  STATUS_TRATADO,
} from '@/components/riscos/risk-status';
import { VincularRequisitoDialog } from '@/components/riscos/VincularRequisitoDialog';
import { ResidualSugeridoCard } from '@/components/riscos/ResidualSugeridoCard';
import { useRiscoRequisitos } from '@/hooks/useRiscoRequisitos';
import { useMatrizConfigEmpresa } from '@/hooks/useMatrizConfigEmpresa';
import { resolveConformityTone } from '@/lib/status-tone';
import { Link as RouterLink } from 'react-router-dom';
;
import { RiscoComentarios } from '@/components/riscos/RiscoComentarios';
import { ScoreRing, ScoreBlock, StatTile, HeaderMeta, SEV_VAR } from '@/components/riscos/RiscoVisuals';
import { RiscoPerfilCompleto } from '@/components/riscos/RiscoPerfilCompleto';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconChevron, IconEdit, IconClose, IconView, IconWarning, IconAdd, IconExternal, IconShieldCheck, IconShield, IconHistory, IconArrowRight, IconChevronLeft, IconMoney, IconLayers, IconTag, IconPerson, IconCalendarClock, IconTimer, IconChevronDown, IconMessage, IconExpand } from '@/components/icons';

interface Risco {
  id: string;
  nome: string;
  descricao?: string;
  status: string;
  nivel_risco_inicial: string;
  nivel_risco_residual?: string | null;
  probabilidade_inicial?: string;
  impacto_inicial?: string;
  probabilidade_residual?: string;
  impacto_residual?: string;
  impacto_financeiro?: number | null;
  causas?: string;
  consequencias?: string;
  controles_existentes?: string;
  mitigacao_snapshot?: unknown;
  aceito: boolean;
  justificativa_aceite?: string;
  responsavel_nome?: string | null;
  responsavel_foto?: string | null;
  categoria?: { nome: string; cor?: string } | null;
  data_proxima_revisao?: string;
  created_at: string;
}

interface Props {
  risco: Risco | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (r: Risco) => void;
  onAccept: (r: Risco) => void;
  onOpenTratamentos: (r: Risco) => void;
  /** Navegação entre riscos (‹ N de M ›) sem fechar o drawer. */
  nav?: { current: number; total: number; onPrev?: () => void; onNext?: () => void };
}

const getStatusOptions = () => [
  { value: 'identificado', label: tGlobal('campos.enums.riscoStatus.identificado') },
  { value: 'analisado', label: tGlobal('campos.enums.riscoStatus.analisado') },
  { value: 'em_tratamento', label: tGlobal('sweepRiscos.riscos.detail.emTratamento') },
  { value: 'tratado', label: tGlobal('campos.enums.riscoStatus.tratado') },
  { value: 'monitorado', label: tGlobal('campos.enums.riscoStatus.monitorado') },
  { value: 'aceito', label: tGlobal('sweepRiscos.riscos.detail.aceito') },
];

export function TratadoBlockedOption({ motivo, onActivate }: { motivo: string; onActivate: () => void }) {
  const { t } = useLanguage();
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        onActivate();
      }}
      aria-label={t("sweepRiscos.riscos.tratadoIndisponivelAria", { motivo })}
      className="flex-col items-start gap-0.5 text-muted-foreground"
    >
      <span>{t('fin.riscos.tratadoIndisponivel')}</span>
      <span className="text-micro leading-tight">{motivo}</span>
    </DropdownMenuItem>
  );
}

export function RiscoDetailDrawer({ risco, open, onOpenChange, onEdit, onAccept, onOpenTratamentos, nav }: Props) {
  const { t } = useLanguage();
  const { format: formatMoedaEmpresa } = useEmpresaMoeda();
  const { data: detail, isLoading, isError, error: detailError } = useRiscoDetail(risco?.id ?? null);
  // Controlos reais = requisitos dos frameworks do Gap Analysis vinculados a este risco.
  const { data: requisitos = [], isLoading: reqLoading, isError: reqError } = useRiscoRequisitos(risco?.id ?? null);
  const { data: matrizConfig } = useMatrizConfigEmpresa();
  const [vincularOpen, setVincularOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusSaving, setStatusSaving] = useState(false);

  const handleStatusChange = async (novoStatus: string) => {
    if (!risco || novoStatus === risco.status) return;

    // AKURIS QA-065: "Tratado" exige ao menos um tratamento e todos concluídos.
    // Bloqueia ANTES do UPDATE — nada é gravado quando a regra não é atendida.
    if (novoStatus === STATUS_TRATADO) {
      const resumo = resumirTratamentos(detail?.tratamentos);
      if (!podeMarcarTratado(resumo)) {
        toast({
          title: t('fin.riscos.statusNaoPermitido'),
          description: motivoBloqueioTratado(resumo),
          variant: 'destructive',
        });
        return;
      }
    }

    setStatusSaving(true);
    try {
      const { error } = await supabase.from('riscos').update({ status: novoStatus }).eq('id', risco.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['riscos'] });
      queryClient.invalidateQueries({ queryKey: ['riscos-stats'] });
      toast({ title: 'Status atualizado', description: `Agora: ${formatStatus(novoStatus)}` });
    } catch (e: any) {
      toast({ title: t('fin.comum.erro'), description: e.message, variant: 'destructive' });
    } finally {
      setStatusSaving(false);
    }
  };

  const inicialScore = useMemo(
    () => scoreFromPI(risco?.probabilidade_inicial, risco?.impacto_inicial),
    [risco],
  );
  const residualScore = useMemo(
    () => scoreFromPI(risco?.probabilidade_residual, risco?.impacto_residual),
    [risco],
  );

  if (!risco) return null;

  const sla = slaFromRevisao(risco.data_proxima_revisao);
  const tratStats = (() => {
    const t = detail?.tratamentos || [];
    const total = t.length;
    const concluidos = t.filter((x) => isTratamentoConcluido(x.status)).length;
    const andamento = t.filter((x) => x.status === 'em andamento').length;
    const pendentes = t.filter((x) => x.status === 'pendente').length;
    return { total, concluidos, andamento, pendentes };
  })();
  // AKURIS QA-065 — status coerente com os tratamentos, só para exibição.
  // Durante o carregamento mantém o valor gravado para não "piscar" o badge.
  const detailUnavailable = isLoading || isError;
  const statusCoerente = detailUnavailable
    ? { status: risco.status, ajustado: false, motivo: null as string | null }
    : deriveRiscoStatus(risco.status, detail?.tratamentos ?? []);
  const tratadoBloqueado = !detailUnavailable && !podeMarcarTratado(detail?.tratamentos ?? []);
  const sevAtual = severityFromNivel(risco.nivel_risco_residual || risco.nivel_risco_inicial);
  const scoreAtual = residualScore || inicialScore;
  const exposicao = financialExposure(
    risco.impacto_financeiro,
    risco.probabilidade_residual ?? risco.probabilidade_inicial,
  );
  const reduziu = residualScore > 0 && inicialScore > 0 && residualScore < inicialScore;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[540px] p-0 flex flex-col gap-0 [&>button.absolute]:hidden"
      >
        {/* Header (hero) */}
        <SheetHeader className="px-6 pt-5 pb-5 border-b border-border space-y-4 relative overflow-hidden">
          {/* Faixa de severidade no topo */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: SEV_VAR[sevAtual] }} />
          {/* Brilho sutil de severidade */}
          <div
            aria-hidden
            className="absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-[0.10] pointer-events-none"
            style={{ background: SEV_VAR[sevAtual] }}
          />

          {/* Barra de ações */}
          <div className="flex items-center justify-between gap-3 relative">
            <span className="text-micro font-mono tracking-wider text-muted-foreground">
              {shortRiskId(risco.id, (risco as any).codigo)}
            </span>
            <div className="flex items-center gap-1">
              {nav && (
                <div className="flex items-center gap-0.5 mr-1 text-micro text-muted-foreground">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nav.onPrev} disabled={!nav.onPrev || nav.current <= 1} aria-label={t('cardsKpi.sweep.riscos.riscoAnterior')}>
                    <IconChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                  <span className="tabular-nums whitespace-nowrap">{nav.current}<span className="opacity-60"> de </span>{nav.total}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nav.onNext} disabled={!nav.onNext || nav.current >= nav.total} aria-label={t('fin.riscos.proximoRisco')}>
                    <IconChevron className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
              )}
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPerfilOpen(true)}>
                <IconExpand className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                Perfil
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(risco)}>
                <IconEdit className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                Editar
              </Button>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label={t('fin.comum.fechar')}>
                  <IconClose className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </SheetClose>
            </div>
          </div>

          {/* Título + anel de score */}
          <div className="flex items-start justify-between gap-4 relative">
            <div className="min-w-0 space-y-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusBadge {...resolveNivelRiscoTone(risco.nivel_risco_residual || risco.nivel_risco_inicial)}>
                  {formatStatus(risco.nivel_risco_residual || risco.nivel_risco_inicial)}
                </StatusBadge>
                {/* Status editável */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-0.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50" disabled={statusSaving || isError}>
                      <StatusBadge {...(isError ? { tone: 'neutral' as const } : resolveRiscoStatusTone(statusCoerente.status))}>
                        {statusSaving ? '…' : isError ? t('fin.riscos.statusIndisponivel') : formatStatus(statusCoerente.status)}
                        <IconChevronDown className="h-3 w-3 ml-0.5 -mr-0.5 opacity-70" strokeWidth={2} />
                      </StatusBadge>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {getStatusOptions().filter((opt) => !(opt.value === STATUS_TRATADO && tratadoBloqueado)).map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        className={opt.value === statusCoerente.status ? 'font-semibold' : ''}
                      >
                        {opt.label}
                        {opt.value === statusCoerente.status && <span className="ml-auto text-primary">✓</span>}
                      </DropdownMenuItem>
                    ))}
                    {tratadoBloqueado && (
                      <TratadoBlockedOption
                        motivo={motivoBloqueioTratado(resumirTratamentos(detail?.tratamentos))}
                        onActivate={() => handleStatusChange(STATUS_TRATADO)}
                      />
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {statusCoerente.ajustado && <span className="sr-only" role="status">{statusCoerente.motivo}</span>}
                {risco.aceito && (
                  <StatusBadge tone="info" variant="outline">{t('sweepRiscos.riscos.detail.aceito')}</StatusBadge>
                )}
              </div>
              <SheetTitle className="text-xl leading-tight font-semibold">{risco.nome}</SheetTitle>
            </div>
            <ScoreRing score={scoreAtual} sev={sevAtual} />
          </div>

          {/* Metadados em linhas com ícone */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 pt-1 relative">
            <HeaderMeta icon={<IconTag />} label={t('sweepRiscos.riscos.detail.categoria')} value={risco.categoria?.nome || '—'} />
            <HeaderMeta
              icon={<IconPerson />}
              label={t('residuos.risco.responsavel')}
              value={
                risco.responsavel_nome ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {risco.responsavel_foto && <AvatarImage src={risco.responsavel_foto} alt={risco.responsavel_nome} />}
                      <AvatarFallback className="text-micro bg-primary/10 text-primary">{initials(risco.responsavel_nome)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{risco.responsavel_nome}</span>
                  </span>
                ) : '—'
              }
            />
            <HeaderMeta icon={<IconCalendarClock />} label={t('fin.riscos.proxRevisao')} value={risco.data_proxima_revisao ? formatDateOnly(risco.data_proxima_revisao) : '—'} />
            <HeaderMeta
              icon={<IconTimer />}
              label="SLA"
              value={<StatusBadge {...(sla === 'vencido' ? { tone: 'destructive' as const } : sla === 'atencao' ? { tone: 'warning' as const } : sla === 'no_prazo' ? { tone: 'success' as const } : { tone: 'neutral' as const })}>{getSlaLabels()[sla]}</StatusBadge>}
            />
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="visao" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="visao" className="flex-1 text-micro px-2 gap-1.5 min-w-0 whitespace-nowrap"><IconView className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>{t('residuos.risco.visao')}</span></TabsTrigger>
              <TabsTrigger value="tratamentos" className="flex-1 text-micro px-2 gap-1.5 min-w-0 whitespace-nowrap"><IconShield className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>{t('cardsKpi.sweep.riscos.tratamento')}</span></TabsTrigger>
              <TabsTrigger value="historico" className="flex-1 text-micro px-2 gap-1.5 min-w-0 whitespace-nowrap"><IconHistory className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>{t('fin.comum.historico')}</span></TabsTrigger>
              <TabsTrigger value="controles" className="flex-1 text-micro px-2 gap-1.5 min-w-0 whitespace-nowrap"><IconShieldCheck className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>{t('cardsKpi.sweep.riscos.controles')}</span></TabsTrigger>
              <TabsTrigger value="comentarios" className="flex-1 text-micro px-2 gap-1.5 min-w-0 whitespace-nowrap"><IconMessage className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>{t('cardsKpi.sweep.riscos.comentAbbr')}</span></TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {/* Visão */}
            <TabsContent value="visao" className="m-0 space-y-5">
              {risco.descricao && (
                <section>
                  <SectionLabel>{t('campos.risco.descricaoSecao')}</SectionLabel>
                  <p className="text-sm text-foreground/85 leading-relaxed">{risco.descricao}</p>
                </section>
              )}

              {/* Movimento inerente → residual */}
              <section>
                <SectionLabel>{t('campos.risco.inerenteResidual')}</SectionLabel>
                <div className="flex items-stretch gap-2 mt-0.5">
                  <ScoreBlock label={t('sweepRiscos.riscos.detail.inerente')} nivel={risco.nivel_risco_residual || risco.nivel_risco_inicial} score={inicialScore} p={risco.probabilidade_inicial} i={risco.impacto_inicial} />
                  <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                    <IconArrowRight className={reduziu ? 'h-5 w-5 text-success' : 'h-5 w-5 text-muted-foreground'} strokeWidth={2} />
                    {reduziu && <span className="text-micro text-success font-semibold tabular-nums mt-0.5">−{inicialScore - residualScore}</span>}
                  </div>
                  <ScoreBlock label={t('sweepRiscos.riscos.detail.residual')} nivel={risco.nivel_risco_residual} score={residualScore} p={risco.probabilidade_residual} i={risco.impacto_residual} emptyLabel={t('fin.riscos.naoAvaliado')} />
                </div>
              </section>

              {/* Tiles de contexto */}
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StatTile icon={<IconMoney />} label={t('fin.riscos.exposicao')} value={exposicao !== null ? formatMoedaEmpresa(exposicao, true) : '—'} />
                <StatTile icon={<IconShield />} label={t('cardsKpi.sweep.riscos.tratamentos')} value={`${tratStats.concluidos}/${tratStats.total}`} />
                <StatTile icon={<IconLayers />} label={t('cardsKpi.sweep.riscos.controles')} value={String(requisitos.length)} />
              </section>

              {/* Exposição financeira + evolução do risco */}
              {(() => {
                const exp = financialExposure(
                  risco.impacto_financeiro,
                  risco.probabilidade_residual ?? risco.probabilidade_inicial,
                );
                const evo = [...(detail?.historico || [])]
                  .reverse()
                  .map((h) => scoreFromPI(h.probabilidade, h.impacto))
                  .filter((s) => s > 0);
                if (exp === null && evo.length < 2) return null;
                return (
                  <section className="grid grid-cols-2 gap-3">
                    {exp !== null && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <SectionLabel>{t('fin.riscos.exposicaoFinanceira')}</SectionLabel>
                        <div className="mt-1.5 text-lg font-semibold tabular-nums" title={formatMoedaEmpresa(exp)}>
                          {formatMoedaEmpresa(exp)}
                        </div>
                        <div className="text-micro text-muted-foreground mt-1">
                          impacto {formatMoedaEmpresa(risco.impacto_financeiro ?? null, true)} × probabilidade
                        </div>
                      </div>
                    )}
                    {evo.length >= 2 && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <SectionLabel>{t('fin.riscos.evolucao')}</SectionLabel>
                        <div className="mt-2">
                          <RiskSparkline scores={evo} />
                        </div>
                        <div className="text-micro text-muted-foreground mt-1">
                          {evo.length} avaliações · score {evo[0]} → {evo[evo.length - 1]}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })()}

              {(risco.causas || risco.consequencias) && (
                <section>
                  <SectionLabel>{t('fin.riscos.causasConsequencias')}</SectionLabel>
                  <div className="flex flex-col gap-1.5">
                    {splitLines(risco.causas).map((line, i) => (
                      <CauseChip key={`c-${i}`} kind="CAUSA" text={line} />
                    ))}
                    {splitLines(risco.consequencias).map((line, i) => (
                      <CauseChip key={`q-${i}`} kind="CONSEQ." text={line} />
                    ))}
                  </div>
                </section>
              )}
              {risco.controles_existentes && (
                <section>
                  <SectionLabel>{t('campos.risco.controlesExistentesSecao')}</SectionLabel>
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{risco.controles_existentes}</p>
                  <p className="text-micro text-muted-foreground mt-1.5">{t('riscosControles.aba.notaTexto')}</p>
                </section>
              )}
              {risco.aceito && (
                <section className="border border-warning/40 bg-warning/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                    <IconWarning className="h-3.5 w-3.5" strokeWidth={1.5} /> Risco aceito formalmente
                  </div>
                  {risco.justificativa_aceite && (
                    <p className="text-xs text-foreground/80 mt-1.5">{risco.justificativa_aceite}</p>
                  )}
                </section>
              )}
            </TabsContent>

            {/* Tratamentos */}
            <TabsContent value="tratamentos" className="m-0 space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
              ) : isError ? (
                <EmptyHint text={detailError instanceof Error ? detailError.message : t('fin.riscos.erroTratamentos')} />
              ) : detail?.tratamentos.length === 0 ? (
                <EmptyHint text={t('fin.riscos.semTratamentos')} />
              ) : (
                <>
                  {/* Progresso */}
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-muted-foreground">{tratStats.total} {tratStats.total === 1 ? 'tratamento' : 'tratamentos'}</span>
                      <span className="font-semibold">
                        {tratStats.concluidos} concluídos · {tratStats.andamento} em andamento · {tratStats.pendentes} pendentes
                      </span>
                    </div>
                    <div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-card border border-border">
                      {tratStats.concluidos > 0 && <div className="bg-success" style={{ flex: tratStats.concluidos }} />}
                      {tratStats.andamento > 0 && <div className="bg-primary" style={{ flex: tratStats.andamento }} />}
                      {tratStats.pendentes > 0 && <div className="bg-muted-foreground/40" style={{ flex: tratStats.pendentes }} />}
                    </div>
                  </div>
                  {detail!.tratamentos.map((t) => {
                    const pct = treatmentPct(t.status);
                    const barCls =
                      pct === 100 ? 'bg-success' : pct > 0 ? 'bg-primary' : 'bg-muted-foreground/30';
                    return (
                      <div key={t.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium leading-snug">{t.descricao}</div>
                          <StatusBadge {...resolveRiscoStatusTone(t.status)}>
                            {formatStatus(t.status)}
                          </StatusBadge>
                        </div>
                        <div className="h-1 bg-card rounded-full overflow-hidden border border-border">
                          <div className={`h-full ${barCls}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-micro text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Tipo: {formatStatus(t.tipo_tratamento)}</span>
                          {t.prazo && <span>Prazo: {formatDateOnly(t.prazo)}</span>}
                          {t.eficacia && <span>Eficácia: {t.eficacia}</span>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Planos de ação ligados por chave estrangeira a este risco */}
              <PlanosAcaoVinculados
                modulo="riscos"
                registroId={risco.id}
                registroTitulo={risco.nome}
                tituloLegado={risco.nome}
              />
            </TabsContent>

            {/* Histórico */}
            <TabsContent value="historico" className="m-0">
              {isLoading ? (
                <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
              ) : isError ? (
                <div className="py-10 text-center text-sm text-destructive">
                  {detailError instanceof Error ? detailError.message : t('fin.riscos.erroHistorico')}
                </div>
              ) : detail?.historico.length === 0 ? (
                <EmptyHint text={t('fin.riscos.semHistorico')} />
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-4 py-1">
                  {detail!.historico.map((h) => (
                    <li key={h.id} className="ml-4">
                      <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{formatStatus(h.tipo)}</span>
                        <span className="text-micro text-muted-foreground">{formatDateOnly(h.created_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        P {h.probabilidade} × I {h.impacto} ·{' '}
                        <StatusBadge {...resolveNivelRiscoTone(h.nivel_risco)}>
                          {formatStatus(h.nivel_risco)}
                        </StatusBadge>
                      </div>
                      {h.observacoes && (
                        <p className="text-xs text-foreground/80 mt-1.5">{h.observacoes}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            {/* Controles = requisitos dos frameworks activos vinculados ao risco */}
            <TabsContent value="controles" className="m-0 space-y-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t('riscosControles.aba.vinculados', { count: requisitos.length })}
                </span>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setVincularOpen(true)}>
                  <IconAdd className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                  {t('riscosControles.aba.vincular')}
                </Button>
              </div>

              {reqLoading ? (
                <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
              ) : reqError ? (
                <div className="py-10 text-center text-sm text-destructive">{t('fin.riscos.erroControles')}</div>
              ) : requisitos.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">{t('riscosControles.aba.vazio')}</p>
                  <Button variant="outline" size="sm" onClick={() => setVincularOpen(true)}>
                    <IconAdd className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    {t('riscosControles.aba.vincular')}
                  </Button>
                </div>
              ) : (
                <>
                  <ResidualSugeridoCard
                    riscoId={risco.id}
                    vinculados={requisitos}
                    probabilidadeInicial={risco.probabilidade_inicial}
                    impactoInicial={risco.impacto_inicial}
                    probabilidadeResidual={risco.probabilidade_residual}
                    impactoResidual={risco.impacto_residual}
                    snapshot={risco.mitigacao_snapshot}
                    aceito={risco.aceito}
                    config={matrizConfig}
                  />

                  {requisitos.map((r) => (
                    <div key={r.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.codigo && <span className="font-mono text-micro text-muted-foreground">{r.codigo}</span>}
                          <span className="text-sm font-medium leading-snug">{r.titulo}</span>
                        </div>
                        <div className="text-micro text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          <span>{r.framework_nome}</span>
                          {r.categoria && <span>{r.categoria}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusBadge {...resolveConformityTone(r.conformity_status)}>
                          {formatStatus(r.conformity_status)}
                        </StatusBadge>
                        <RouterLink
                          to={`/gap-analysis/framework/${r.framework_id}?q=${encodeURIComponent(r.codigo || r.titulo)}`}
                          className="text-micro text-primary inline-flex items-center gap-1 hover:underline"
                        >
                          {t('riscosControles.aba.abrirNoGap')}
                          <IconExternal className="h-3 w-3" strokeWidth={1.5} />
                        </RouterLink>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            {/* Comentários */}
            <TabsContent value="comentarios" className="m-0">
              <RiscoComentarios riscoId={risco.id} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer fixo */}
        <div className="border-t border-border px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card">
          <div className="text-micro text-muted-foreground min-w-0 leading-snug">
            {detail?.historico?.[0]
              ? <>{t('residuos.risco.ultimaRevisao')}<span className="text-foreground/85">{formatStatus(detail.historico[0].tipo)}</span> · {formatDateOnly(detail.historico[0].created_at)}</>
              : risco.responsavel_nome
              ? <>{t('residuos.risco.responsavelPrefixo')}<span className="text-foreground/85">{risco.responsavel_nome}</span></>
              : t('fin.riscos.semRevisoes')}
          </div>
          <div className="flex items-center gap-3 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={() => onAccept(risco)}>
              <IconShieldCheck className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
              Aceitar formalmente
            </Button>
            <Button size="sm" onClick={() => onOpenTratamentos(risco)}>
              <IconShield className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
              Novo tratamento
            </Button>
          </div>
        </div>

        <VincularRequisitoDialog
          open={vincularOpen}
          onOpenChange={setVincularOpen}
          riscoId={risco.id}
          riscoNome={risco.nome}
        />

        <RiscoPerfilCompleto
          risco={risco as any}
          open={perfilOpen}
          onOpenChange={setPerfilOpen}
          onEdit={(r) => { setPerfilOpen(false); onEdit(r as any); }}
          onAccept={(r) => { setPerfilOpen(false); onAccept(r as any); }}
          onOpenTratamentos={(r) => { setPerfilOpen(false); onOpenTratamentos(r as any); }}
        />
      </SheetContent>
    </Sheet>
  );
}

/** Mini-sparkline (SVG) da evolução do score do risco ao longo das avaliações. */
function RiskSparkline({ scores }: { scores: number[] }) {
  const w = 120;
  const h = 32;
  const max = Math.max(...scores, 1);
  const min = Math.min(...scores, 0);
  const range = max - min || 1;
  const step = scores.length > 1 ? w / (scores.length - 1) : w;
  const pts = scores.map((s, i) => {
    const x = i * step;
    const y = h - ((s - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = scores[scores.length - 1];
  const first = scores[0];
  // caiu (melhorou) = verde; subiu (piorou) = vermelho; estável = neutro
  const stroke = last < first ? 'hsl(var(--success))' : last > first ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(scores.length - 1) * step} cy={h - ((last - min) / range) * (h - 4) - 2} r={2.5} fill={stroke} />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-muted-foreground mb-1.5">
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function splitLines(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|;|•/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function CauseChip({ kind, text }: { kind: 'CAUSA' | 'CONSEQ.'; text: string }) {
  return (
    <div className="flex gap-2.5 px-3 py-2 bg-card rounded-md text-xs border border-border">
      <span className="text-xs font-semibold text-muted-foreground pt-0.5 min-w-[52px] flex-shrink-0">
        {kind}
      </span>
      <span className="text-foreground/85">{text}</span>
    </div>
  );
}

function treatmentPct(status: string): number {
  const s = (status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (s.includes('conclu')) return 100;
  if (s.includes('andamento') || s.includes('em_andamento') || s.includes('progress')) return 60;
  return 0;
}

function coberturaPct(eficacia?: string | null): number {
  if (!eficacia) return 0;
  const s = eficacia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Vocabul\u00e1rio alta/media/baixa gravado pelos dialogs de v\u00ednculo de controle
  if (s === 'alta') return 100;
  if (s === 'media') return 60;
  if (s === 'baixa') return 30;
  if (s.includes('eficaz') && !s.includes('parcial') && !s.includes('inef')) return 100;
  if (s.includes('parcial')) return 60;
  if (s.includes('implant') || s.includes('implement')) return 30;
  if (s.includes('inef')) return 10;
  return 0;
}

