import { readAllPages } from "@/lib/read-all-pages";
import { formatarDiaParaDB } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { severidadeRiscoEfetiva } from '@/lib/metrics/riscos';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { isGapCritico } from "@/lib/gap-criticality";
import { isIncidenteCriticoEmCurso } from '@/lib/metrics/incidentes';

/**
 * Um item que soma para `criticalAlerts`.
 *
 * Os quatro tipos são exatamente as quatro parcelas de `criticalBreakdown` —
 * é isso que garante que o diálogo lista o mesmo conjunto que o número conta.
 * `prazo` junta planos de ação atrasados e reavaliações de controlo vencidas,
 * porque é assim que a parcela `prazosVencidos` os soma.
 */
export interface AlertDetail {
  id: string;
  title: string;
  description?: string;
  type: 'risco' | 'gap' | 'incidente' | 'prazo';
  href?: string;
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
  const { t } = useLanguage();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['dashboard-stats', empresaId, t('experience.linkUnavailable')],
    enabled: !!empresaId,
    queryFn: async ({ signal }): Promise<DashboardStats> => {
      const alertDetails: AlertDetail[] = [];
      const hojeIso = formatarDiaParaDB(new Date());

      const [
        riscosResult,
        denunciasResult,
        controlesResult,
        controlesVencidosResult,
        incidentesResult,
        planosResult,
        avaliacoesResult,
      ] = await Promise.all([
        readAllPages((from, to) => supabase
          .from('riscos')
          .select('id, nome, descricao, nivel_risco_inicial, nivel_risco_residual')
          .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal),

        readAllPages((from, to) => supabase
          .from('denuncias')
          .select('id, titulo, descricao, status')
          .eq('empresa_id', empresaId!)
          // `em_analise` é o estado mais comum de uma denúncia em curso e
          // ficava de fora: a pílula dizia 2 e o diálogo que a explica dizia 1.
          // `nova` não existe numa única linha do produto.
          .in('status', ['nova', 'em_analise', 'em_investigacao']).order('id').range(from, to).abortSignal(signal), signal),

        (() => {
          const dataLimite = new Date();
          dataLimite.setDate(dataLimite.getDate() + 30);
          return readAllPages((from, to) => supabase
            .from('controles')
            .select('id, nome, descricao, proxima_avaliacao')
            .eq('empresa_id', empresaId!)
            .lte('proxima_avaliacao', formatarDiaParaDB(dataLimite))
            .gte('proxima_avaliacao', hojeIso).order('id').range(from, to).abortSignal(signal), signal);
        })(),

        readAllPages((from, to) => supabase
          .from('controles')
          .select('id, nome, descricao')
          .eq('empresa_id', empresaId!)
          // Um controlo inactivo ou em revisão não tem reavaliação em atraso:
          // dos 88 "prazos vencidos" do banner, 36 eram desses.
          .eq('status', 'ativo')
          .lt('proxima_avaliacao', hojeIso).order('id').range(from, to).abortSignal(signal), signal),

        readAllPages((from, to) => supabase
          .from('incidentes')
          .select('id, titulo, descricao, criticidade, status')
          .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal),

        readAllPages((from, to) => supabase
          // `titulo` para o plano poder APARECER no diálogo: entrava no total
          // do banner e não tinha como ser listado.
          .from('planos_acao')
          .select('id, titulo')
          .eq('empresa_id', empresaId!)
          .not('status', 'in', '("concluido","cancelado")')
          .lt('prazo', hojeIso).order('id').range(from, to).abortSignal(signal), signal),

        readAllPages((from, to) => supabase
          .from('gap_analysis_evaluations')
          .select('requirement_id, conformity_status, prazo_implementacao')
          .eq('empresa_id', empresaId!)
          .eq('conformity_status', 'nao_conforme').order('id').range(from, to).abortSignal(signal), signal),
      ]);

      // Uma leitura parcial não pode se apresentar como ausência de alertas.
      for (const result of [riscosResult, denunciasResult, controlesResult, controlesVencidosResult, incidentesResult, planosResult, avaliacoesResult]) {
        if (result.error) throw result.error;
      }

      // Riscos — mantemos "altos" (alto/crítico) para os cartões existentes e
      // isolamos os realmente críticos para o contador de alertas.
      const nivelDe = (r: { nivel_risco_residual?: string | null; nivel_risco_inicial?: string | null }) =>
        normalizeStr(r.nivel_risco_residual || r.nivel_risco_inicial || '');

      // `severidadeRiscoEfetiva` é o vocabulário canónico do produto. A lista
      // à mão aqui conhecia três palavras e não convertia separadores: uma
      // empresa com faixas "Extremo"/"Elevado" — e há uma nos dados reais, com
      // 9 e 6 riscos — não tinha um único risco alto ou crítico no dashboard.
      /*
        `alertDetails` é a EXPLICAÇÃO de `criticalAlerts`, e não uma segunda
        lista de coisas interessantes.

        Estavam a responder a perguntas diferentes, e dava-se por isso ao
        clicar: o banner somava riscos críticos + não conformidades críticas +
        incidentes críticos + prazos vencidos, enquanto o diálogo listava
        riscos ALTOS, denúncias e controlos a vencer. Numa base com 35 no
        banner, o diálogo mostrava 10 itens — e desses, um só estava contado.
        As não conformidades (30) e os planos atrasados (4) não tinham sequer
        um tipo onde caber.

        A regra passa a ser: tudo o que soma entra na lista, e nada que não
        some entra na lista. Denúncias e controlos a vencer continuam
        contados nos seus próprios campos, para os cartões que os mostram —
        só deixam de fingir que explicam este número.
      */
      const riscosAltosCriticos = (riscosResult.data || []).filter((r) => {
        const sev = severidadeRiscoEfetiva(r);
        return sev === 'alto' || sev === 'critico';
      });
      const riscosAltos = riscosAltosCriticos.length;
      const riscosCriticosLista = riscosAltosCriticos.filter(
        (r) => severidadeRiscoEfetiva(r) === 'critico',
      );
      const riscosCriticos = riscosCriticosLista.length;
      riscosCriticosLista.forEach((r) => {
        alertDetails.push({ id: r.id, title: r.nome, description: r.descricao || undefined, type: 'risco', href: `/riscos?risco=${r.id}` });
      });

      const denunciasPendentes = denunciasResult.data?.length || 0;
      const controlesVencendo = controlesResult.data?.length || 0;

      const incidentesEmAlerta = (incidentesResult.data ?? []).filter(isIncidenteCriticoEmCurso);
      const incidentesCriticos = incidentesEmAlerta.length;
      incidentesEmAlerta.forEach(i => {
        alertDetails.push({ id: i.id, title: i.titulo, description: i.descricao || undefined, type: 'incidente', href: `/incidentes?focus=${i.id}` });
      });

      // Não conformidades críticas — mesma definição usada no Gap Analysis.
      let naoConformidadesCriticas = 0;
      const avaliacoes = avaliacoesResult.data || [];
      if (avaliacoes.length > 0) {
        const requirementIds = Array.from(
          new Set(avaliacoes.map(a => a.requirement_id).filter(Boolean) as string[]),
        );
        const pesos = new Map<string, number>();
        // `codigo`/`titulo` para o requisito poder aparecer no diálogo com um
        // nome: sem eles, a maior fatia do banner era uma lista de UUIDs.
        const nomes = new Map<string, { codigo: string | null; titulo: string | null }>();
        const frameworks = new Map<string, string>();
        for (let offset = 0; offset < requirementIds.length; offset += 100) {
          const { data: reqs, error: requirementsError } = await supabase
            .from('gap_analysis_requirements')
            .select('id, peso, codigo, titulo, framework_id')
            .in('id', requirementIds.slice(offset, offset + 100)).abortSignal(signal);
          if (requirementsError) throw requirementsError;
          (reqs || []).forEach(r => {
            frameworks.set(r.id, r.framework_id);
            pesos.set(r.id, Number(r.peso ?? 3));
            nomes.set(r.id, { codigo: r.codigo ?? null, titulo: r.titulo ?? null });
          });
        }
        const criticas = avaliacoes.filter(a =>
          isGapCritico({
            conformity_status: a.conformity_status,
            peso: a.requirement_id ? pesos.get(a.requirement_id) : undefined,
            prazo_implementacao: a.prazo_implementacao,
          }),
        );
        naoConformidadesCriticas = criticas.length;
        criticas.forEach((a) => {
          const req = a.requirement_id ? nomes.get(a.requirement_id) : undefined;
          const titulo = [req?.codigo, req?.titulo].filter(Boolean).join(' — ');
          alertDetails.push({
            id: a.requirement_id ?? `gap-${alertDetails.length}`,
            // Sem código nem título fica o id: é feio, mas é rastreável — e só
            // acontece se o requisito tiver sido apagado sob a avaliação.
            title: titulo || t('experience.linkUnavailable'),
            type: 'gap',
            href: a.requirement_id && frameworks.get(a.requirement_id)
              ? `/gap-analysis/framework/${frameworks.get(a.requirement_id)}?req=${a.requirement_id}`
              : '/gap-analysis',
          });
        });
      }

      const planosAtrasados = planosResult.data?.length || 0;
      planosResult.data?.forEach((p) => {
        alertDetails.push({ id: p.id, title: p.titulo, type: 'prazo', href: `/planos-acao?plano=${p.id}` });
      });

      const controlesVencidos = controlesVencidosResult.data?.length || 0;
      controlesVencidosResult.data?.forEach((c) => {
        alertDetails.push({ id: c.id, title: c.nome, description: c.descricao || undefined, type: 'prazo', href: `/governanca/controles?focus=${c.id}` });
      });

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
