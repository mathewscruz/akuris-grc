/**
 * RiscoPerfilCompleto — "perfil completo" do risco em master-detail (estilo
 * Candidate Detail): resumo à esquerda + abas à direita. Modal grande, aberto
 * pelo drawer ("Ver perfil completo"). Reusa useRiscoDetail, RiscoComentarios
 * e os visuais compartilhados (RiscoVisuals).
 */
import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone, resolveRiscoStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { formatDateOnly } from '@/lib/date-utils';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import {
  initials, shortRiskId, slaFromRevisao, getSlaLabels, financialExposure, type Severity,
} from '@/components/riscos/risk-utils';
import { useEmpresaMoeda } from '@/hooks/useEmpresaMoeda';
import { severidadeRisco } from '@/lib/metrics/riscos';

/** Variável de cor da severidade para o fundo levíssimo do painel. */
const SEV_TINT: Record<Severity, string> = {
  critico: '--destructive',
  alto: '--warning',
  medio: '--warning',
  baixo: '--success',
};
import { ScoreRing, ScoreBlock, StatTile, HeaderMeta } from '@/components/riscos/RiscoVisuals';
import { useRiscoDetail } from '@/hooks/useRiscoDetail';
import { deriveRiscoStatus, isTratamentoConcluido, resumirTratamentos } from '@/components/riscos/risk-status';
import { RiscoComentarios } from '@/components/riscos/RiscoComentarios';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconEdit, IconClose, IconShieldCheck, IconShield, IconArrowRight, IconMoney, IconLayers, IconTag, IconPerson, IconCalendarClock, IconTimer, IconHistory, IconMessage } from '@/components/icons';

