/**
 * DocumentsHero — Onda 5 redesenhada (img 254):
 * Grid 2 colunas: convite + ações à esquerda, "Tipos sugeridos" à direita.
 * 4 KPIs com listra esquerda abaixo. Identidade Akuris.
 */
import { useEffect, useState } from 'react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { KpiTiny } from './KpiTiny';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconUpload, IconLink } from '@/components/icons';

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
  status: string;
}

export function DocumentsHero({ frameworkId, empresaId, onUploadClick, onLinkClick, onAIGenerate }: Props) {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    analyzed: 0,
    avgConformity: 0,
    coveredClauses: 0,
    uncoveredClauses: 0,
    expiredClauses: 0,
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
            .select('id, requirement_id, conformity_status, evidence_files')
            .eq('framework_id', frameworkId)
            .eq('empresa_id', empresaId),
        ]);

        const asmts = asmtRes.data || [];
        const reqs = reqsRes.data || [];
        const evals = evalsRes.data || [];
        // Cobertura DOCUMENTAL é ter documento, não estar conforme.
        //
        // Isto contava requisitos com status `conforme` ou `parcial` e chamava o
        // resultado de "cláusulas cobertas", numa aba onde o indicador ao lado
        // dizia "documentos analisados: 0". Um requisito conforme sem nenhum
        // anexo aparecia como coberto, e a tela mandava fazer upload justamente
        // para os que não eram conformes — que é outra pergunta.
        //
        // Agora conta o que a palavra diz: requisitos com pelo menos uma
        // evidência ligada, seja da biblioteca reutilizável, seja anexada na
        // própria avaliação.
        const evalIds = evals.map(e => (e as { id?: string }).id).filter(Boolean) as string[];
        const [linksRes, evidRes] = await Promise.all([
          supabase
            .from('evidence_library_links')
            // A validade vem junto: prova caducada não cobre requisito nenhum.
            .select('requirement_id, evidence_library(valido_ate)')
            .eq('empresa_id', empresaId)
            .eq('framework_id', frameworkId),
          evalIds.length
            ? supabase
                .from('gap_analysis_evidences')
                .select('evaluation_id')
                .in('evaluation_id', evalIds)
            : Promise.resolve({ data: [] as { evaluation_id: string }[] }),
        ]);

        const reqPorAvaliacao = new Map(
          evals.map(e => [(e as { id?: string }).id, e.requirement_id]),
        );
        const comEvidencia = new Set<string>();
        // Requisitos cuja única prova da biblioteca já caducou. É a diferença
        // entre "tem documento" e "tem documento que ainda vale" — numa
        // auditoria de manutenção é exatamente essa a pergunta.
        const soComEvidenciaVencida = new Set<string>();
        const hoje = new Date().toISOString().slice(0, 10);
        (linksRes.data || []).forEach(l => {
          if (!l.requirement_id) return;
          const validade = (l as { evidence_library?: { valido_ate?: string | null } | null })
            .evidence_library?.valido_ate;
          if (validade && validade < hoje) {
            soComEvidenciaVencida.add(l.requirement_id);
            return;
          }
          comEvidencia.add(l.requirement_id);
        });
        (evidRes.data || []).forEach(ev => {
          const reqId = reqPorAvaliacao.get(ev.evaluation_id);
          if (reqId) comEvidencia.add(reqId);
        });
        // Terceira origem, e a mais usada de todas: o anexo feito no próprio
        // diálogo de triagem, que fica em `evidence_files` na avaliação e não
        // passa pela biblioteca. Contar só as duas primeiras deixaria de fora
        // justamente o caminho mais curto que o produto oferece.
        evals.forEach(e => {
          const arquivos = (e as { evidence_files?: unknown }).evidence_files;
          if (Array.isArray(arquivos) && arquivos.length > 0) comEvidencia.add(e.requirement_id);
        });

        const covered = reqs.filter(r => comEvidencia.has(r.id)).length;
        const uncovered = Math.max(0, reqs.length - covered);
        const vencidos = reqs.filter(
          r => !comEvidencia.has(r.id) && soComEvidenciaVencida.has(r.id),
        ).length;

        const scores = asmts
          .map((a: any) => Number(a.score_aderencia))
          .filter(n => Number.isFinite(n) && n > 0);
        const avg = scores.length
          ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
          : 0;

        // Tipos sugeridos: agrupa por categoria os requisitos que estão mesmo
        // sem documento — antes agrupava os que não estavam conformes.
        const uncoveredByCat = new Map<string, string[]>();
        reqs.forEach(r => {
          if (comEvidencia.has(r.id)) return;
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
            label: t('gapAnalysis.v2.documentsHero.documentOf', { category: cat }),
            covers: codes.length > 3
              ? `~${codes.length} requisitos`
              : codes.slice(0, 3).join(', '),
            status: t('gapAnalysis.v2.documentsHero.missing'),
          }));

        if (alive) {
          setStats({
            analyzed: asmts.length,
            avgConformity: avg,
            coveredClauses: covered,
            uncoveredClauses: uncovered,
            expiredClauses: vencidos,
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
      <article className="relative overflow-hidden rounded-lg border border-border bg-card">
        <CornerAccent position="top-right" size={14} />
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
          {/* Convite */}
          <div className="p-6">
            <h3 className="mt-2 text-xl font-semibold tracking-tight leading-snug text-foreground">
              {t('gapAnalysis.v2.documentsHero.heroTitle')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
              {t('gapAnalysis.v2.documentsHero.heroDescriptionLine1')}<br />
              {t('gapAnalysis.v2.documentsHero.heroDescriptionLine2', { count: stats.totalReqs })}
            </p>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <IconUpload className="h-4 w-4" strokeWidth={1.5} />
                {t('gapAnalysis.v2.documentsHero.attachFiles')}
              </button>
              <button
                type="button"
                onClick={onLinkClick}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground hover:border-primary/40 transition-colors"
              >
                <IconLink className="h-4 w-4" strokeWidth={1.5} />
                {t('gapAnalysis.v2.documentsHero.addLink')}
              </button>
              <button
                type="button"
                onClick={onAIGenerate}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                {t('gapAnalysis.v2.documentsHero.generateWithAi')}
              </button>
            </div>
          </div>

          {/* Lacunas documentais detectadas */}
          <aside className="p-6 border-t lg:border-t-0 lg:border-l border-border/60 bg-muted/20">
            <div className="text-xs text-muted-foreground">
              {t('gapAnalysis.v2.documentsHero.gapsDetectedTitle')}
            </div>
            <ul className="mt-3 space-y-2.5">
              {suggested.length === 0 ? (
                <li className="text-xs text-muted-foreground italic">
                  {t('gapAnalysis.v2.documentsHero.noGaps')}
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
                        <span className="text-xs text-destructive shrink-0">
                          {s.status}
                        </span>
                      </div>
                      <div className="text-micro text-muted-foreground truncate">
                        {t('gapAnalysis.v2.documentsHero.covers', { items: s.covers })}
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
          eyebrow={t('gapAnalysis.v2.documentsHero.kpiAnalyzed')}
          value={stats.analyzed}
          foot={t('gapAnalysis.v2.documentsHero.kpiAnalyzedFoot')}
          tone="info"
        />
        <KpiTiny
          eyebrow={t('gapAnalysis.v2.documentsHero.kpiAvgCompliance')}
          value={stats.avgConformity ? `${stats.avgConformity}%` : '—'}
          foot={t('gapAnalysis.v2.documentsHero.kpiAvgComplianceFoot')}
          tone={
            stats.avgConformity >= 70 ? 'success' :
            stats.avgConformity >= 40 ? 'warning' : 'neutral'
          }
        />
        <KpiTiny
          eyebrow={t('gapAnalysis.v2.documentsHero.kpiCoveredClauses')}
          value={`${stats.coveredClauses}/${stats.totalReqs}`}
          foot={stats.totalReqs > 0 ? t('gapAnalysis.v2.documentsHero.kpiCoveredClausesFoot', { pct: Math.round((stats.coveredClauses / stats.totalReqs) * 100) }) : '—'}
          tone="warning"
        />
        <KpiTiny
          eyebrow={t('gapAnalysis.v2.documentsHero.kpiUncovered')}
          value={stats.uncoveredClauses}
          foot={
            stats.expiredClauses > 0
              ? t('gapAnalysis.v2.documentsHero.kpiUncoveredFootExpired', { count: stats.expiredClauses })
              : stats.uncoveredClauses > 0
                ? t('gapAnalysis.v2.documentsHero.kpiUncoveredFootPending')
                : t('gapAnalysis.v2.documentsHero.kpiUncoveredFootDone')
          }
          tone={stats.uncoveredClauses > 0 ? 'destructive' : 'success'}
        />
      </div>
    </div>
  );
}
