import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { FrameworkConfig, NIST_PILLAR_NAMES } from '@/lib/framework-configs';
import { tGlobal } from '@/lib/i18n-global';
import { fetchFrameworkRequirements, type FrameworkRequirement } from '@/lib/framework-requirements';
import { calcularScoreFramework } from '@/lib/gap-score';
import { readAllPages } from '@/lib/read-all-pages';

interface GroupScore { score: number; totalRequirements: number; evaluatedRequirements: number }
interface FrameworkScore {
  overallScore: number;
  pillarScores: (GroupScore & { pillar: string; name: string; color: string })[];
  domainScores: (GroupScore & { domain: string; name: string; color: string })[];
  areaScores: (GroupScore & { area: string; total: number; evaluated: number })[];
  sectionScores: (GroupScore & { section: string; name: string })[];
  categoryScores: { category: string; score: number; total: number; evaluated: number }[];
  totalRequirements: number;
  /** Full catalog, including N/A. Use totalRequirements for score/coverage only. */
  catalogRequirements: number;
  evaluatedRequirements: number;
  loading: boolean;
  error: Error | null;
}
const COLORS: Record<string, string> = {
  GOVERN: '#3b82f6', IDENTIFY: '#10b981', PROTECT: '#f59e0b', DETECT: '#ef4444', RESPOND: '#8b5cf6', RECOVER: '#06b6d4',
  'Governança': '#3b82f6', 'Gestão de Riscos': '#10b981', 'Segurança': '#f59e0b',
  'Conformidade': '#ef4444', 'Monitoramento': '#8b5cf6', 'Auditoria': '#06b6d4', 'Operações': '#ec4899',
};
const EMPTY: FrameworkScore = {
  overallScore: 0, pillarScores: [], domainScores: [], areaScores: [], sectionScores: [], categoryScores: [],
  totalRequirements: 0, catalogRequirements: 0, evaluatedRequirements: 0, loading: true, error: null,
};

/** All chart/PDF groups use the same weighted, applicable-scope calculation as the list. */
export function useFrameworkScore(frameworkId: string, config: FrameworkConfig, refreshKey?: number): FrameworkScore {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [state, setState] = useState<FrameworkScore>(EMPTY);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    if (!frameworkId || !empresaId) { setState({ ...EMPTY, loading: false }); return; }
    setState(EMPTY);
    const load = async () => {
      try {
        const [requirements, { data: evaluations }, { data: soa }] = await Promise.all([
          fetchFrameworkRequirements(frameworkId),
          readAllPages((from, to) => supabase.from('gap_analysis_evaluations')
            .select('requirement_id,conformity_status').eq('framework_id', frameworkId).eq('empresa_id', empresaId)
            .order('id').range(from, to).abortSignal(controller.signal), controller.signal),
          readAllPages((from, to) => supabase.from('gap_analysis_soa')
            .select('requirement_id,aplicavel').eq('framework_id', frameworkId).eq('empresa_id', empresaId)
            .order('id').range(from, to).abortSignal(controller.signal), controller.signal),
        ]);
        const statuses = new Map(evaluations.map(e => [e.requirement_id, e.conformity_status]));
        const excluded = new Set(soa.filter(s => s.aplicavel === false).map(s => s.requirement_id));
        const score = (rows: FrameworkRequirement[]): GroupScore => {
          const result = calcularScoreFramework(rows.map(r => ({
            id: r.id, peso: r.peso, conformityStatus: statuses.get(r.id), aplicavel: !excluded.has(r.id),
          })));
          return { score: result.score, totalRequirements: result.aplicaveis, evaluatedRequirements: result.avaliados };
        };
        const group = (field: 'categoria' | 'area_responsavel', fallback: string) => {
          const groups = new Map<string, FrameworkRequirement[]>();
          requirements.forEach(r => { const key = r[field] || fallback; groups.set(key, [...(groups.get(key) || []), r]); });
          return [...groups];
        };
        const pillarScores = group('categoria', tGlobal('sweepRiscos.gap.fallbacks.outros')).map(([pillar, rows]) => ({
          ...score(rows), pillar, name: config.id === 'nist-csf-2.0' ? NIST_PILLAR_NAMES[pillar] || pillar : pillar,
          color: COLORS[pillar] || '#6b7280',
        }));
        const overall = score(requirements);
        if (current) setState({
          overallScore: overall.score, totalRequirements: overall.totalRequirements, evaluatedRequirements: overall.evaluatedRequirements,
          catalogRequirements: requirements.length,
          pillarScores,
          categoryScores: pillarScores.map(p => ({ category: p.name, score: p.score, total: p.totalRequirements, evaluated: p.evaluatedRequirements })),
          areaScores: group('area_responsavel', tGlobal('sweepRiscos.gap.fallbacks.naoAtribuida')).map(([area, rows]) => {
            const s = score(rows); return { ...s, area, total: s.totalRequirements, evaluated: s.evaluatedRequirements };
          }).sort((a, b) => b.score - a.score),
          sectionScores: (config.sections || []).map(s => ({ ...score(requirements.filter(r => s.filter(r.codigo))), section: s.id, name: s.title })),
          domainScores: (config.domains || []).map(d => ({ ...score(requirements.filter(r => r.codigo?.startsWith(d.id))), domain: d.id, name: d.name, color: d.color })),
          loading: false, error: null,
        });
      } catch (err) {
        if (current) setState({ ...EMPTY, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      }
    };
    void load();
    return () => { current = false; controller.abort(); };
  // Framework configs are immutable catalog entries; callers may wrap the
  // same config in a fresh object without restarting an asynchronous read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkId, empresaId, config.id, refreshKey]);
  return state;
}
