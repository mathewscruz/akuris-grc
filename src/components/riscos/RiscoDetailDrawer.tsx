/**
 * RiscoDetailDrawer — Sheet 540px (fullscreen mobile) com 4 abas: Visão · Tratamentos · Histórico · Controles.
 * Footer fixo com CTAs "Aceitar formalmente" e "Editar risco".
 */
import { useMemo } from 'react';
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
import {
  resolveNivelRiscoTone,
  resolveRiscoStatusTone,
} from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Edit, ShieldCheck, Clock, AlertTriangle, Shield, History, Eye, X } from 'lucide-react';
import {
  initials,
  scoreFromPI,
  shortRiskId,
  slaFromRevisao,
  SLA_LABELS,
} from '@/components/riscos/risk-utils';
import { useRiscoDetail } from '@/hooks/useRiscoDetail';

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
}

export function RiscoDetailDrawer({ risco, open, onOpenChange, onEdit, onAccept, onOpenTratamentos }: Props) {
  const { data: detail, isLoading } = useRiscoDetail(risco?.id ?? null);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[540px] p-0 flex flex-col gap-0 [&>button.absolute]:hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-6 border-b border-border space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] font-mono tracking-wider text-muted-foreground">
                {shortRiskId(risco.id)}
              </span>
              <StatusBadge size="sm" {...resolveNivelRiscoTone(risco.nivel_risco_residual || risco.nivel_risco_inicial)}>
                {formatStatus(risco.nivel_risco_residual || risco.nivel_risco_inicial)}
              </StatusBadge>
              <StatusBadge size="sm" {...resolveRiscoStatusTone(risco.status)}>
                {formatStatus(risco.status)}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onEdit(risco)}
              >
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
          <SheetTitle className="text-xl leading-tight font-semibold">
            {risco.nome}
          </SheetTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 pt-1">
            {[
              { l: 'Categoria', v: risco.categoria?.nome || '—' },
              { l: 'Responsável', v: risco.responsavel_nome || '—' },
              {
                l: 'Próx. revisão',
                v: risco.data_proxima_revisao ? formatDateOnly(risco.data_proxima_revisao) : '—',
              },
              { l: 'SLA', v: SLA_LABELS[sla] },
            ].map((m) => (
              <div key={m.l} className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
                  {m.l}
                </div>
                <div className="text-xs text-foreground mt-1 truncate">{m.v}</div>
              </div>
            ))}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="visao" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mr-10 grid grid-cols-4 h-9 gap-1.5">
            <TabsTrigger value="visao" className="text-[11px] px-1.5 gap-1 min-w-0"><Eye className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span className="truncate">Visão</span></TabsTrigger>
            <TabsTrigger value="tratamentos" className="text-[11px] px-1.5 gap-1 min-w-0"><Shield className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span className="truncate">Tratamento</span></TabsTrigger>
            <TabsTrigger value="historico" className="text-[11px] px-1.5 gap-1 min-w-0"><History className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span className="truncate">Histórico</span></TabsTrigger>
            <TabsTrigger value="controles" className="text-[11px] px-1.5 gap-1 min-w-0"><ShieldCheck className="h-3 w-3 shrink-0" strokeWidth={1.5} /><span className="truncate">Controles</span></TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Visão */}
            <TabsContent value="visao" className="m-0 space-y-5">
              {risco.descricao && (
                <section>
                  <SectionLabel>Descrição</SectionLabel>
                  <p className="text-sm text-foreground/85 leading-relaxed">{risco.descricao}</p>
                </section>
              )}

              <section className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-lg p-3">
                  <SectionLabel>Nível inicial</SectionLabel>
                  <div className="mt-1.5 flex items-center justify-between">
                    <StatusBadge size="sm" {...resolveNivelRiscoTone(risco.nivel_risco_inicial)}>
                      {formatStatus(risco.nivel_risco_inicial)}
                    </StatusBadge>
                    <span className="text-lg font-semibold tabular-nums">{inicialScore || '—'}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    P {risco.probabilidade_inicial || '—'} × I {risco.impacto_inicial || '—'}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  <SectionLabel>Nível residual</SectionLabel>
                  <div className="mt-1.5 flex items-center justify-between">
                    {risco.nivel_risco_residual ? (
                      <StatusBadge size="sm" {...resolveNivelRiscoTone(risco.nivel_risco_residual)}>
                        {formatStatus(risco.nivel_risco_residual)}
                      </StatusBadge>
                    ) : (
                      <StatusBadge size="sm" tone="neutral">Não avaliado</StatusBadge>
                    )}
                    <span className="text-lg font-semibold tabular-nums">{residualScore || '—'}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    P {risco.probabilidade_residual || '—'} × I {risco.impacto_residual || '—'}
                  </div>
                </div>
              </section>

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
            <TabsContent value="tratamentos" className="m-0 space-y-3">
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
            <TabsContent value="historico" className="m-0">
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
            <TabsContent value="controles" className="m-0 space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
              ) : detail?.controles.length === 0 ? (
                <EmptyHint text="Nenhum controle vinculado." />
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
      </SheetContent>
    </Sheet>
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

