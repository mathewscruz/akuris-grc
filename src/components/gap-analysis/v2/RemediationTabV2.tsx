/**
 * RemediationTabV2 — Onda 5+ Akuris (equalizada ao mockup img 255).
 * 4 KPIs editoriais + Sugestões IA com segment (causa-raiz/seção/esforço) +
 * cards de cluster com chips de códigos + Kanban com toggle Quadro/Lista/Timeline.
 * Mantém identidade Navy/Purple, tokens semânticos, AkurisPulse.
 */
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ArrowRight, ClipboardList, Sparkles, LayoutGrid, List, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolvePrioridadeTone } from '@/lib/status-tone';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

  const [grouping, setGrouping] = useState<'causa' | 'secao' | 'esforco'>('causa');
  const [boardView, setBoardView] = useState<'quadro' | 'lista' | 'timeline'>('quadro');

  const aiClusters = useMemo(() => {
    if (grouping === 'esforco') {
      // Buckets por esforço (1, 2-4, 5+) atravessando categorias
      const buckets: Array<{ key: string; label: string; items: NaoConformeReq[] }> = [
        { key: 'baixo', label: 'Esforço Baixo', items: [] },
        { key: 'medio', label: 'Esforço Médio', items: [] },
        { key: 'alto', label: 'Esforço Alto', items: [] },
      ];
      naoConformes.forEach(r => {
        const peso = Number(r.peso) || 1;
        if (peso <= 1) buckets[0].items.push(r);
        else if (peso <= 3) buckets[1].items.push(r);
        else buckets[2].items.push(r);
      });
      return buckets
        .filter(b => b.items.length >= 2)
        .slice(0, 3)
        .map(b => ({
          categoria: b.label,
          items: b.items,
          peso: b.items.reduce((s, r) => s + (Number(r.peso) || 1), 0),
          esforco: b.key === 'baixo' ? 'L' : b.key === 'medio' ? 'M' : 'H',
          dias: Math.min(90, 7 * b.items.length),
        }));
    }
    // 'causa' e 'secao' ambos agrupam por categoria — diferença é apenas semântica
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
        const esforco = items.length <= 2 ? 'L' : items.length <= 5 ? 'M' : 'H';
        const dias = Math.min(90, 7 * items.length);
        return { categoria, items, peso, esforco, dias };
      });
  }, [naoConformes, grouping]);

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
          eyebrow="PLANOS CONSOLIDADOS"
          value={aiClusters.length}
          foot={aiClusters.length > 0
            ? `cobre ${aiClusters.reduce((s, c) => s + c.items.length, 0)} gaps`
            : 'sem agrupamentos'}
          tone="primary"
        />
        <KpiTiny
          eyebrow="EM EXECUÇÃO"
          value={kpis.emExecucao}
          foot="planos ativos"
          tone="info"
        />
        <KpiTiny
          eyebrow="IMPACTO POTENCIAL"
          value={`+${kpis.impactoPotencial}pts`}
          foot="se aplicar todos os planos"
          tone={kpis.impactoPotencial > 0 ? 'success' : 'neutral'}
        />
      </div>

      {/* Planos consolidados */}
      {aiClusters.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SectionHead
              title="Planos consolidados"
              count={aiClusters.length}
            />
            <SegmentToggle
              value={grouping}
              onChange={(v) => setGrouping(v as 'causa' | 'secao' | 'esforco')}
              options={[
                { value: 'causa', label: 'Por causa-raiz' },
                { value: 'secao', label: 'Por seção' },
                { value: 'esforco', label: 'Por esforço' },
              ]}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            <Sparkles className="inline h-3 w-3 mr-1 text-primary" strokeWidth={1.5} />
            Seus <strong className="text-foreground">{naoConformes.length} gaps</strong> foram agrupados em{' '}
            <strong className="text-foreground">{aiClusters.length} planos consolidados</strong>{' '}
            que cobrem <strong className="text-foreground">{aiClusters.reduce((s, c) => s + c.items.length, 0)} requisitos</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiClusters.map(c => (
              <article
                key={c.categoria}
                className="relative overflow-hidden rounded-xl border border-primary/30 bg-card p-4"
              >
                <CornerAccent position="top-right" size={10} />
                <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-primary" />
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
                  Cobre {c.items.length} requisitos
                </div>
                <h4 className="mt-1 text-sm font-semibold leading-snug">
                  {grouping === 'esforco' ? `Plano consolidado · ${c.categoria}` : `Tratar ${c.categoria}`}
                </h4>
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                  {grouping === 'esforco'
                    ? 'Agrupamento por carga estimada — execute em paralelo para otimizar entrega.'
                    : 'Causa-raiz comum identificada. Um único plano pode endereçar todos os requisitos.'}
                </p>

                {/* Chips de códigos */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.items.slice(0, 5).map(r => (
                    <span
                      key={r.id}
                      className="inline-flex items-center rounded border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[10px] font-mono text-destructive"
                    >
                      {r.codigo || '—'}
                    </span>
                  ))}
                  {c.items.length > 5 && (
                    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      +{c.items.length - 5}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span><strong className="text-foreground">{c.esforco}</strong> esforço</span>
                  <span>·</span>
                  <span><strong className="text-foreground">{c.dias}d</strong> estimado</span>
                  <span>·</span>
                  <span className="text-success">+{c.peso} pts impacto</span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/planos-acao')}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Criar plano
                  <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Kanban */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionHead
            title="Planos de ação"
            count={planos.length}
          />
          <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
            <ViewBtn icon={LayoutGrid} active={boardView === 'quadro'} onClick={() => setBoardView('quadro')}>
              Quadro
            </ViewBtn>
            <ViewBtn icon={List} active={boardView === 'lista'} onClick={() => setBoardView('lista')} disabled>
              Lista
            </ViewBtn>
            <ViewBtn icon={GitBranch} active={boardView === 'timeline'} onClick={() => setBoardView('timeline')} disabled>
              Timeline
            </ViewBtn>
          </div>
        </div>

        {planos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium">Crie um plano de ação a partir de um requisito não conforme.</p>
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
                    <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      <span className={cn('h-1.5 w-1.5 rounded-full', COL_DOT[col.key])} />
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
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
                          <StatusBadge size="sm" {...resolvePrioridadeTone(p.prioridade)}>
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
                      <p className="text-[11px] text-muted-foreground/60 italic px-1">—</p>
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

const COL_DOT: Record<string, string> = {
  a_iniciar: 'bg-destructive',
  em_andamento: 'bg-info',
  em_revisao: 'bg-warning',
  concluido: 'bg-success',
};

function SegmentToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs transition-colors',
            value === opt.value
              ? 'bg-foreground text-background font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ViewBtn({
  icon: Icon,
  active,
  onClick,
  disabled,
  children,
}: {
  icon: typeof LayoutGrid;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const btn = (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors',
        active ? 'bg-foreground text-background font-medium' : 'text-muted-foreground hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed hover:text-muted-foreground'
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={1.5} />
      {children}
    </button>
  );
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent><span className="text-xs">Em breve</span></TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}
