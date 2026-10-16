/**
 * DocumentsHero — Onda 5 redesenhada (img 254):
 * Grid 2 colunas: convite + ações à esquerda, "Tipos sugeridos" à direita.
 * 4 KPIs com listra esquerda abaixo. Identidade Akuris.
 */
import { useEffect, useState } from 'react';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { StatStrip } from '@/components/ui/stat-strip';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconUpload } from '@/components/icons';

import { formatarDiaParaDB } from '@/lib/date-utils';
interface Props {
  frameworkId: string;
  empresaId: string;
  /** Sem arquivo abre o diálogo; com arquivo (arrastado) já o entrega ao diálogo. */
  onUploadClick?: (file?: File) => void;
  frameworkNome?: string;
  /** Abre o gerador de documentos com o contexto deste framework. */
  onAIGenerate?: () => void;
}

interface SuggestedType {
  label: string;
  covers: string;
  status: string;
}

export function DocumentsHero({ frameworkId, empresaId, onUploadClick, onAIGenerate, frameworkNome }: Props) {
  const [arrastando, setArrastando] = useState(false);
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
            /*
              A coluna chama-se `percentual_conformidade`.

              Isto pedia `score_aderencia`, que nunca existiu: o PostgREST
              respondia 400, o erro não era lido em lado nenhum, `data` vinha
              null e os dois indicadores do topo — "documentos analisados" e
              "conformidade média" — ficavam em 0 e "—" para sempre. Ao lado,
              na mesma aba, a lista de "Avaliações Recentes" mostrava a análise
              concluída com 67%. A tela contradizia-se e ninguém via porquê.
            */
            .select('id, percentual_conformidade')
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

        /*
          Consulta falhada não é "não há nada".

          Os três indicadores desta aba são números que o utilizador lê como
          facto. Se a leitura falhar, é melhor rebentar aqui e cair no catch —
          que regista no log — do que desenhar zeros com ar de verdade.
        */
        const erro = asmtRes.error || reqsRes.error || evalsRes.error;
        if (erro) throw erro;

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
        const hoje = formatarDiaParaDB(new Date());
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
          .map((a: any) => Number(a.percentual_conformidade))
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
            label: cat,
            covers: String(codes.length),
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

  const k = (s: string, p?: Record<string, string | number>) => t(`gapAnalysis.v2.documentsHero.v3.${s}`, p);
  const pctCobertura = stats.totalReqs ? Math.round((stats.coveredClauses / stats.totalReqs) * 100) : 0;

  return (
    <div className="space-y-4">
      <article className="relative overflow-hidden rounded-lg border border-border bg-card animate-in fade-in slide-in-from-bottom-2 duration-500">
        <CornerAccent position="top-right" size={14} />
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k('eyebrow')}</p>
            <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-foreground">
              {k('title', { norma: frameworkNome || '' })}
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{k('description')}</p>
            <button
              type="button"
              onClick={onAIGenerate}
              className="mt-4 text-sm text-primary underline-offset-4 transition-colors hover:underline"
            >
              {k('noPolicy')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onUploadClick?.()}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onUploadClick?.(f);
            }}
            className={cn(
              'group flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors',
              arrastando ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent',
            )}
          >
            <span className={cn('flex h-11 w-11 items-center justify-center rounded-full border bg-background transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transform-none', arrastando && '-translate-y-0.5')}>
              <IconUpload className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </span>
            <span className="text-sm font-medium text-foreground">{arrastando ? k('dropNow') : k('drop')}</span>
            <span className="text-xs text-muted-foreground">{k('formats')}</span>
          </button>
        </div>
      </article>

      <StatStrip
        items={[
          { key: 'analisadas', label: k('kpiAnalyzed'), value: stats.analyzed },
          { key: 'media', label: k('kpiAvg'), value: stats.avgConformity ? `${stats.avgConformity}%` : '—' },
          { key: 'cobertos', label: k('kpiCovered'), value: `${stats.coveredClauses}/${stats.totalReqs}`, context: k('kpiCoveredCtx', { pct: pctCobertura }) },
          {
            key: 'sem', label: k('kpiUncovered'), value: stats.uncoveredClauses,
            tone: stats.uncoveredClauses > 0 ? 'warning' : undefined,
            context: stats.expiredClauses > 0 ? t('gapAnalysis.v2.documentsHero.kpiUncoveredFootExpired', { count: stats.expiredClauses }) : undefined,
          },
        ]}
      />

      {suggested.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 animate-in fade-in duration-500">
          <span className="mr-1 text-xs text-muted-foreground">{k('missingDocs')}</span>
          {suggested.map((s, i) => (
            <button key={i} type="button" onClick={onAIGenerate} title={k('generateFor', { tema: s.label })}
              className="rounded-full transition-opacity hover:opacity-80">
              <Chip family="category">{k('missingChip', { tema: s.label, n: s.covers })}</Chip>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
