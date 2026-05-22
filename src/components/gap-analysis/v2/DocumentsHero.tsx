/**
 * DocumentsHero — Onda 5 redesenhada (img 254):
 * Grid 2 colunas: convite + ações à esquerda, "Tipos sugeridos" à direita.
 * 4 KPIs com listra esquerda abaixo. Identidade Akuris.
 */
import { useEffect, useState } from 'react';
import { Sparkles, Upload, Link as LinkIcon, FileText } from 'lucide-react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { KpiTiny } from './KpiTiny';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface Props {
  frameworkId: string;
  empresaId: string;
  onUploadClick?: () => void;
  onLinkClick?: () => void;
  onAIGenerate?: () => void;
}

interface SuggestedType {
  label: string;
  covers: string;
  status: 'FALTA' | 'OK';
}

export function DocumentsHero({ frameworkId, empresaId, onUploadClick, onLinkClick, onAIGenerate }: Props) {
  const [stats, setStats] = useState({
    analyzed: 0,
    avgConformity: 0,
    coveredClauses: 0,
    uncoveredClauses: 0,
    totalReqs: 0,
  });
  const [suggested, setSuggested] = useState<SuggestedType[]>([]);

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
            .select('id, codigo, categoria')
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

        // Tipos sugeridos: agrupa requisitos sem cobertura por categoria
        const uncoveredByCat = new Map<string, string[]>();
        reqs.forEach(r => {
          const s = evalMap.get(r.id);
          if (s === 'conforme' || s === 'parcial') return;
          const cat = r.categoria || 'Outros';
          const arr = uncoveredByCat.get(cat) || [];
          if (r.codigo) arr.push(r.codigo);
          uncoveredByCat.set(cat, arr);
        });
        const top = Array.from(uncoveredByCat.entries())
          .filter(([, codes]) => codes.length > 0)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 4)
          .map<SuggestedType>(([cat, codes]) => ({
            label: `Documento de ${cat}`,
            covers: codes.length > 3
              ? `~${codes.length} requisitos`
              : codes.slice(0, 3).join(', '),
            status: 'FALTA',
          }));

        if (alive) {
          setStats({
            analyzed: asmts.length,
            avgConformity: avg,
            coveredClauses: covered,
            uncoveredClauses: uncovered,
            totalReqs: reqs.length,
          });
          setSuggested(top);
        }
      } catch (err) {
        logger.error('DocumentsHero stats', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => { alive = false; };
  }, [frameworkId, empresaId]);

  return (
    <div className="space-y-4">
      <article className="relative overflow-hidden rounded-xl border border-border bg-card">
        <CornerAccent position="top-right" size={14} />
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
          {/* Convite */}
          <div className="p-6">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-sans uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" strokeWidth={1.5} />
              Análise automatizada
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight leading-snug text-foreground">
              Suba um documento. A IA mapeia em qualquer requisito que ele atenda.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
              Você não precisa decidir a que cláusula o documento se aplica.<br />
              Anexe — PDF, Word, Excel — e a IA cruza com os <strong className="text-foreground">{stats.totalReqs} requisitos</strong>{' '}
              do framework, propondo status, justificativa e evidências.
            </p>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-4 w-4" strokeWidth={1.5} />
                Anexar arquivos
              </button>
              <button
                type="button"
                onClick={onLinkClick}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground hover:border-primary/40 transition-colors"
              >
                <LinkIcon className="h-4 w-4" strokeWidth={1.5} />
                Adicionar link / URL
              </button>
              <button
                type="button"
                onClick={onAIGenerate}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                Gerar com IA
              </button>
            </div>
          </div>

          {/* Lacunas documentais detectadas */}
          <aside className="p-6 border-t lg:border-t-0 lg:border-l border-border/60 bg-muted/20">
            <div className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
              Lacunas documentais detectadas
            </div>
            <ul className="mt-3 space-y-2.5">
              {suggested.length === 0 ? (
                <li className="text-xs text-muted-foreground italic">
                  Sem lacunas documentais — todos os requisitos têm cobertura inicial.
                </li>
              ) : (
                suggested.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {s.label}
                        </span>
                        <span className="text-[10px] font-sans uppercase tracking-wider text-destructive shrink-0">
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        cobre {s.covers}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      </article>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTiny
          eyebrow="DOCUMENTOS ANALISADOS"
          value={stats.analyzed}
          foot="últimos 30 dias"
          tone="info"
        />
        <KpiTiny
          eyebrow="CONFORMIDADE MÉDIA"
          value={stats.avgConformity ? `${stats.avgConformity}%` : '—'}
          foot="média das análises"
          tone={
            stats.avgConformity >= 70 ? 'success' :
            stats.avgConformity >= 40 ? 'warning' : 'neutral'
          }
        />
        <KpiTiny
          eyebrow="CLÁUSULAS COBERTAS"
          value={`${stats.coveredClauses}/${stats.totalReqs}`}
          foot={stats.totalReqs > 0 ? `${Math.round((stats.coveredClauses / stats.totalReqs) * 100)}% do framework` : '—'}
          tone="warning"
        />
        <KpiTiny
          eyebrow="SEM COBERTURA DOCUMENTAL"
          value={stats.uncoveredClauses}
          foot={stats.uncoveredClauses > 0 ? 'requer upload' : 'completo'}
          tone={stats.uncoveredClauses > 0 ? 'destructive' : 'success'}
        />
      </div>
    </div>
  );
}
