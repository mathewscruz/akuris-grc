/**
 * RiscoPerfilCompleto — "perfil completo" do risco em master-detail (estilo
 * Candidate Detail): resumo à esquerda + abas à direita. Modal grande, aberto
 * pelo drawer ("Ver perfil completo"). Reusa useRiscoDetail, RiscoComentarios
 * e os visuais compartilhados (RiscoVisuals).
 */
import { useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone, resolveRiscoStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Edit, ShieldCheck, Shield, X, ArrowRight, Wallet, Layers, Tag, User, CalendarClock, Timer, History, Eye, MessageSquare } from 'lucide-react';
import {
  initials, scoreFromPI, severityFromNivel, shortRiskId, slaFromRevisao, SLA_LABELS, financialExposure, formatBRL,
} from '@/components/riscos/risk-utils';
import { ScoreRing, ScoreBlock, StatTile, HeaderMeta } from '@/components/riscos/RiscoVisuals';
import { useRiscoDetail } from '@/hooks/useRiscoDetail';
import { RiscoComentarios } from '@/components/riscos/RiscoComentarios';

interface Risco {
  id: string; nome: string; descricao?: string; status: string;
  nivel_risco_inicial: string; nivel_risco_residual?: string | null;
  probabilidade_inicial?: string; impacto_inicial?: string;
  probabilidade_residual?: string; impacto_residual?: string;
  impacto_financeiro?: number | null;
  causas?: string; consequencias?: string; controles_existentes?: string;
  responsavel_nome?: string | null; responsavel_foto?: string | null;
  categoria?: { nome: string; cor?: string } | null;
  data_proxima_revisao?: string; created_at: string;
}

