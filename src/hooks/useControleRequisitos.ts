/**
 * Ligação controlo interno ↔ requisitos de framework (N para N, agnóstico de framework).
 *
 * Multi-tenant: todas as consultas filtram por `empresa_id` do perfil autenticado.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { reqTitulo, reqCategoria } from '@/lib/gap-i18n';

export interface RequisitoDoControlo {
  /** id da linha em controles_requisitos */
  id: string;
  requirement_id: string;
  framework_id: string;
  framework_nome: string;
  codigo: string;
  titulo: string;
  categoria: string;
  conformity_status: string;
}

/** Requisitos ligados a um controlo, com o estado de conformidade actual. */
export function useControleRequisitos(controleId: string | null) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['controle-requisitos', controleId, empresaId],
    enabled: !!controleId && !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<RequisitoDoControlo[]> => {
      const { data, error } = await supabase
        .from('controles_requisitos')
        .select(
          'id, requirement_id, framework_id, ' +
            'requisito:gap_analysis_requirements(codigo, titulo, titulo_en, categoria, categoria_en), ' +
            'framework:gap_analysis_frameworks(nome, nome_en)',
        )
        .eq('controle_id', controleId!)
        .eq('empresa_id', empresaId!);
      if (error) throw error;

      const rows = (data || []) as any[];
      if (rows.length === 0) return [];

      const { data: evals } = await supabase
        .from('gap_analysis_evaluations')
        .select('requirement_id, conformity_status')
        .eq('empresa_id', empresaId!)
        .in('requirement_id', rows.map((r) => r.requirement_id));

      const statusMap = new Map(
        (evals || []).map((e: any) => [e.requirement_id, e.conformity_status as string]),
      );

      return rows.map((r) => {
        const req = Array.isArray(r.requisito) ? r.requisito[0] : r.requisito;
        const fw = Array.isArray(r.framework) ? r.framework[0] : r.framework;
        return {
          id: r.id,
          requirement_id: r.requirement_id,
          framework_id: r.framework_id,
          framework_nome: fw?.nome || '—',
          codigo: req?.codigo || '',
          titulo: reqTitulo(req),
          categoria: reqCategoria(req) || '',
          conformity_status: statusMap.get(r.requirement_id) || 'nao_avaliado',
        };
      });
    },
  });
}

/** Substitui o conjunto de requisitos ligados a um controlo. */
export function useSalvarControleRequisitos(controleId: string | null) {
  const { profile, user } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (selecionados: Array<{ requirement_id: string; framework_id: string }>) => {
      if (!controleId || !empresaId) throw new Error('Sem controlo ou empresa.');
      const { error: delErr } = await supabase
        .from('controles_requisitos')
        .delete()
        .eq('controle_id', controleId)
        .eq('empresa_id', empresaId);
      if (delErr) throw delErr;
      if (selecionados.length === 0) return;
      const { error } = await supabase.from('controles_requisitos').insert(
        selecionados.map((s) => ({
          controle_id: controleId,
          empresa_id: empresaId,
          requirement_id: s.requirement_id,
          framework_id: s.framework_id,
          created_by: user?.id ?? null,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controle-requisitos'] });
      queryClient.invalidateQueries({ queryKey: ['requisito-controles'] });
    },
  });
}

export interface ControloLigado {
  id: string;
  nome: string;
  status: string;
  criticidade: string;
  /** true quando o controlo não está operacional (falha herdada pelo requisito). */
  emFalha: boolean;
}

const STATUS_EM_FALHA = new Set(['inativo', 'nao_efetivo', 'falho', 'inefetivo', 'suspenso']);

/**
 * Mapa requirement_id → controlos internos ligados. Alimenta a tabela de
 * requisitos, o detalhe do requisito e a justificação da SoA.
 */
export function useRequisitoControles(frameworkId?: string | null) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['requisito-controles', frameworkId, empresaId],
    enabled: !!empresaId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Map<string, ControloLigado[]>> => {
      let q = supabase
        .from('controles_requisitos')
        .select('requirement_id, controle:controles(id, nome, status, criticidade)')
        .eq('empresa_id', empresaId!);
      if (frameworkId) q = q.eq('framework_id', frameworkId);
      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, ControloLigado[]>();
      ((data || []) as any[]).forEach((row) => {
        const c = Array.isArray(row.controle) ? row.controle[0] : row.controle;
        if (!c) return;
        const list = map.get(row.requirement_id) || [];
        list.push({
          id: c.id,
          nome: c.nome,
          status: c.status || '',
          criticidade: c.criticidade || '',
          emFalha: STATUS_EM_FALHA.has(String(c.status || '').toLowerCase()),
        });
        map.set(row.requirement_id, list);
      });
      return map;
    },
  });
}
