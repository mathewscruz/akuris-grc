/**
 * PriorityQueueCard — fila editorial dos top-N requisitos priorizados pela IA.
 *
 * Score de prioridade = criticidade (peso) × penalidade de status (não-conforme > parcial > não-avaliado)
 *                       × urgência do prazo (vencido > <7d > <30d).
 *
 * Cada item leva ao workspace completo do requisito (callback do parent).
 * Mantém identidade Akuris — sem cores cruas, DM Sans, tokens semânticos.
 */
import { useEffect, useMemo, useState } from 'react';
import { buscarForaDoEscopo } from '@/lib/gap-soa';
import { supabase } from '@/integrations/supabase/client';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { logger } from '@/lib/logger';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { ExecutivePanel } from '@/components/ui/executive-summary';
import { reqTitulo } from "@/lib/gap-i18n";
import { useLanguage } from '@/contexts/LanguageContext';
import { isGapCritico, isGapAtrasado } from '@/lib/gap-criticality';
import { IconArrowRight, IconCalendarClock } from '@/components/icons';
import { fetchFrameworkRequirements } from '@/lib/framework-requirements';

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
  /** Muda quando o escopo ou uma avaliacao muda, forcando recarga. */
  refreshKey?: number;
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
  refreshKey = 0,
  onRequirementClick,
  onSeeAll,
}: PriorityQueueCardProps) {
  const { t } = useLanguage();
  const contextKey = `${empresaId}:${frameworkId}`;
  const [state, setState] = useState({ contextKey: '', items: [] as PriorityRequirement[], loading: true });
  const { items, loading } = state.contextKey === contextKey ? state : { items: [] as PriorityRequirement[], loading: true };

  useEffect(() => {
    if (!frameworkId || !empresaId) return;
    let cancelled = false;
    (async () => {
      // This card sits above the table. Collapsing it on every refresh moves
      // the user's reading position even if the table itself stays mounted.
      setState(previous => previous.contextKey === contextKey ? previous : { contextKey, items: [], loading: true });
      try {
        const [requirements, evalsRes] = await Promise.all([
          fetchFrameworkRequirements(frameworkId),
          supabase
            .from('gap_analysis_evaluations')
            .select('requirement_id, conformity_status, prazo_implementacao')
            .eq('framework_id', frameworkId)
            .eq('empresa_id', empresaId),
        ]);
        if (cancelled) return;
        if (evalsRes.error) throw evalsRes.error;
        const evalMap = new Map(
          (evalsRes.data || []).map(e => [e.requirement_id, e])
        );
        // Fila de trabalho: o que a empresa tirou do escopo no SoA não entra.
        // Aparecia aqui como prioridade 02, cobrando ação sobre um requisito
        // que a diretoria já tinha dispensado por escrito.
        const foraDoEscopo = await buscarForaDoEscopo(frameworkId, empresaId);
        if (cancelled) return;
        const scored = requirements.filter(r => !foraDoEscopo.has(r.id)).map(r => {
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
          // O peso continua a ordenar a fila, mas não precisa ser repetido em
          // todas as linhas: a posição 01, 02, 03 já comunica a prioridade.
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
        /*
          Desempate por código, sempre.

          No dia um todos os requisitos têm o mesmo estado, logo a prioridade
          reduz-se ao peso e há dezenas de empates. Sem critério de desempate a
          ordem vinha do banco, que não a garante: a mesma empresa via os "seis
          primeiros" trocarem a cada recarga. Numa lista que diz ao utilizador
          por onde começar, isso é o mesmo que não dizer nada.
        */
        scored.sort((a, b) =>
          b.priority - a.priority || (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }),
        );
        setState({ contextKey, items: scored.filter(s => s.priority > 0).slice(0, limit), loading: false });
      } catch (e) {
        logger.error('Erro ao montar fila de prioridade', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled) setState(previous => ({ ...previous, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  /*
    A chave que diz "o escopo mudou, recarrega".

    Depois de responder as 27 perguntas do assistente e declarar que a empresa
    nao tem escritorio proprio, a fila continuava a mandar tratar "Perimetro de
    seguranca fisica" e a tabela continuava a mostrar esses requisitos. O
    cabecalho e o painel de fases actualizavam; estes dois nao, porque so
    recarregavam por frameworkId/empresaId.

    O utilizador acabava de responder a vinte e sete perguntas e a tela dizia
    que nao tinham servido para nada.
  */
  }, [frameworkId, empresaId, limit, refreshKey]);

  // Mesma definição de "crítico" usada no cartão Gaps a Tratar e no dashboard.
  const totalCritical = useMemo(
    () => items.filter(i => isGapCritico(i)).length,
    [items]
  );

  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 3);

  return (
    <ExecutivePanel className="h-full">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="min-w-0 flex-1">
          <p className="executive-label">{t('executive.priorities')}</p>
          <h2 className="mt-1 text-base font-semibold">{t('gapV2.priorityQueue.title')}</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{t('executive.prioritiesHint')}</p>
        </div>
        {onSeeAll && <button type="button" onClick={onSeeAll} className="executive-row inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary">
          {t('gapV2.priorityQueue.seeAll')}<IconArrowRight className="h-3.5 w-3.5" />
        </button>}
      </header>
      {loading ? <div className="flex justify-center p-8"><AkurisPulse size={32} /></div>
        : items.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{t('gapV2.priorityQueue.emptyState')}</p>
        : <ol className="divide-y divide-border/60">
          {visible.map((item, idx) => {
            const overdue = isGapAtrasado(item.prazo_implementacao);
            const status = item.conformity_status === 'nao_conforme' || item.conformity_status === 'parcial' ? item.conformity_status : 'nao_avaliado';
            return <li key={item.id}>
              <button type="button" onClick={() => onRequirementClick({ id: item.id, codigo: item.codigo, titulo: item.titulo })}
                className="executive-row group flex w-full items-start gap-3 p-4 text-left">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-xs font-semibold tabular-nums text-primary">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs text-muted-foreground">{[item.codigo, item.categoria].filter(Boolean).join(' · ')}</span>
                  <span className="block text-sm font-semibold leading-5 group-hover:text-primary">{item.titulo}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t(`executive.priorityReason.${status}`)}</span>
                  {overdue && <span className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                    <IconCalendarClock className="h-3.5 w-3.5" />{t('gapV2.priorityQueue.overdue')}
                  </span>}
                </span>
                <IconArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </button>
            </li>;
          })}
        </ol>}
      {!loading && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2">
        <p className="text-xs text-muted-foreground">{totalCritical > 0 && <>{totalCritical} {t('gapV2.priorityQueue.footerSummary', { total: items.length })}</>}</p>
        {items.length > 3 && <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
          className="executive-row min-h-9 rounded-md px-2 text-xs font-medium text-primary">
          {expanded ? t('executive.showLess') : t('executive.showMore', { count: items.length - 3 })}
        </button>}
      </footer>}
    </ExecutivePanel>
  );
}
