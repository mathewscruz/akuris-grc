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
import { ArrowRight, CalendarClock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { logger } from '@/lib/logger';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AIBadge } from './AIBadge';
import { SectionHead } from './SectionHead';

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

function deadlineUrgency(prazo: string | null): { factor: number; reason: string } {
  if (!prazo) return { factor: 0.1, reason: 'sem prazo' };
  try {
    const days = differenceInCalendarDays(parseISO(prazo), new Date());
    if (days < 0) return { factor: 1.0, reason: `vencido há ${Math.abs(days)}d` };
    if (days <= 7) return { factor: 0.85, reason: `vence em ${days}d` };
    if (days <= 30) return { factor: 0.55, reason: `vence em ${days}d` };
    return { factor: 0.2, reason: `vence em ${days}d` };
  } catch {
    return { factor: 0.1, reason: 'prazo inválido' };
  }
}

export function PriorityQueueCard({
  frameworkId,
  empresaId,
  limit = 5,
  onRequirementClick,
  onSeeAll,
}: PriorityQueueCardProps) {
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
            .select('id, codigo, titulo, categoria, peso, area_responsavel')
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
        const scored = (reqsRes.data || []).map(r => {
          const ev = evalMap.get(r.id);
          const peso = Number(r.peso || 3);
          const sPen = statusPenalty(ev?.conformity_status);
          const dl = deadlineUrgency(ev?.prazo_implementacao || null);
          const priority = peso * sPen * (0.4 + dl.factor * 0.6);
          const reasonParts: string[] = [];
          if (ev?.conformity_status === 'nao_conforme') reasonParts.push('não conforme');
          else if (ev?.conformity_status === 'parcial') reasonParts.push('parcial');
          else reasonParts.push('não avaliado');
          if (peso >= 4) reasonParts.push('peso alto');
          if (dl.factor >= 0.85) reasonParts.push(dl.reason);
          return {
            id: r.id,
            codigo: r.codigo,
            titulo: r.titulo,
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

  const totalCritical = useMemo(
    () => items.filter(i => i.conformity_status === 'nao_conforme').length,
    [items]
  );

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="p-5">
        <SectionHead
          title="FILA DE PRIORIDADE"
          count={items.length}
          right={
            <div className="flex items-center gap-2">
              <AIBadge>Ordenado pela IA</AIBadge>
              {onSeeAll && (
                <button
                  type="button"
                  onClick={onSeeAll}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Ver todos
                  <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
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
            Sem requisitos críticos no momento — todos os pendentes estão dentro do prazo.
          </p>
        ) : (
          <ol className="space-y-2">
            {items.map((item, idx) => {
              const isCritical = item.conformity_status === 'nao_conforme';
              const isOverdue =
                item.prazo_implementacao &&
                differenceInCalendarDays(parseISO(item.prazo_implementacao), new Date()) < 0;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onRequirementClick({ id: item.id, codigo: item.codigo, titulo: item.titulo })
                    }
                    className="group w-full text-left flex items-center gap-3 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-accent/40 transition-all px-3 py-2.5"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-5 text-center">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {item.codigo && (
                          <span className="font-mono text-[11px] tabular-nums text-foreground/80">
                            {item.codigo}
                          </span>
                        )}
                        {item.categoria && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                            · {item.categoria}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {item.titulo}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {isCritical && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-destructive">
                            <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                            Não conforme
                          </span>
                        )}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-destructive">
                            <CalendarClock className="h-3 w-3" strokeWidth={1.5} />
                            Vencido
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground italic">{item.reason}</span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      Triagem
                      <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {totalCritical > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
            <span className="font-semibold text-destructive tabular-nums">{totalCritical}</span> requisito(s)
            não-conforme(s) entre os {items.length} priorizados.
          </div>
        )}
      </div>
    </section>
  );
}
