/**
 * PriorityQueueCard — fila editorial dos top-N requisitos priorizados pela IA.
 *
 * Score de prioridade = criticidade (peso) × penalidade de status (não-conforme > parcial > não-avaliado)
 *                       × urgência do prazo (vencido > <7d > <30d).
 *
 * Cada item leva à triagem rápida do requisito (callback do parent).
 * Mantém identidade Akuris — sem cores cruas, DM Sans, tokens semânticos.
 */
import { useEffect, useMemo, useState } from 'react';
import { GAP_CRITICAL_WEIGHT } from '@/lib/gap-criticality';
import { buscarForaDoEscopo } from '@/lib/gap-soa';
import { supabase } from '@/integrations/supabase/client';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { logger } from '@/lib/logger';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { SectionHead } from './SectionHead';
import { reqTitulo } from "@/lib/gap-i18n";
import { useLanguage } from '@/contexts/LanguageContext';
import { isGapCritico, isGapAtrasado } from '@/lib/gap-criticality';
import { IconWarning, IconArrowRight, IconCalendarClock } from '@/components/icons';

interface PriorityRequirement {
  id: string;
  codigo: string | null;
  titulo: string;
  categoria: string | null;
  peso: number | null;
  prazo_implementacao: string | null;
  conformity_status: string | null;
  area_responsavel: string | null;
  priority: number;
  reason: string;
}

interface PriorityQueueCardProps {
  frameworkId: string;
  empresaId: string;
  limit?: number;
  onRequirementClick: (req: { id: string; codigo: string | null; titulo: string }) => void;
  onSeeAll?: () => void;
}

function statusPenalty(s: string | null | undefined): number {
  switch (s) {
    case 'nao_conforme': return 1.0;
    case 'parcial': return 0.55;
    case 'nao_avaliado':
    case null:
    case undefined: return 0.35;
    default: return 0;
  }
}

function deadlineUrgency(
  prazo: string | null,
  t: (key: string, params?: Record<string, string | number>) => string
): { factor: number; reason: string } {
  if (!prazo) return { factor: 0.1, reason: t('gapV2.priorityQueue.noDeadline') };
  try {
    const days = differenceInCalendarDays(parseISO(prazo), new Date());
    if (days < 0) return { factor: 1.0, reason: t('gapV2.priorityQueue.overdueBy', { days: Math.abs(days) }) };
    if (days <= 7) return { factor: 0.85, reason: t('gapV2.priorityQueue.dueIn', { days }) };
    if (days <= 30) return { factor: 0.55, reason: t('gapV2.priorityQueue.dueIn', { days }) };
    return { factor: 0.2, reason: t('gapV2.priorityQueue.dueIn', { days }) };
  } catch {
    return { factor: 0.1, reason: t('gapV2.priorityQueue.invalidDeadline') };
  }
}

