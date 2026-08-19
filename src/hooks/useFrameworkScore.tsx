import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { FrameworkConfig, NIST_PILLAR_NAMES } from '@/lib/framework-configs';
import { tGlobal } from '@/lib/i18n-global';

interface Requirement {
  id: string;
  codigo?: string | null;
  titulo: string;
  categoria?: string | null;
  area_responsavel?: string | null;
  peso?: number | null;
}

interface Evaluation {
  requirement_id: string;
  conformity_status?: string | null;
}

interface PillarScore {
  pillar: string;
  name: string;
  score: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  color: string;
}

interface DomainScore {
  domain: string;
  name: string;
  score: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  color: string;
}

interface AreaScore {
  area: string;
  score: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  total: number;
  evaluated: number;
}

interface SectionScore {
  section: string;
  name: string;
  score: number;
  totalRequirements: number;
  evaluatedRequirements: number;
}

interface CategoryScore {
  category: string;
  score: number;
  total: number;
  evaluated: number;
}

interface FrameworkScore {
  overallScore: number;
  pillarScores: PillarScore[];
  domainScores: DomainScore[];
  areaScores: AreaScore[];
  sectionScores: SectionScore[];
  categoryScores: CategoryScore[];
  totalRequirements: number;
  evaluatedRequirements: number;
  loading: boolean;
  error: Error | null;
}

const PILLAR_COLORS: Record<string, string> = {
  'GOVERN': '#3b82f6',
  'IDENTIFY': '#10b981',
  'PROTECT': '#f59e0b',
  'DETECT': '#ef4444',
  'RESPOND': '#8b5cf6',
  'RECOVER': '#06b6d4',
  'Governança': '#3b82f6',
  'Gestão de Riscos': '#10b981',
  'Segurança': '#f59e0b',
  'Conformidade': '#ef4444',
  'Monitoramento': '#8b5cf6',
  'Auditoria': '#06b6d4',
  'Operações': '#ec4899',
};

