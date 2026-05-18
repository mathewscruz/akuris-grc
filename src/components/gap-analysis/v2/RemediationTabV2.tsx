/**
 * RemediationTabV2 — Onda 5 Akuris.
 * 4 KPIs editoriais + Sugestões IA (causa-raiz, client-side por categoria)
 * + Kanban de 4 colunas (A iniciar / Em andamento / Em revisão / Concluído).
 * Mantém identidade Navy/Purple, tokens semânticos, AkurisPulse.
 */
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ArrowRight, ClipboardList, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolvePrioridadeTone } from '@/lib/status-tone';
import { KpiTiny } from './KpiTiny';
import { AIBadge } from './AIBadge';
import { SectionHead } from './SectionHead';
import { CornerAccent } from '@/components/identity/CornerAccent';

interface Props {
  frameworkId: string;
  frameworkName: string;
}

interface PlanoAcao {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  prazo: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  requirement_id: string;
  requirement_codigo: string;
  requirement_titulo: string;
  requirement_categoria: string | null;
}

interface NaoConformeReq {
  id: string;
  codigo: string;
  titulo: string;
  categoria: string;
  peso: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'A iniciar',
  em_andamento: 'Em andamento',
  em_revisao: 'Em revisão',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  atrasado: 'Atrasado',
};

const COLUMNS: Array<{ key: string; label: string; match: (s: string) => boolean }> = [
  { key: 'a_iniciar', label: 'A iniciar', match: (s) => s === 'pendente' },
  { key: 'em_andamento', label: 'Em andamento', match: (s) => s === 'em_andamento' || s === 'atrasado' },
  { key: 'em_revisao', label: 'Em revisão', match: (s) => s === 'em_revisao' },
  { key: 'concluido', label: 'Concluído', match: (s) => s === 'concluido' },
];