export function PriorityQueueCard({
  frameworkId,
  empresaId,
  limit = 5,
  onRequirementClick,
  onSeeAll,
}: PriorityQueueCardProps) {
  const { t } = useLanguage();
  const [items, setItems] = useState<PriorityRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!frameworkId || !empresaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [reqsRes, evalsRes] = await Promise.all([
          supabase
            .from('gap_analysis_requirements')
            .select('id, codigo, titulo, categoria, peso, area_responsavel, titulo_en, categoria_en')
            .eq('framework_id', frameworkId),
          supabase
            .from('gap_analysis_evaluations')
            .select('requirement_id, conformity_status, prazo_implementacao')
            .eq('framework_id', frameworkId)
            .eq('empresa_id', empresaId),
        ]);
        if (cancelled) return;
        const evalMap = new Map(
          (evalsRes.data || []).map(e => [e.requirement_id, e])
        );
        // Fila de trabalho: o que a empresa tirou do escopo no SoA não entra.
        // Aparecia aqui como prioridade 02, cobrando ação sobre um requisito
        // que a diretoria já tinha dispensado por escrito.
        const foraDoEscopo = await buscarForaDoEscopo(frameworkId, empresaId);
        const scored = (reqsRes.data || []).filter(r => !foraDoEscopo.has(r.id)).map(r => {
          const ev = evalMap.get(r.id);
          const peso = Number(r.peso || 3);
          const sPen = statusPenalty(ev?.conformity_status);
          const dl = deadlineUrgency(ev?.prazo_implementacao || null, t);
          const priority = peso * sPen * (0.4 + dl.factor * 0.6);
          // Não duplicamos o status no texto — o chip já o mostra ao lado.
          const reasonParts: string[] = [];
          if (!ev?.conformity_status || ev.conformity_status === 'nao_avaliado') {
            reasonParts.push(t('gapV2.priorityQueue.notEvaluated'));
          }
          // Mesmo limiar de `gap-criticality.ts`, e não um 4 solto: o peso
          // máximo que existe no produto é 3.
          if (peso >= GAP_CRITICAL_WEIGHT) reasonParts.push(t('gapV2.priorityQueue.highWeight'));
          if (dl.factor >= 0.85) reasonParts.push(dl.reason);
          return {
            id: r.id,
            codigo: r.codigo,
            titulo: reqTitulo(r as any),
            categoria: r.categoria,
            peso: r.peso,
            prazo_implementacao: ev?.prazo_implementacao || null,
            conformity_status: ev?.conformity_status || null,
            area_responsavel: r.area_responsavel,
            priority,
            reason: reasonParts.join(' · '),
          };
        });
        scored.sort((a, b) => b.priority - a.priority);
        setItems(scored.filter(s => s.priority > 0).slice(0, limit));
      } catch (e) {
        logger.error('Erro ao montar fila de prioridade', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [frameworkId, empresaId, limit]);

  // Mesma definição de "crítico" usada no cartão Gaps a Tratar e no dashboard.
  const totalCritical = useMemo(
    () => items.filter(i => isGapCritico(i)).length,
    [items]
  );

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-card">
      <div className="p-5">
        {/* Cada requisito numa linha só. Empilhado — código, título, motivo —
            a fila gastava 366px para quatro itens, mais do que o cabeçalho
            inteiro da página. À largura toda não há razão para empilhar. */}
        <SectionHead
          title={t('gapV2.priorityQueue.title')}
          count={items.length}
          right={
            <div className="flex items-center gap-2">
              {onSeeAll && (
                <button
                  type="button"
                  onClick={onSeeAll}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {t('gapV2.priorityQueue.seeAll')}
                  <IconArrowRight className="h-3 w-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          }
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <AkurisPulse size={32} />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">
            {t('gapV2.priorityQueue.emptyState')}
          </p>
        ) : (
          <ol className="space-y-1.5">
            {items.map((item, idx) => {
              const isCritical = item.conformity_status === 'nao_conforme';
              const isOverdue = isGapAtrasado(item.prazo_implementacao);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onRequirementClick({ id: item.id, codigo: item.codigo, titulo: item.titulo })
                    }
                    className="group w-full text-left flex items-center gap-3 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-accent/40 transition-ui px-3 py-2"
                  >
                    <span className="font-mono text-xs tabular-nums text-muted-foreground w-6 text-center shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    {item.codigo && (
                      <span className="font-mono text-xs tabular-nums text-foreground/80 w-20 shrink-0">
                        {item.codigo}
                      </span>
                    )}

                    <span className="text-sm text-foreground truncate flex-1 min-w-0 group-hover:text-primary transition-colors">
                      {item.titulo}
                    </span>

                    {item.categoria && (
                      <span className="hidden xl:block text-xs text-muted-foreground truncate w-48 shrink-0">
                        {item.categoria}
                      </span>
                    )}

                    <span className="flex items-center gap-2 shrink-0 w-56 justify-end">
                      {isCritical && (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <IconWarning className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {t('gapV2.priorityQueue.nonCompliant')}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <IconCalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {t('gapV2.priorityQueue.overdue')}
                        </span>
                      )}
                      {!isCritical && !isOverdue && (
                        <span className="text-xs text-muted-foreground truncate">{item.reason}</span>
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                      {t('gapV2.priorityQueue.triage')}
                      <IconArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {totalCritical > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60 text-micro text-muted-foreground">
            <span className="font-semibold text-destructive tabular-nums">{totalCritical}</span> {t('gapV2.priorityQueue.footerSummary', { total: items.length })}
          </div>
        )}
      </div>
    </section>
  );
}
