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
import { Edit, ShieldCheck, Clock, AlertTriangle, Shield, History, Eye, X, Plus, ArrowRight, ChevronLeft, ChevronRight, Wallet, Layers, Tag, User, CalendarClock, Timer, ChevronDown } from 'lucide-react';
import {
  initials,
  scoreFromPI,
  severityFromNivel,
  shortRiskId,
  slaFromRevisao,
  SLA_LABELS,
  financialExposure,
  formatBRL,
  type Severity,
} from '@/components/riscos/risk-utils';
import { useRiscoDetail } from '@/hooks/useRiscoDetail';
import { VincularControleDialog } from '@/components/riscos/VincularControleDialog';

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

const STATUS_OPTIONS = [
  { value: 'identificado', label: 'Identificado' },
  { value: 'analisado', label: 'Analisado' },
  { value: 'em_tratamento', label: 'Em Tratamento' },
  { value: 'tratado', label: 'Tratado' },
  { value: 'monitorado', label: 'Monitorado' },
  { value: 'aceito', label: 'Aceito' },
];

export function RiscoDetailDrawer({ risco, open, onOpenChange, onEdit, onAccept, onOpenTratamentos, nav }: Props) {
  const { data: detail, isLoading } = useRiscoDetail(risco?.id ?? null);
  const [vincularOpen, setVincularOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusSaving, setStatusSaving] = useState(false);

  const handleStatusChange = async (novoStatus: string) => {
    if (!risco || novoStatus === risco.status) return;
    setStatusSaving(true);
    try {
      const { error } = await supabase.from('riscos').update({ status: novoStatus }).eq('id', risco.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['riscos'] });
      queryClient.invalidateQueries({ queryKey: ['riscos-stats'] });
      toast({ title: 'Status atualizado', description: `Agora: ${formatStatus(novoStatus)}` });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
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
    const concluidos = t.filter((x) => x.status === 'concluído').length;
    const andamento = t.filter((x) => x.status === 'em andamento').length;
    const pendentes = t.filter((x) => x.status === 'pendente').length;
    return { total, concluidos, andamento, pendentes };
  })();
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
            <span className="text-[10.5px] font-mono tracking-wider text-muted-foreground">
              {shortRiskId(risco.id)}
            </span>
            <div className="flex items-center gap-1">
              {nav && (
                <div className="flex items-center gap-0.5 mr-1 text-[11px] text-muted-foreground">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nav.onPrev} disabled={!nav.onPrev || nav.current <= 1} aria-label="Risco anterior">
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                  <span className="tabular-nums whitespace-nowrap">{nav.current}<span className="opacity-60"> de </span>{nav.total}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nav.onNext} disabled={!nav.onNext || nav.current >= nav.total} aria-label="Próximo risco">
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
              )}
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(risco)}>
                <Edit className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                Editar
              </Button>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="Fechar">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </SheetClose>
            </div>
          </div>

          {/* Título + anel de score */}
          <div className="flex items-start justify-between gap-4 relative">
            <div className="min-w-0 space-y-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusBadge size="sm" {...resolveNivelRiscoTone(risco.nivel_risco_residual || risco.nivel_risco_inicial)}>
                  {formatStatus(risco.nivel_risco_residual || risco.nivel_risco_inicial)}
                </StatusBadge>
                {/* Status editável */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-0.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50" disabled={statusSaving}>
                      <StatusBadge size="sm" {...resolveRiscoStatusTone(risco.status)}>
                        {statusSaving ? '…' : formatStatus(risco.status)}
                        <ChevronDown className="h-3 w-3 ml-0.5 -mr-0.5 opacity-70" strokeWidth={2} />
                      </StatusBadge>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuItem key={opt.value} onClick={() => handleStatusChange(opt.value)} className={opt.value === risco.status ? 'font-semibold' : ''}>
                        {opt.label}
                        {opt.value === risco.status && <span className="ml-auto text-primary">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {risco.aceito && (
                  <StatusBadge size="sm" tone="info" variant="outline">Aceito</StatusBadge>
                )}
              </div>
              <SheetTitle className="text-xl leading-tight font-semibold">{risco.nome}</SheetTitle>
            </div>
            <ScoreRing score={scoreAtual} sev={sevAtual} />
          </div>

          {/* Metadados em linhas com ícone */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 pt-1 relative">
            <HeaderMeta icon={<Tag />} label="Categoria" value={risco.categoria?.nome || '—'} />
            <HeaderMeta
              icon={<User />}
              label="Responsável"
              value={
                risco.responsavel_nome ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {risco.responsavel_foto && <AvatarImage src={risco.responsavel_foto} alt={risco.responsavel_nome} />}
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials(risco.responsavel_nome)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{risco.responsavel_nome}</span>
                  </span>
                ) : '—'
              }
            />
            <HeaderMeta icon={<CalendarClock />} label="Próx. revisão" value={risco.data_proxima_revisao ? formatDateOnly(risco.data_proxima_revisao) : '—'} />
            <HeaderMeta
              icon={<Timer />}
              label="SLA"
              value={<StatusBadge size="sm" {...(sla === 'vencido' ? { tone: 'destructive' as const } : sla === 'atencao' ? { tone: 'warning' as const } : sla === 'no_prazo' ? { tone: 'success' as const } : { tone: 'neutral' as const })}>{SLA_LABELS[sla]}</StatusBadge>}
            />
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="visao" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <TabsList className="grid grid-cols-4 h-9 gap-1.5 w-full">
              <TabsTrigger value="visao" className="text-[11px] px-2 gap-1.5 min-w-0 whitespace-nowrap"><Eye className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>Visão</span></TabsTrigger>
              <TabsTrigger value="tratamentos" className="text-[11px] px-2 gap-1.5 min-w-0 whitespace-nowrap"><Shield className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>Tratamento</span></TabsTrigger>
              <TabsTrigger value="historico" className="text-[11px] px-2 gap-1.5 min-w-0 whitespace-nowrap"><History className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>Histórico</span></TabsTrigger>
              <TabsTrigger value="controles" className="text-[11px] px-2 gap-1.5 min-w-0 whitespace-nowrap"><ShieldCheck className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span>Controles</span></TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Visão */}
            <TabsContent value="visao" className="m-0 space-y-5 data-[state=active]:animate-fade-in">
              {risco.descricao && (
                <section>
                  <SectionLabel>Descrição</SectionLabel>
                  <p className="text-sm text-foreground/85 leading-relaxed">{risco.descricao}</p>
                </section>
              )}

              {/* Movimento inerente → residual */}
              <section>
                <SectionLabel>Inerente → Residual</SectionLabel>
                <div className="flex items-stretch gap-2 mt-0.5">
                  <ScoreBlock label="Inerente" nivel={risco.nivel_risco_inicial} score={inicialScore} p={risco.probabilidade_inicial} i={risco.impacto_inicial} />
                  <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                    <ArrowRight className={reduziu ? 'h-5 w-5 text-success' : 'h-5 w-5 text-muted-foreground/50'} strokeWidth={2} />
                    {reduziu && <span className="text-[9px] text-success font-semibold tabular-nums mt-0.5">−{inicialScore - residualScore}</span>}
                  </div>
                  <ScoreBlock label="Residual" nivel={risco.nivel_risco_residual} score={residualScore} p={risco.probabilidade_residual} i={risco.impacto_residual} emptyLabel="Não avaliado" />
                </div>
              </section>

              {/* Tiles de contexto */}
              <section className="grid grid-cols-3 gap-2">
                <StatTile icon={<Wallet />} label="Exposição" value={exposicao !== null ? formatBRL(exposicao, true) : '—'} />
                <StatTile icon={<Shield />} label="Tratamentos" value={`${tratStats.concluidos}/${tratStats.total}`} />
                <StatTile icon={<Layers />} label="Controles" value={String(detail?.controles.length ?? 0)} />
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
                        <SectionLabel>Exposição financeira</SectionLabel>
                        <div className="mt-1.5 text-lg font-semibold tabular-nums" title={formatBRL(exp)}>
                          {formatBRL(exp)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          impacto {formatBRL(risco.impacto_financeiro ?? null, true)} × probabilidade
                        </div>
                      </div>
                    )}
                    {evo.length >= 2 && (
                      <div className="bg-card border border-border rounded-lg p-3">
                        <SectionLabel>Evolução do risco</SectionLabel>
                        <div className="mt-2">
                          <RiskSparkline scores={evo} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {evo.length} avaliações · score {evo[0]} → {evo[evo.length - 1]}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })()}

              {(risco.causas || risco.consequencias) && (
                <section>
                  <SectionLabel>Causas e consequências</SectionLabel>
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
                  <SectionLabel>Controles existentes</SectionLabel>
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{risco.controles_existentes}</p>
                </section>
              )}
              {risco.aceito && (
                <section className="border border-warning/40 bg-warning/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} /> Risco aceito formalmente
                  </div>
                  {risco.justificativa_aceite && (
                    <p className="text-xs text-foreground/80 mt-1.5">{risco.justificativa_aceite}</p>
                  )}
                </section>
              )}
            </TabsContent>

            {/* Tratamentos */}
            <TabsContent value="tratamentos" className="m-0 space-y-3 data-[state=active]:animate-fade-in">
              {isLoading ? (
                <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
              ) : detail?.tratamentos.length === 0 ? (
                <EmptyHint text="Nenhum tratamento cadastrado." />
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
                    <div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-muted/60">
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
                          <StatusBadge size="sm" {...resolveRiscoStatusTone(t.status)}>
                            {formatStatus(t.status)}
                          </StatusBadge>
                        </div>
                        <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
                          <div className={`h-full ${barCls}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Tipo: {formatStatus(t.tipo_tratamento)}</span>
                          {t.prazo && <span>Prazo: {formatDateOnly(t.prazo)}</span>}
                          {t.eficacia && <span>Eficácia: {t.eficacia}</span>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </TabsContent>

            {/* Histórico */}
            <TabsContent value="historico" className="m-0 data-[state=active]:animate-fade-in">
              {isLoading ? (
                <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
              ) : detail?.historico.length === 0 ? (
                <EmptyHint text="Sem histórico de avaliações." />
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-4 py-1">
                  {detail!.historico.map((h) => (
                    <li key={h.id} className="ml-4">
                      <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{formatStatus(h.tipo)}</span>
                        <span className="text-[11px] text-muted-foreground">{formatDateOnly(h.created_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        P {h.probabilidade} × I {h.impacto} ·{' '}
                        <StatusBadge size="sm" {...resolveNivelRiscoTone(h.nivel_risco)}>
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

            {/* Controles */}
            <TabsContent value="controles" className="m-0 space-y-2 data-[state=active]:animate-fade-in">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
                  {detail?.controles.length || 0} vinculado{(detail?.controles.length || 0) === 1 ? '' : 's'}
                </span>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setVincularOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                  Vincular controle
                </Button>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
              ) : detail?.controles.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Nenhum controle vinculado.</p>
                  <Button variant="outline" size="sm" onClick={() => setVincularOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    Vincular um controle
                  </Button>
                </div>
              ) : (
                detail!.controles.map((c) => {
                  const pct = coberturaPct(c.eficacia_estimada);
                  const cls = pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive';
                  return (
                    <div key={c.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-snug truncate">
                          {c.controle?.nome || 'Controle'}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          {c.controle?.tipo && <span>Tipo: {formatStatus(c.controle.tipo)}</span>}
                          <span>Vínculo: {formatStatus(c.tipo_vinculacao)}</span>
                          {c.eficacia_estimada && <span>{c.eficacia_estimada}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-lg font-semibold tabular-nums ${cls}`}>{pct}%</div>
                        <div className="text-[10px] text-muted-foreground">cobertura</div>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer fixo */}
        <div className="border-t border-border px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card">
          <div className="text-[11px] text-muted-foreground min-w-0 leading-snug">
            {detail?.historico?.[0]
              ? <>Última revisão · <span className="text-foreground/85">{formatStatus(detail.historico[0].tipo)}</span> · {formatDateOnly(detail.historico[0].created_at)}</>
              : risco.responsavel_nome
              ? <>Responsável · <span className="text-foreground/85">{risco.responsavel_nome}</span></>
              : 'Sem revisões registradas'}
          </div>
          <div className="flex items-center gap-3 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={() => onAccept(risco)}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
              Aceitar formalmente
            </Button>
            <Button size="sm" onClick={() => onOpenTratamentos(risco)}>
              <Shield className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
              Novo tratamento
            </Button>
          </div>
        </div>

        <VincularControleDialog
          open={vincularOpen}
          onOpenChange={setVincularOpen}
          riscoId={risco.id}
          riscoNome={risco.nome}
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

const SEV_VAR: Record<Severity, string> = {
  critico: 'hsl(var(--destructive))',
  alto: 'hsl(var(--warning))',
  medio: 'hsl(var(--warning))',
  baixo: 'hsl(var(--success))',
};

/** Anel de score circular colorido por severidade (score/25 → %). */
function ScoreRing({ score, sev }: { score: number; sev: Severity }) {
  const color = SEV_VAR[sev];
  const pct = Math.max(4, Math.min(100, (score / 25) * 100));
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums leading-none" style={{ color }}>{score || '—'}</span>
        <span className="text-[8px] uppercase tracking-[1px] text-muted-foreground mt-0.5">score</span>
      </div>
    </div>
  );
}

