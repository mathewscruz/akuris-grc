/**
 * DocumentsHero — strip editorial para a aba "Análise de Documentos".
 * Hero roxo com convite à IA + 4 KPIs compactos (analisados, conformidade
 * média, cláusulas cobertas, sem cobertura). Não substitui a view de
 * upload — fica acima dela como contextualização Akuris.
 */
import { useEffect, useState } from 'react';
import { AkurisAIIcon } from '@/components/icons';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { AIBadge } from './AIBadge';
import { KpiTiny } from './KpiTiny';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface Props {
  frameworkId: string;
  empresaId: string;
  onUploadClick?: () => void;
}

export function DocumentsHero({ frameworkId, empresaId, onUploadClick }: Props) {
  const [stats, setStats] = useState({
    analyzed: 0,
    avgConformity: 0,
    coveredClauses: 0,
    uncoveredClauses: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [asmtRes, reqsRes, evalsRes] = await Promise.all([
          supabase
            .from('gap_analysis_adherence_assessments')
            .select('id, score_aderencia')
            .eq('framework_id', frameworkId)
            .eq('empresa_id', empresaId),
          supabase
            .from('gap_analysis_requirements')
            .select('id')
            .eq('framework_id', frameworkId),
          supabase
            .from('gap_analysis_evaluations')
            .select('requirement_id, conformity_status')
            .eq('framework_id', frameworkId)
            .eq('empresa_id', empresaId),
        ]);

        const asmts = asmtRes.data || [];
        const reqs = reqsRes.data || [];
        const evals = evalsRes.data || [];
        const evalMap = new Map(evals.map(e => [e.requirement_id, e.conformity_status]));
        const covered = reqs.filter(r => {
          const s = evalMap.get(r.id);
          return s === 'conforme' || s === 'parcial';
        }).length;
        const uncovered = Math.max(0, reqs.length - covered);

        const scores = asmts
          .map((a: any) => Number(a.score_aderencia))
          .filter(n => Number.isFinite(n) && n > 0);
        const avg = scores.length
          ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
          : 0;

        if (alive) {
          setStats({
            analyzed: asmts.length,
            avgConformity: avg,
            coveredClauses: covered,
            uncoveredClauses: uncovered,
          });
        }
      } catch (err) {
        logger.error('DocumentsHero stats', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [frameworkId, empresaId]);

  return (
    <div className="space-y-4">
      <article className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/8 to-background p-6">
        <CornerAccent position="top-right" size={14} />
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <AkurisAIIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <AIBadge />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Análise de documentos
              </span>
            </div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">
              Suba o documento. A IA mapeia as cláusulas.
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              A Akuris extrai e cruza o conteúdo com os requisitos do framework, sugere status,
              identifica cláusulas cobertas e aponta gaps para tratar na remediação.
            </p>
          </div>
          {onUploadClick && (
            <button
              type="button"
              onClick={onUploadClick}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Enviar documento
            </button>
          )}
        </div>
      </article>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTiny eyebrow="ANALISADOS" value={stats.analyzed} foot="documentos" />
        <KpiTiny
          eyebrow="CONFORMIDADE"
          value={stats.avgConformity ? `${stats.avgConformity}%` : '—'}
          foot="média das análises"
          tone={
            stats.avgConformity >= 70
              ? 'success'
              : stats.avgConformity >= 40
              ? 'warning'
              : 'neutral'
          }
        />
        <KpiTiny
          eyebrow="COBERTAS"
          value={stats.coveredClauses}
          foot="cláusulas atendidas"
          tone="success"
        />
        <KpiTiny
          eyebrow="SEM COBERTURA"
          value={stats.uncoveredClauses}
          foot="cláusulas pendentes"
          tone={stats.uncoveredClauses > 0 ? 'warning' : 'neutral'}
        />
      </div>
    </div>
  );
}
