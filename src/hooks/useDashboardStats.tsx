import { useQuery } from "@tanstack/react-query";
import { severidadeRiscoEfetiva } from '@/lib/metrics/riscos';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { isGapCritico } from "@/lib/gap-criticality";

interface AlertDetail {
  id: string;
  title: string;
  description?: string;
  type: 'risco' | 'denuncia' | 'controle' | 'incidente';
}

interface DashboardStats {
  /**
   * Alertas críticos = riscos críticos em aberto + não conformidades críticas
   * (Gap Analysis) + incidentes críticos abertos + prazos vencidos
   * (planos de ação e reavaliações de controles).
   */
  criticalAlerts: number;
  criticalBreakdown: {
    riscosCriticos: number;
    naoConformidadesCriticas: number;
    incidentesCriticos: number;
    prazosVencidos: number;
  };
  riscosAltos: number;
  riscosCriticos: number;
  denunciasPendentes: number;
  controlesVencendo: number;
  controlesVencidos: number;
  planosAtrasados: number;
  naoConformidadesCriticas: number;
  incidentesCriticos: number;
  alertDetails: AlertDetail[];
  lastUpdated: Date;
}

const normalizeStr = (s: string) =>
  (s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const useDashboardStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['dashboard-stats', empresaId],
    enabled: !!empresaId,
    queryFn: async (): Promise<DashboardStats> => {
      const alertDetails: AlertDetail[] = [];
      const hojeIso = new Date().toISOString();

      const [
        riscosResult,
        denunciasResult,
        controlesResult,
        controlesVencidosResult,
        incidentesResult,
        planosResult,
        avaliacoesResult,
      ] = await Promise.all([
        supabase
          .from('riscos')
          .select('id, nome, descricao, nivel_risco_inicial, nivel_risco_residual')
          .eq('empresa_id', empresaId!),

        supabase
          .from('denuncias')
          .select('id, titulo, descricao, status')
          .eq('empresa_id', empresaId!)
          // `em_analise` é o estado mais comum de uma denúncia em curso e
          // ficava de fora: a pílula dizia 2 e o diálogo que a explica dizia 1.
          // `nova` não existe numa única linha do produto.
          .in('status', ['nova', 'em_analise', 'em_investigacao']),

        (() => {
          const dataLimite = new Date();
          dataLimite.setDate(dataLimite.getDate() + 30);
          return supabase
            .from('controles')
            .select('id, nome, descricao, proxima_avaliacao')
            .eq('empresa_id', empresaId!)
            .lte('proxima_avaliacao', dataLimite.toISOString())
            .gte('proxima_avaliacao', hojeIso);
        })(),

        supabase
          .from('controles')
          .select('id, nome, descricao')
          .eq('empresa_id', empresaId!)
          // Um controlo inactivo ou em revisão não tem reavaliação em atraso:
          // dos 88 "prazos vencidos" do banner, 36 eram desses.
          .eq('status', 'ativo')
          .lt('proxima_avaliacao', hojeIso),

        supabase
          .from('incidentes')
          .select('id, titulo, descricao, criticidade, status')
          .eq('empresa_id', empresaId!)
          .eq('criticidade', 'critica')
          // O produto grava `em_investigacao`; `investigacao` não existe numa
          // única linha. A tooltip dizia "Incidentes críticos 0" com um crítico
          // em investigação em cada empresa.
          .in('status', ['aberto', 'em_investigacao', 'contido']),

        supabase
          .from('planos_acao')
          .select('id')
          .eq('empresa_id', empresaId!)
          .not('status', 'in', '("concluido","cancelado")')
          .lt('prazo', hojeIso.slice(0, 10)),

        supabase
          .from('gap_analysis_evaluations')
          .select('requirement_id, conformity_status, prazo_implementacao')
          .eq('empresa_id', empresaId!)
          .eq('conformity_status', 'nao_conforme'),
      ]);

      // Riscos — mantemos "altos" (alto/crítico) para os cartões existentes e
      // isolamos os realmente críticos para o contador de alertas.
      const nivelDe = (r: { nivel_risco_residual?: string | null; nivel_risco_inicial?: string | null }) =>
        normalizeStr(r.nivel_risco_residual || r.nivel_risco_inicial || '');

      // `severidadeRiscoEfetiva` é o vocabulário canónico do produto. A lista
      // à mão aqui conhecia três palavras e não convertia separadores: uma
      // empresa com faixas "Extremo"/"Elevado" — e há uma nos dados reais, com
      // 9 e 6 riscos — não tinha um único risco alto ou crítico no dashboard.
      const riscosAltosCriticos = (riscosResult.data || []).filter((r) => {
        const sev = severidadeRiscoEfetiva(r);
        return sev === 'alto' || sev === 'critico';
      });
      const riscosAltos = riscosAltosCriticos.length;
      const riscosCriticos = riscosAltosCriticos.filter(
        (r) => severidadeRiscoEfetiva(r) === 'critico',
      ).length;
      riscosAltosCriticos.forEach(r => {
        alertDetails.push({ id: r.id, title: r.nome, description: r.descricao || undefined, type: 'risco' });
      });

      const denunciasPendentes = denunciasResult.data?.length || 0;
      denunciasResult.data?.forEach(d => {
        alertDetails.push({ id: d.id, title: d.titulo, description: d.descricao || undefined, type: 'denuncia' });
      });

      const controlesVencendo = controlesResult.data?.length || 0;
      controlesResult.data?.forEach(c => {
        alertDetails.push({ id: c.id, title: c.nome, description: c.descricao || undefined, type: 'controle' });
      });
      const controlesVencidos = controlesVencidosResult.data?.length || 0;
      // Entram no total do banner (93) mas não entravam em `alertDetails`: o
      // diálogo que explica o banner listava 13 e ficava a dever 80.
      controlesVencidosResult.data?.forEach((c: any) => {
        alertDetails.push({ id: c.id, title: c.nome, description: c.descricao || undefined, type: 'controle' });
      });

      const incidentesCriticos = incidentesResult.data?.length || 0;
      incidentesResult.data?.forEach(i => {
        alertDetails.push({ id: i.id, title: i.titulo, description: i.descricao || undefined, type: 'incidente' });
      });

      const planosAtrasados = planosResult.data?.length || 0;

      // Não conformidades críticas — mesma definição usada no Gap Analysis.
      let naoConformidadesCriticas = 0;
      const avaliacoes = avaliacoesResult.data || [];
      if (avaliacoes.length > 0) {
        const requirementIds = Array.from(
          new Set(avaliacoes.map(a => a.requirement_id).filter(Boolean) as string[]),
        );
        const pesos = new Map<string, number>();
        if (requirementIds.length > 0) {
          const { data: reqs } = await supabase
            .from('gap_analysis_requirements')
            .select('id, peso')
            .in('id', requirementIds);
          (reqs || []).forEach(r => pesos.set(r.id, Number(r.peso ?? 3)));
        }
        naoConformidadesCriticas = avaliacoes.filter(a =>
          isGapCritico({
            conformity_status: a.conformity_status,
            peso: a.requirement_id ? pesos.get(a.requirement_id) : undefined,
            prazo_implementacao: a.prazo_implementacao,
          }),
        ).length;
      }

      const prazosVencidos = planosAtrasados + controlesVencidos;
      const criticalAlerts =
        riscosCriticos + naoConformidadesCriticas + incidentesCriticos + prazosVencidos;

      return {
        criticalAlerts,
        criticalBreakdown: {
          riscosCriticos,
          naoConformidadesCriticas,
          incidentesCriticos,
          prazosVencidos,
        },
        riscosAltos,
        riscosCriticos,
        denunciasPendentes,
        controlesVencendo,
        controlesVencidos,
        planosAtrasados,
        naoConformidadesCriticas,
        incidentesCriticos,
        alertDetails,
        lastUpdated: new Date()
      };
    },
    staleTime: 2 * 60 * 1000,
  });
};