interface Risco {
  id: string; nome: string; descricao?: string; status: string;
  nivel_risco_inicial: string; nivel_risco_residual?: string | null;
  score_inicial?: number | null; score_residual?: number | null; score_efetivo?: number | null;
  severidade_inicial?: string | null; severidade_residual?: string | null; severidade_efetiva?: string | null;
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
  return <div className="text-xs font-semibold text-muted-foreground mb-1.5">{children}</div>;
}
function splitLines(text?: string): string[] {
  if (!text) return [];
  return text.split(/\r?\n|;|•/).map((s) => s.trim()).filter(Boolean);
}
function treatmentPct(status: string): number {
  if (isTratamentoConcluido(status)) return 100;
  const s = (status || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (s.includes('andamento') || s.includes('progress')) return 60;
  return 0;
}

export function RiscoPerfilCompleto({ risco, open, onOpenChange, onEdit, onAccept, onOpenTratamentos }: Props) {
  const { t } = useLanguage();
  const { format: formatMoedaEmpresa } = useEmpresaMoeda();
  const { data: detail, isLoading, isError, error: detailError } = useRiscoDetail(risco?.id ?? null);
  const inicialScore = useMemo(() => risco?.score_inicial ?? 0, [risco]);
  const residualScore = useMemo(() => risco?.score_residual ?? 0, [risco]);

  if (!risco) return null;

  const sevCanonica = severidadeRisco(risco);
  const sevAtual: Severity = sevCanonica === 'indefinido' ? 'baixo' : sevCanonica;
  const scoreAtual = residualScore || inicialScore;
  const sla = slaFromRevisao(risco.data_proxima_revisao);
  const exposicao = financialExposure(risco.impacto_financeiro, risco.probabilidade_residual ?? risco.probabilidade_inicial);
  const reduziu = residualScore > 0 && inicialScore > 0 && residualScore < inicialScore;
  const trat = detail?.tratamentos || [];
  // AKURIS QA-065: contagem e status derivam da MESMA regra de conclusão.
  const resumoTrat = resumirTratamentos(trat);
  const concluidos = resumoTrat.concluidos;
  // Enquanto os tratamentos carregam, mantém o status gravado (evita "piscar").
  const statusCoerente = isLoading || isError
    ? { status: risco.status, ajustado: false, motivo: null }
    : deriveRiscoStatus(risco.status, resumoTrat);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[95vw] !max-w-[1120px] h-[90vh] p-0 sm:p-0 gap-0 flex flex-col overflow-hidden [&>button.absolute]:hidden"
        style={{ background: `linear-gradient(0deg, hsl(var(${SEV_TINT[sevAtual]}) / 0.03), hsl(var(${SEV_TINT[sevAtual]}) / 0.03)), hsl(var(--background))` }}
      >
        {/* Top bar — o nome do risco JÁ é o título visível do modal, então ele
            vira o DialogTitle via asChild (AKURIS QA-062). Sem isso o Radix
            registra "DialogContent requires a DialogTitle" e o leitor de tela
            anuncia o diálogo sem contexto. A descrição fica só para leitores. */}
        <DialogDescription className="sr-only">
          Perfil completo do risco {risco.nome}: resumo, tratamentos, histórico, controles e comentários.
        </DialogDescription>
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-micro text-muted-foreground">{shortRiskId(risco.id, (risco as any).codigo)}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-muted-foreground">{t('residuos.risco.perfilRisco')}</div>
              <DialogTitle asChild>
                <div className="text-base font-semibold truncate">{risco.nome}</div>
              </DialogTitle>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onAccept(risco)}>
              <IconShieldCheck className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />Aceitar
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(risco)}>
              <IconEdit className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />{t('riscosDetalhe.perfil.editar')}
            </Button>
            <Button size="sm" onClick={() => onOpenTratamentos(risco)}>
              <IconShield className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />{t('riscosDetalhe.perfil.novoTratamento')}
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => onOpenChange(false)} aria-label={t('fin.comum.fechar')}>
              <IconClose className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* Body master-detail — esquerda grande (resumo), direita compacta (abas) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px]">
          {/* Resumo (esquerda) */}
          <aside className="border-b lg:border-b-0 lg:border-r border-border overflow-y-auto">
            <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <ScoreRing score={scoreAtual} sev={sevAtual} size={84} />
              <div className="min-w-0 flex flex-col items-start gap-1.5">
                <StatusBadge {...resolveNivelRiscoTone(sevAtual)}>
                  {formatStatus(risco.nivel_risco_residual || risco.nivel_risco_inicial)}
                </StatusBadge>
                <span title={isError ? (detailError instanceof Error ? detailError.message : t('sweepRiscos.riscos.detail.falhaCarregarDetalhes')) : statusCoerente.motivo ?? undefined}>
                  <StatusBadge {...(isError ? { tone: 'neutral' as const } : resolveRiscoStatusTone(statusCoerente.status))}>
                    {isError ? t('fin.riscos.statusIndisponivel') : formatStatus(statusCoerente.status)}
                  </StatusBadge>
                </span>
              </div>
            </div>

            {risco.descricao && (
              <section>
                <SectionLabel>{t('campos.risco.descricaoSecao')}</SectionLabel>
                <p className="text-sm text-foreground/85 leading-relaxed">{risco.descricao}</p>
              </section>
            )}

            <section>
              <SectionLabel>{t('campos.risco.inerenteResidual')}</SectionLabel>
              <div className="flex items-stretch gap-2">
                {/*
                    O bloco chama-se «Inerente» e mostrava o nível RESIDUAL.

                    `nivel_risco_residual || nivel_risco_inicial` é o nível
                    efectivo, e está certo onde o rótulo não promete outra
                    coisa. Aqui prometia: a etiqueta dizia «Inerente», o
                    número ao lado era o score inerente e o P×I por baixo
                    era o inerente — só a severidade vinha do residual.
                    Medido no R-0011: «Inerente B Baixo 5 P1×5», quando 5
                    é Médio na matriz e a base guarda `medio`. E a seta ao
                    lado anunciava «−2» de Baixo para Baixo. Dezasseis dos
                    vinte e cinco riscos desta empresa liam-se assim.
                */}
                <ScoreBlock label={t('sweepRiscos.riscos.detail.inerente')} nivel={risco.nivel_risco_inicial} score={inicialScore} p={risco.probabilidade_inicial} i={risco.impacto_inicial} />
                <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                  <IconArrowRight className={reduziu ? 'h-5 w-5 text-success' : 'h-5 w-5 text-muted-foreground'} strokeWidth={2} />
                  {reduziu && <span className="text-micro text-success font-semibold tabular-nums mt-0.5">−{inicialScore - residualScore}</span>}
                </div>
                <ScoreBlock label={t('sweepRiscos.riscos.detail.residual')} nivel={risco.nivel_risco_residual} score={residualScore} p={risco.probabilidade_residual} i={risco.impacto_residual} emptyLabel={t('fin.riscos.naoAvaliado')} />
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <StatTile icon={<IconMoney />} label={t('fin.riscos.exposicao')} value={exposicao !== null ? formatMoedaEmpresa(exposicao, true) : '—'} />
              <StatTile icon={<IconShield />} label={t('cardsKpi.sweep.riscos.tratamAbbr')} value={`${concluidos}/${trat.length}`} />
              <StatTile icon={<IconLayers />} label={t('cardsKpi.sweep.riscos.controles')} value={String(detail?.controles.length ?? 0)} />
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <HeaderMeta icon={<IconTag />} label={t('cardsKpi.sweep.riscos.categoria')} value={risco.categoria?.nome || '—'} />
              <HeaderMeta icon={<IconPerson />} label={t('residuos.risco.responsavel')} value={
                risco.responsavel_nome ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {risco.responsavel_foto && <AvatarImage src={risco.responsavel_foto} alt={risco.responsavel_nome} />}
                      <AvatarFallback className="text-micro bg-primary/10 text-primary">{initials(risco.responsavel_nome)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{risco.responsavel_nome}</span>
                  </span>
                ) : '—'
              } />
              <HeaderMeta icon={<IconTimer />} label="SLA" value={<StatusBadge {...(sla === 'vencido' ? { tone: 'destructive' as const } : sla === 'atencao' ? { tone: 'warning' as const } : sla === 'no_prazo' ? { tone: 'success' as const } : { tone: 'neutral' as const })}>{getSlaLabels()[sla]}</StatusBadge>} />
              <HeaderMeta icon={<IconCalendarClock />} label={t('fin.riscos.proxRevisao')} value={risco.data_proxima_revisao ? formatDateOnly(risco.data_proxima_revisao) : '—'} />
              <HeaderMeta icon={<IconCalendarClock />} label={t('residuos.risco.criadoEm')} value={risco.created_at ? formatDateOnly(risco.created_at) : '—'} />
              <HeaderMeta icon={<IconHistory />} label={t('fin.riscos.avaliacoes')} value={String(detail?.historico.length ?? 0)} />
            </section>

            {(risco.causas || risco.consequencias) && (
              <section>
                <SectionLabel>{t('fin.riscos.causasConsequencias')}</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {splitLines(risco.causas).map((l, i) => (
                    <div key={`c-${i}`} className="flex gap-2.5 px-3 py-2 bg-card rounded-md text-xs border border-border">
                      <span className="text-xs font-semibold text-muted-foreground pt-0.5 min-w-[52px] shrink-0">CAUSA</span>
                      <span className="text-foreground/85">{l}</span>
                    </div>
                  ))}
                  {splitLines(risco.consequencias).map((l, i) => (
                    <div key={`q-${i}`} className="flex gap-2.5 px-3 py-2 bg-card rounded-md text-xs border border-border">
                      <span className="text-xs font-semibold text-muted-foreground pt-0.5 min-w-[52px] shrink-0">CONSEQ.</span>
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
            <div className="px-4 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="tratamentos" className="flex-1 min-w-0 gap-1 px-1.5 text-micro"><IconShield className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /><span className="truncate">{t('cardsKpi.sweep.riscos.tratamAbbr')}</span></TabsTrigger>
                <TabsTrigger value="historico" className="flex-1 min-w-0 gap-1 px-1.5 text-micro"><IconHistory className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /><span className="truncate">{t('fin.comum.historico')}</span></TabsTrigger>
                <TabsTrigger value="controles" className="flex-1 min-w-0 gap-1 px-1.5 text-micro"><IconShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /><span className="truncate">{t('cardsKpi.sweep.riscos.controles')}</span></TabsTrigger>
                <TabsTrigger value="comentarios" className="flex-1 min-w-0 gap-1 px-1.5 text-micro"><IconMessage className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /><span className="truncate">{t('cardsKpi.sweep.riscos.comentAbbr')}</span></TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
              <TabsContent value="tratamentos" className="m-0 space-y-2.5">
                {isLoading ? <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
                  : isError ? <div className="py-10 text-center text-sm text-destructive">{detailError instanceof Error ? detailError.message : t('fin.riscos.erroTratamentos')}</div>
                  : trat.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">{t('fin.riscos.semTratamentos')}</div>
                  : trat.map((tr) => {
                    const pct = treatmentPct(tr.status);
                    return (
                      <div key={tr.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium leading-snug">{tr.descricao}</div>
                          <StatusBadge {...resolveRiscoStatusTone(tr.status)}>{formatStatus(tr.status)}</StatusBadge>
                        </div>
                        <div className="h-1 bg-card rounded-full overflow-hidden border border-border"><div className={pct === 100 ? 'h-full bg-success' : pct > 0 ? 'h-full bg-primary' : 'h-full bg-muted-foreground/30'} style={{ width: `${pct}%` }} /></div>
                        <div className="text-micro text-muted-foreground flex flex-wrap gap-x-3">
                          <span>{t('riscosDetalhe.shared.tipo')}: {formatStatus(tr.tipo_tratamento)}</span>
                          {tr.prazo && <span>{t('riscosDetalhe.shared.prazo')}: {formatDateOnly(tr.prazo)}</span>}
                          {tr.eficacia && <span>{t('riscosDetalhe.shared.eficacia')}: {tr.eficacia}</span>}
                        </div>
                      </div>
                    );
                  })}
              </TabsContent>

              <TabsContent value="historico" className="m-0">
                {isLoading ? <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
                  : isError ? <div className="py-10 text-center text-sm text-destructive">{detailError instanceof Error ? detailError.message : t('fin.riscos.erroHistorico')}</div>
                  : detail?.historico.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">{t('fin.riscos.semHistorico')}</div>
                  : (
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
                            <StatusBadge {...resolveNivelRiscoTone(h.nivel_risco)}>{formatStatus(h.nivel_risco)}</StatusBadge>
                          </div>
                          {h.observacoes && <p className="text-xs text-foreground/80 mt-1.5">{h.observacoes}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
              </TabsContent>

              <TabsContent value="controles" className="m-0 space-y-2">
                {isLoading ? <div className="flex justify-center py-10"><AkurisPulse size={32} /></div>
                  : isError ? <div className="py-10 text-center text-sm text-destructive">{detailError instanceof Error ? detailError.message : t('fin.riscos.erroControles')}</div>
                  : detail?.controles.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">{t('fin.riscos.semControles')}</div>
                  : detail!.controles.map((c) => (
                    <div key={c.id} className="bg-card border border-border rounded-lg p-3">
                      <div className="text-sm font-medium leading-snug truncate">{c.controle?.nome || 'Controle'}</div>
                      <div className="text-micro text-muted-foreground mt-1 flex flex-wrap gap-x-3">
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