interface Props {
  risco: Risco | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (r: Risco) => void;
  onAccept: (r: Risco) => void;
  onOpenTratamentos: (r: Risco) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground mb-1.5">{children}</div>;
}
function splitLines(text?: string): string[] {
  if (!text) return [];
  return text.split(/\r?\n|;|•/).map((s) => s.trim()).filter(Boolean);
}
function treatmentPct(status: string): number {
  const s = (status || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (s.includes('conclu')) return 100;
  if (s.includes('andamento') || s.includes('progress')) return 60;
  return 0;
}

export function RiscoPerfilCompleto({ risco, open, onOpenChange, onEdit, onAccept, onOpenTratamentos }: Props) {
  const { data: detail, isLoading } = useRiscoDetail(risco?.id ?? null);
  const inicialScore = useMemo(() => scoreFromPI(risco?.probabilidade_inicial, risco?.impacto_inicial), [risco]);
  const residualScore = useMemo(() => scoreFromPI(risco?.probabilidade_residual, risco?.impacto_residual), [risco]);

  if (!risco) return null;

  const sevAtual = severityFromNivel(risco.nivel_risco_residual || risco.nivel_risco_inicial);
  const scoreAtual = residualScore || inicialScore;
  const sla = slaFromRevisao(risco.data_proxima_revisao);
  const exposicao = financialExposure(risco.impacto_financeiro, risco.probabilidade_residual ?? risco.probabilidade_inicial);
  const reduziu = residualScore > 0 && inicialScore > 0 && residualScore < inicialScore;
  const trat = detail?.tratamentos || [];
  const concluidos = trat.filter((t) => t.status === 'concluído').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[95vw] !max-w-[1120px] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden [&>button.absolute]:hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[11px] text-muted-foreground">{shortRiskId(risco.id)}</span>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">Perfil do risco</div>
              <div className="text-base font-semibold truncate">{risco.nome}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onAccept(risco)}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />Aceitar
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(risco)}>
              <Edit className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />Editar
            </Button>
            <Button size="sm" onClick={() => onOpenTratamentos(risco)}>
              <Shield className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />Novo tratamento
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onOpenChange(false)} aria-label="Fechar">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* Body master-detail — esquerda grande (resumo), direita compacta (abas) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px]">
          {/* Resumo (esquerda) */}
          <aside className="relative border-b lg:border-b-0 lg:border-r border-border overflow-y-auto">
            {/* Degradê suave vermelho → amarelo → verde */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{ background: 'linear-gradient(135deg, hsl(var(--destructive)) 0%, hsl(var(--warning)) 45%, hsl(var(--success)) 100%)' }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1"
              style={{ background: 'linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--warning)), hsl(var(--success)))' }}
            />
            <div className="relative p-6 space-y-6">
            <div className="flex items-center gap-4">
              <ScoreRing score={scoreAtual} sev={sevAtual} size={84} />
              <div className="min-w-0 space-y-1.5">
                <StatusBadge size="sm" {...resolveNivelRiscoTone(risco.nivel_risco_residual || risco.nivel_risco_inicial)}>
                  {formatStatus(risco.nivel_risco_residual || risco.nivel_risco_inicial)}
                </StatusBadge>
                <StatusBadge size="sm" {...resolveRiscoStatusTone(risco.status)}>{formatStatus(risco.status)}</StatusBadge>
              </div>
            </div>

            {risco.descricao && (
              <section>
                <SectionLabel>Descrição</SectionLabel>
                <p className="text-sm text-foreground/85 leading-relaxed">{risco.descricao}</p>
              </section>
            )}

            <section>
              <SectionLabel>Inerente → Residual</SectionLabel>
              <div className="flex items-stretch gap-2">
                <ScoreBlock label="Inerente" nivel={risco.nivel_risco_inicial} score={inicialScore} p={risco.probabilidade_inicial} i={risco.impacto_inicial} />
                <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                  <ArrowRight className={reduziu ? 'h-5 w-5 text-success' : 'h-5 w-5 text-muted-foreground/50'} strokeWidth={2} />
                  {reduziu && <span className="text-[9px] text-success font-semibold tabular-nums mt-0.5">−{inicialScore - residualScore}</span>}
                </div>
                <ScoreBlock label="Residual" nivel={risco.nivel_risco_residual} score={residualScore} p={risco.probabilidade_residual} i={risco.impacto_residual} emptyLabel="Não avaliado" />
              </div>
            </section>

            <section className="grid grid-cols-3 gap-2">
              <StatTile icon={<Wallet />} label="Exposição" value={exposicao !== null ? formatBRL(exposicao, true) : '—'} />
              <StatTile icon={<Shield />} label="Tratam." value={`${concluidos}/${trat.length}`} />
              <StatTile icon={<Layers />} label="Controles" value={String(detail?.controles.length ?? 0)} />
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <HeaderMeta icon={<Tag />} label="Categoria" value={risco.categoria?.nome || '—'} />
              <HeaderMeta icon={<User />} label="Responsável" value={
                risco.responsavel_nome ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {risco.responsavel_foto && <AvatarImage src={risco.responsavel_foto} alt={risco.responsavel_nome} />}
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials(risco.responsavel_nome)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{risco.responsavel_nome}</span>
                  </span>
                ) : '—'
              } />
              <HeaderMeta icon={<Timer />} label="SLA" value={<StatusBadge size="sm" {...(sla === 'vencido' ? { tone: 'destructive' as const } : sla === 'atencao' ? { tone: 'warning' as const } : sla === 'no_prazo' ? { tone: 'success' as const } : { tone: 'neutral' as const })}>{SLA_LABELS[sla]}</StatusBadge>} />
              <HeaderMeta icon={<CalendarClock />} label="Próx. revisão" value={risco.data_proxima_revisao ? formatDateOnly(risco.data_proxima_revisao) : '—'} />
              <HeaderMeta icon={<CalendarClock />} label="Criado em" value={risco.created_at ? formatDateOnly(risco.created_at) : '—'} />
              <HeaderMeta icon={<History />} label="Avaliações" value={String(detail?.historico.length ?? 0)} />
            </section>

            {(risco.causas || risco.consequencias) && (
              <section>
                <SectionLabel>Causas e consequências</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {splitLines(risco.causas).map((l, i) => (
                    <div key={`c-${i}`} className="flex gap-2.5 px-3 py-2 bg-muted/40 rounded-md text-xs">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground pt-0.5 min-w-[52px] shrink-0">CAUSA</span>
                      <span className="text-foreground/85">{l}</span>
                    </div>
                  ))}
                  {splitLines(risco.consequencias).map((l, i) => (
                    <div key={`q-${i}`} className="flex gap-2.5 px-3 py-2 bg-muted/40 rounded-md text-xs">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground pt-0.5 min-w-[52px] shrink-0">CONSEQ.</span>
                      <span className="text-foreground/85">{l}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            </div>
          </aside>

          {/* Abas (direita) */}
          <Tabs defaultValue="tratamentos" className="min-h-0 flex flex-col">
            <div className="px-6 pt-4">
              <TabsList>
                <TabsTrigger value="tratamentos" className="gap-1.5"><Shield className="h-3.5 w-3.5" strokeWidth={1.5} />Tratamentos</TabsTrigger>
                <TabsTrigger value="historico" className="gap-1.5"><History className="h-3.5 w-3.5" strokeWidth={1.5} />Histórico</TabsTrigger>
                <TabsTrigger value="controles" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />Controles</TabsTrigger>
                <TabsTrigger value="comentarios" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />Comentários</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <TabsContent value="tratamentos" className="m-0 space-y-2.5">
                {isLoading ? <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
                  : trat.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Nenhum tratamento cadastrado.</div>
                  : trat.map((t) => {
                    const pct = treatmentPct(t.status);
                    return (
                      <div key={t.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium leading-snug">{t.descricao}</div>
                          <StatusBadge size="sm" {...resolveRiscoStatusTone(t.status)}>{formatStatus(t.status)}</StatusBadge>
                        </div>
                        <div className="h-1 bg-muted/60 rounded-full overflow-hidden"><div className={pct === 100 ? 'h-full bg-success' : pct > 0 ? 'h-full bg-primary' : 'h-full bg-muted-foreground/30'} style={{ width: `${pct}%` }} /></div>
                        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                          <span>Tipo: {formatStatus(t.tipo_tratamento)}</span>
                          {t.prazo && <span>Prazo: {formatDateOnly(t.prazo)}</span>}
                          {t.eficacia && <span>Eficácia: {t.eficacia}</span>}
                        </div>
                      </div>
                    );
                  })}
              </TabsContent>

              <TabsContent value="historico" className="m-0">
                {isLoading ? <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
                  : detail?.historico.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Sem histórico de avaliações.</div>
                  : (
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
                            <StatusBadge size="sm" {...resolveNivelRiscoTone(h.nivel_risco)}>{formatStatus(h.nivel_risco)}</StatusBadge>
                          </div>
                          {h.observacoes && <p className="text-xs text-foreground/80 mt-1.5">{h.observacoes}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
              </TabsContent>

              <TabsContent value="controles" className="m-0 space-y-2">
                {isLoading ? <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
                  : detail?.controles.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Nenhum controle vinculado.</div>
                  : detail!.controles.map((c) => (
                    <div key={c.id} className="bg-card border border-border rounded-lg p-3">
                      <div className="text-sm font-medium leading-snug truncate">{c.controle?.nome || 'Controle'}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                        {c.controle?.tipo && <span>Tipo: {formatStatus(c.controle.tipo)}</span>}
                        <span>Vínculo: {formatStatus(c.tipo_vinculacao)}</span>
                        {c.eficacia_estimada && <span>{c.eficacia_estimada}</span>}
                      </div>
                    </div>
                  ))}
              </TabsContent>

              <TabsContent value="comentarios" className="m-0">
                <RiscoComentarios riscoId={risco.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