export function RemediationTabV2({ frameworkId, frameworkName }: Props) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [naoConformes, setNaoConformes] = useState<NaoConformeReq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId || !frameworkId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [evalsRes, reqsRes] = await Promise.all([
          supabase
            .from('gap_analysis_evaluations')
            .select('plano_acao_id, requirement_id, conformity_status')
            .eq('framework_id', frameworkId)
            .eq('empresa_id', empresaId),
          supabase
            .from('gap_analysis_requirements')
            .select('id, codigo, titulo, categoria, peso')
            .eq('framework_id', frameworkId),
        ]);

        const evals = evalsRes.data || [];
        const reqs = reqsRes.data || [];
        const reqMap = new Map(reqs.map(r => [r.id, r]));

        const planoIds = evals.map(e => e.plano_acao_id).filter(Boolean) as string[];
        const planoToReq = new Map(
          evals
            .filter(e => e.plano_acao_id)
            .map(e => [e.plano_acao_id as string, e.requirement_id])
        );

        let planosOut: PlanoAcao[] = [];
        if (planoIds.length) {
          const { data: pl } = await supabase
            .from('planos_acao')
            .select('id, titulo, descricao, status, prioridade, prazo, responsavel_id')
            .in('id', planoIds);

          const respIds = (pl || [])
            .map(p => p.responsavel_id)
            .filter(Boolean) as string[];
          const profMap = new Map<string, string>();
          if (respIds.length) {
            const { data: profs } = await supabase
              .from('profiles')
              .select('user_id, nome')
              .in('user_id', respIds);
            (profs || []).forEach((p: any) => profMap.set(p.user_id, p.nome));
          }

          planosOut = (pl || []).map(p => {
            const reqId = planoToReq.get(p.id);
            const req = reqId ? reqMap.get(reqId) : null;
            return {
              ...p,
              responsavel_nome: p.responsavel_id ? (profMap.get(p.responsavel_id) || null) : null,
              requirement_id: reqId || '',
              requirement_codigo: req?.codigo || '',
              requirement_titulo: req?.titulo || '',
              requirement_categoria: req?.categoria || null,
            };
          });
        }

        const planRequirementIds = new Set(planosOut.map(p => p.requirement_id));
        const ncReqs: NaoConformeReq[] = evals
          .filter(e => e.conformity_status === 'nao_conforme' && !planRequirementIds.has(e.requirement_id))
          .map(e => reqMap.get(e.requirement_id))
          .filter(Boolean)
          .map((r: any) => ({
            id: r.id,
            codigo: r.codigo || '',
            titulo: r.titulo,
            categoria: r.categoria || 'Outros',
            peso: r.peso,
          }));

        if (alive) {
          setPlanos(planosOut);
          setNaoConformes(ncReqs);
        }
      } catch (e) {
        logger.error('RemediationTabV2 load', { error: e instanceof Error ? e.message : String(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [empresaId, frameworkId]);

  const kpis = useMemo(() => {
    const gapsAbertos = naoConformes.length;
    const sugeridosIA = new Set(naoConformes.map(r => r.categoria)).size;
    const emExecucao = planos.filter(p => p.status === 'em_andamento' || p.status === 'em_revisao').length;
    const impactoPotencial = naoConformes.reduce((s, r) => s + (Number(r.peso) || 1), 0);
    return { gapsAbertos, sugeridosIA, emExecucao, impactoPotencial };
  }, [planos, naoConformes]);

  const aiClusters = useMemo(() => {
    const byCat = new Map<string, NaoConformeReq[]>();
    naoConformes.forEach(r => {
      const arr = byCat.get(r.categoria) || [];
      arr.push(r);
      byCat.set(r.categoria, arr);
    });
    return Array.from(byCat.entries())
      .filter(([, items]) => items.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([categoria, items]) => {
        const peso = items.reduce((s, r) => s + (Number(r.peso) || 1), 0);
        const esforco = items.length <= 2 ? 'Baixo' : items.length <= 5 ? 'Médio' : 'Alto';
        const dias = Math.min(90, 7 * items.length);
        return { categoria, items, peso, esforco, dias };
      });
  }, [naoConformes]);

  if (loading) {
    return (
      <div className="min-h-[280px] flex flex-col items-center justify-center gap-3">
        <AkurisPulse size={56} />
        <p className="text-sm text-muted-foreground">Carregando remediação...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTiny
          eyebrow="GAPS ABERTOS"
          value={kpis.gapsAbertos}
          foot="requisitos não conformes"
          tone={kpis.gapsAbertos > 0 ? 'destructive' : 'success'}
        />
        <KpiTiny
          eyebrow="SUGERIDOS IA"
          value={kpis.sugeridosIA}
          foot="agrupamentos por causa-raiz"
          tone="primary"
        />
        <KpiTiny
          eyebrow="EM EXECUÇÃO"
          value={kpis.emExecucao}
          foot="planos em andamento"
          tone="info"
        />
        <KpiTiny
          eyebrow="IMPACTO"
          value={kpis.impactoPotencial}
          foot="peso potencial a recuperar"
          tone={kpis.impactoPotencial > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Sugestões IA */}
      {aiClusters.length > 0 && (
        <section className="space-y-3">
          <SectionHead
            title="Sugestões IA por causa-raiz"
            count={aiClusters.length}
            rightSlot={<AIBadge />}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiClusters.map(c => (
              <article
                key={c.categoria}
                className="relative overflow-hidden rounded-xl border border-primary/30 bg-card p-4"
              >
                <CornerAccent position="top-right" size={10} />
                <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-primary" />
                <div className="text-[10px] font-mono uppercase tracking-wider text-primary">
                  PLANO CONSOLIDADO
                </div>
                <h4 className="mt-1 text-sm font-semibold leading-snug">
                  Tratar {c.items.length} gaps em {c.categoria}
                </h4>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  Causa-raiz comum identificada. Um único plano pode endereçar todos os requisitos.
                </p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Esforço: <strong className="text-foreground">{c.esforco}</strong></span>
                  <span>·</span>
                  <span><strong className="text-foreground">{c.dias}</strong> dias</span>
                  <span>·</span>
                  <span>Impacto <strong className="text-foreground">{c.peso}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/planos-acao')}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:gap-1.5 transition-all"
                >
                  <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                  Criar plano consolidado
                  <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Kanban */}
      <section className="space-y-3">
        <SectionHead
          title={`Quadro de remediação · ${frameworkName}`}
          count={planos.length}
        />
        {planos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium">Nenhum plano de ação vinculado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Marque requisitos como "Não Conforme" e crie planos de ação a partir do drawer do requisito.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLUMNS.map(col => {
              const items = planos.filter(p => col.match(p.status));
              return (
                <div key={col.key} className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      {col.label}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {items.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate('/planos-acao')}
                        className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {p.requirement_codigo}
                          </span>
                          <StatusBadge size="sm" {...resolvePriorityTone(p.prioridade)}>
                            {p.prioridade}
                          </StatusBadge>
                        </div>
                        <p className="text-xs font-medium leading-snug line-clamp-2">{p.titulo}</p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate">
                            {p.responsavel_nome || 'Sem responsável'}
                          </span>
                          {p.prazo && (
                            <span
                              className={
                                new Date(p.prazo) < new Date() && p.status !== 'concluido'
                                  ? 'text-destructive font-medium'
                                  : ''
                              }
                            >
                              {new Date(p.prazo).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary mt-1" strokeWidth={1.5} />
                      </button>
                    ))}
                    {items.length === 0 && (
                      <p className="text-[11px] text-muted-foreground/60 italic px-1">Vazio</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