/** Bloco de nível (Inerente/Residual) com badge, score e P×I. */
function ScoreBlock({ label, nivel, score, p, i, emptyLabel }: { label: string; nivel?: string | null; score: number; p?: string; i?: string; emptyLabel?: string }) {
  return (
    <div className="flex-1 min-w-0 bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {nivel ? (
          <StatusBadge size="sm" {...resolveNivelRiscoTone(nivel)}>{formatStatus(nivel)}</StatusBadge>
        ) : (
          <StatusBadge size="sm" tone="neutral">{emptyLabel || '—'}</StatusBadge>
        )}
        <span className="text-lg font-semibold tabular-nums">{score || '—'}</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">P {p || '—'} × I {i || '—'}</div>
    </div>
  );
}

/** Tile compacto de contexto (exposição, tratamentos, controles). */
function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground [&_svg]:h-3 [&_svg]:w-3">
        {icon}{label}
      </span>
      <span className="text-base font-semibold tabular-nums truncate">{value}</span>
    </div>
  );
}

/** Metadado do cabeçalho: ícone + rótulo + valor. */
function HeaderMeta({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-muted-foreground [&_svg]:h-3 [&_svg]:w-3">
        {icon}{label}
      </div>
      <div className="text-xs text-foreground mt-1 truncate">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground mb-1.5">
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
    <div className="flex gap-2.5 px-3 py-2 bg-muted/40 rounded-md text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground pt-0.5 min-w-[52px] flex-shrink-0">
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
  if (s.includes('eficaz') && !s.includes('parcial') && !s.includes('inef')) return 100;
  if (s.includes('parcial')) return 60;
  if (s.includes('implant') || s.includes('implement')) return 30;
  if (s.includes('inef')) return 10;
  return 0;
}