export function useFrameworkScore(frameworkId: string, config: FrameworkConfig, refreshKey?: number): FrameworkScore {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [overallScore, setOverallScore] = useState(0);
  const [pillarScores, setPillarScores] = useState<PillarScore[]>([]);
  const [domainScores, setDomainScores] = useState<DomainScore[]>([]);
  const [areaScores, setAreaScores] = useState<AreaScore[]>([]);
  const [sectionScores, setSectionScores] = useState<SectionScore[]>([]);
  const [categoryScores, setCategoryScores] = useState<CategoryScore[]>([]);
  const [totalRequirements, setTotalRequirements] = useState(0);
  const [evaluatedRequirements, setEvaluatedRequirements] = useState(0);

  useEffect(() => {
    if (!frameworkId || !empresaId) return;

    const loadScore = async () => {
      try {
        setLoading(true);
        setError(null);

        // Buscar requisitos do framework
        const { data: requirements, error: reqError } = await supabase
          .from('gap_analysis_requirements')
          .select('id, codigo, titulo, categoria, area_responsavel, peso')
          .eq('framework_id', frameworkId)
          .order('ordem', { ascending: true });

        if (reqError) throw reqError;

        // Buscar avaliações existentes
        const { data: evaluations, error: evalError } = await supabase
          .from('gap_analysis_evaluations')
          .select('requirement_id, conformity_status')
          .eq('framework_id', frameworkId)
          .eq('empresa_id', empresaId);

        if (evalError) throw evalError;

        // Declaração de Aplicabilidade: o que a empresa excluiu do escopo, com
        // justificativa registrada, não é lacuna. Antes só a própria aba do SoA
        // respeitava isso — o score, a fila de prioridades e a remediação
        // continuavam cobrando um requisito que a diretoria já tinha dispensado.
        const { data: soaRows } = await supabase
          .from('gap_analysis_soa')
          .select('requirement_id, aplicavel')
          .eq('framework_id', frameworkId)
          .eq('empresa_id', empresaId);

        const foraDoEscopo = new Set(
          (soaRows || []).filter((s) => s.aplicavel === false).map((s) => s.requirement_id),
        );

        // Criar mapa de avaliações
        const evalMap = new Map<string, Evaluation>();
        (evaluations || []).forEach((e: Evaluation) => {
          evalMap.set(e.requirement_id, e);
        });

        // Um requisito fora do escopo entra em toda a lógica abaixo como
        // `nao_aplicavel`, que é o estado que ela já sabe descartar.
        foraDoEscopo.forEach((requirementId) => {
          const atual = evalMap.get(requirementId);
          evalMap.set(requirementId, {
            ...(atual ?? { requirement_id: requirementId }),
            conformity_status: 'nao_aplicavel',
          } as Evaluation);
        });

        // Agrupar requisitos por pilar
        const pillarGroups = new Map<string, Requirement[]>();
        (requirements || []).forEach((req: Requirement) => {
          const pillar = req.categoria || tGlobal('sweepRiscos.gap.fallbacks.outros');
          if (!pillarGroups.has(pillar)) {
            pillarGroups.set(pillar, []);
          }
          pillarGroups.get(pillar)?.push(req);
        });

        // Calcular scores por pilar
        const calculatedPillarScores: PillarScore[] = [];
        
        pillarGroups.forEach((reqs, pillarName) => {
          let totalWeightedScore = 0;
          let totalWeight = 0;
          let evaluated = 0;

          reqs.forEach((req) => {
            const evaluation = evalMap.get(req.id);
            const status = evaluation?.conformity_status || 'nao_avaliado';
            const weight = req.peso || 1;

            if (status !== 'nao_aplicavel') {
              const score = config.statusScores[status as keyof typeof config.statusScores] || 0;
              totalWeightedScore += score * weight;
              totalWeight += weight;
              // Dentro da guarda, como nos outros três laços deste ficheiro.
              // Fora dela, os "não aplicável" entravam na conta de avaliados só
              // aqui: a lista dizia 114/121 e o PDF dizia 117/121 sobre os
              // mesmos dados, porque o PDF soma este contador.
              if (status !== 'nao_avaliado') {
                evaluated++;
              }
            }
          });

          const pillarScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
          
          calculatedPillarScores.push({
            pillar: pillarName,
            name: config.id === 'nist-csf-2.0' && PILLAR_COLORS[pillarName] 
              ? (NIST_PILLAR_NAMES[pillarName] || pillarName)
              : pillarName,
            score: pillarScore,
            totalRequirements: reqs.length,
            evaluatedRequirements: evaluated,
            color: PILLAR_COLORS[pillarName] || '#6b7280',
          });
        });

        // Calcular score geral flat (soma ponderada / total peso aplicável)
        let totalFlatWeightedScore = 0;
        let totalFlatWeight = 0;
        (requirements || []).forEach((req: Requirement) => {
          const evaluation = evalMap.get(req.id);
          const status = evaluation?.conformity_status || 'nao_avaliado';
          const weight = req.peso || 1;
          if (status !== 'nao_aplicavel') {
            const score = config.statusScores[status as keyof typeof config.statusScores] || 0;
            totalFlatWeightedScore += score * weight;
            totalFlatWeight += weight;
          }
        });
        const overall = totalFlatWeight > 0 ? totalFlatWeightedScore / totalFlatWeight : 0;

        const totalEvaluated = calculatedPillarScores.reduce((sum, p) => sum + p.evaluatedRequirements, 0);

        setOverallScore(overall);
        setPillarScores(calculatedPillarScores);
        
        // Convert pillar scores to category scores format
        const calculatedCategoryScores: CategoryScore[] = calculatedPillarScores.map(pillar => ({
          category: pillar.name,
          score: pillar.score,
          total: pillar.totalRequirements,
          evaluated: pillar.evaluatedRequirements
        }));
        setCategoryScores(calculatedCategoryScores);
        
        // Calcular scores por área responsável
        const areaGroups = new Map<string, Requirement[]>();
        (requirements || []).forEach((req: Requirement) => {
          const area = req.area_responsavel || tGlobal('sweepRiscos.gap.fallbacks.naoAtribuida');
          if (!areaGroups.has(area)) {
            areaGroups.set(area, []);
          }
          areaGroups.get(area)?.push(req);
        });

        const calculatedAreaScores: AreaScore[] = [];
        areaGroups.forEach((reqs, areaName) => {
          let totalWeightedScore = 0;
          let totalWeight = 0;
          let evaluated = 0;

          reqs.forEach((req) => {
            const evaluation = evalMap.get(req.id);
            const status = evaluation?.conformity_status || 'nao_avaliado';
            const weight = req.peso || 1;

            if (status !== 'nao_aplicavel') {
              const score = config.statusScores[status as keyof typeof config.statusScores] || 0;
              totalWeightedScore += score * weight;
              totalWeight += weight;
              
              if (status !== 'nao_avaliado') {
                evaluated++;
              }
            }
          });

          const areaScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
          
          calculatedAreaScores.push({
            area: areaName,
            score: areaScore,
            totalRequirements: reqs.length,
            evaluatedRequirements: evaluated,
            total: reqs.length,
            evaluated: evaluated,
          });
        });

        // Ordenar por score descendente
        calculatedAreaScores.sort((a, b) => b.score - a.score);
        
        setAreaScores(calculatedAreaScores);
        
        // Calculate section scores if config has sections
        if (config.sections && config.sections.length > 0) {
          const calculatedSectionScores: SectionScore[] = config.sections.map(section => {
            const sectionReqs = (requirements || []).filter(req => section.filter(req.codigo));
            let totalWeightedScore = 0;
            let totalWeight = 0;
            let evaluated = 0;
            
            sectionReqs.forEach(req => {
              const evaluation = evalMap.get(req.id);
              const status = evaluation?.conformity_status || 'nao_avaliado';
              const weight = req.peso || 1;
              if (status !== 'nao_aplicavel') {
                const score = config.statusScores[status as keyof typeof config.statusScores] || 0;
                totalWeightedScore += score * weight;
                totalWeight += weight;
                if (status !== 'nao_avaliado') evaluated++;
              }
            });
            
            return {
              section: section.id,
              name: section.title,
              score: totalWeight > 0 ? totalWeightedScore / totalWeight : 0,
              totalRequirements: sectionReqs.length,
              evaluatedRequirements: evaluated,
            };
          });
          setSectionScores(calculatedSectionScores);
        } else {
          setSectionScores([]);
        }
        
        // Calculate domain scores if config has domains
        if (config.domains && config.domains.length > 0) {
          const calculatedDomainScores: DomainScore[] = config.domains.map(domain => {
            const domainReqs = (requirements || []).filter(req => req.codigo?.startsWith(domain.id));
            let totalWeightedScore = 0;
            let totalWeight = 0;
            let evaluated = 0;
            
            domainReqs.forEach(req => {
              const evaluation = evalMap.get(req.id);
              const status = evaluation?.conformity_status || 'nao_avaliado';
              const weight = req.peso || 1;
              if (status !== 'nao_aplicavel') {
                const score = config.statusScores[status as keyof typeof config.statusScores] || 0;
                totalWeightedScore += score * weight;
                totalWeight += weight;
                if (status !== 'nao_avaliado') evaluated++;
              }
            });
            
            return {
              domain: domain.id,
              name: domain.name,
              score: totalWeight > 0 ? totalWeightedScore / totalWeight : 0,
              totalRequirements: domainReqs.length,
              evaluatedRequirements: evaluated,
              color: domain.color,
            };
          });
          setDomainScores(calculatedDomainScores);
        } else {
          setDomainScores([]);
        }
        
        setTotalRequirements(requirements?.length || 0);
        setEvaluatedRequirements(totalEvaluated);
      } catch (err: any) {
        console.error('Erro ao calcular score:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    loadScore();
  }, [frameworkId, empresaId, config?.id, config?.scoreType, refreshKey]);

  return {
    overallScore,
    pillarScores,
    domainScores,
    areaScores,
    sectionScores,
    categoryScores,
    totalRequirements,
    evaluatedRequirements,
    loading,
    error,
  };
}
