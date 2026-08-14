/**
 * Ligação risco ↔ requisitos de framework (controlos reais do Gap Analysis).
 *
 * Multi-tenant: todas as consultas filtram por `empresa_id` do perfil autenticado.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { fetchAllPaginated } from '@/lib/supabase-paginate';
import { reqTitulo, reqCategoria } from '@/lib/gap-i18n';

export interface RequisitoVinculado {
  /** id da linha em riscos_requisitos */
  id: string;
  requirement_id: string;
  framework_id: string;
  framework_nome: string;
  tipo_vinculacao: string;
  codigo: string;
  titulo: string;
  categoria: string;
  conformity_status: string;
}

/** Requisitos vinculados a um risco, já com o estado de conformidade actual. */
export function useRiscoRequisitos(riscoId: string | null) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['risco-requisitos', riscoId, empresaId],
    enabled: !!riscoId && !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<RequisitoVinculado[]> => {
      const { data, error } = await supabase
        .from('riscos_requisitos')
        .select(
          'id, requirement_id, framework_id, tipo_vinculacao, ' +
            'requisito:gap_analysis_requirements(codigo, titulo, titulo_en, categoria, categoria_en), ' +
            'framework:gap_analysis_frameworks(nome, nome_en)',
        )
        .eq('risco_id', riscoId!)
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
          tipo_vinculacao: r.tipo_vinculacao || 'mitiga',
          codigo: req?.codigo || '',
          titulo: reqTitulo(req),
          categoria: reqCategoria(req) || '',
          conformity_status: statusMap.get(r.requirement_id) || 'nao_avaliado',
        };
      });
    },
  });
}

export interface RequisitoOpcao {
  id: string;
  codigo: string;
  titulo: string;
  categoria: string;
  framework_id: string;
  framework_nome: string;
  conformity_status: string;
}

/**
 * Catálogo de requisitos dos frameworks ACTIVOS da empresa (frameworks com pelo
 * menos uma avaliação registada). É a lista que alimenta o modal de vinculação.
 */
export function useRequisitosDisponiveis(enabled: boolean) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['requisitos-disponiveis', empresaId],
    enabled: enabled && !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RequisitoOpcao[]> => {
      const { data: evals, error: evalErr } = await fetchAllPaginated<any>(() =>
        supabase
          .from('gap_analysis_evaluations')
          .select('framework_id, requirement_id, conformity_status')
          .eq('empresa_id', empresaId!),
      );
      if (evalErr) throw evalErr;

      const frameworkIds = Array.from(new Set((evals || []).map((e) => e.framework_id))).filter(Boolean);
      if (frameworkIds.length === 0) return [];

      const [{ data: frameworks }, { data: reqs, error: reqErr }] = await Promise.all([
        supabase.from('gap_analysis_frameworks').select('id, nome, nome_en').in('id', frameworkIds),
        fetchAllPaginated<any>(() =>
          supabase
            .from('gap_analysis_requirements')
            .select('id, codigo, titulo, titulo_en, categoria, categoria_en, framework_id, ordem')
            .in('framework_id', frameworkIds)
            .order('ordem', { ascending: true }),
        ),
      ]);
      if (reqErr) throw reqErr;

      const fwMap = new Map((frameworks || []).map((f: any) => [f.id, f.nome as string]));
      const statusMap = new Map(
        (evals || []).map((e: any) => [e.requirement_id, e.conformity_status as string]),
      );

      return (reqs || []).map((r: any) => ({
        id: r.id,
        codigo: r.codigo || '',
        titulo: reqTitulo(r),
        categoria: reqCategoria(r) || '—',
        framework_id: r.framework_id,
        framework_nome: fwMap.get(r.framework_id) || '—',
        conformity_status: statusMap.get(r.id) || 'nao_avaliado',
      }));
    },
  });
}

/** Substitui o conjunto de requisitos vinculados a um risco. */
export function useSalvarRiscoRequisitos(riscoId: string | null) {
  const { profile, user } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (selecionados: Array<{ requirement_id: string; framework_id: string; tipo_vinculacao: string }>) => {
      if (!riscoId || !empresaId) throw new Error('Sem risco ou empresa.');
      const { error: delErr } = await supabase
        .from('riscos_requisitos')
        .delete()
        .eq('risco_id', riscoId)
        .eq('empresa_id', empresaId);
      if (delErr) throw delErr;
      if (selecionados.length === 0) return;
      const { error } = await supabase.from('riscos_requisitos').insert(
        selecionados.map((s) => ({
          risco_id: riscoId,
          empresa_id: empresaId,
          requirement_id: s.requirement_id,
          framework_id: s.framework_id,
          tipo_vinculacao: s.tipo_vinculacao || 'mitiga',
          created_by: user?.id ?? null,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risco-requisitos'] });
      queryClient.invalidateQueries({ queryKey: ['requisito-riscos'] });
    },
  });
}

export interface RiscoLigado {
  id: string;
  nome: string;
  nivel: string;
}

/**
 * Mapa requirement_id → riscos que dependem dele (para a SoA e para a tabela de
 * requisitos do Gap Analysis).
 */
export function useRequisitoRiscos(frameworkId?: string | null) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['requisito-riscos', frameworkId, empresaId],
    enabled: !!empresaId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Map<string, RiscoLigado[]>> => {
      let q = supabase
        .from('riscos_requisitos')
        .select('requirement_id, risco:riscos(id, nome, nivel_risco_inicial, nivel_risco_residual)')
        .eq('empresa_id', empresaId!);
      if (frameworkId) q = q.eq('framework_id', frameworkId);
      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, RiscoLigado[]>();
      ((data || []) as any[]).forEach((row) => {
        const r = Array.isArray(row.risco) ? row.risco[0] : row.risco;
        if (!r) return;
        const list = map.get(row.requirement_id) || [];
        list.push({
          id: r.id,
          nome: r.nome,
          nivel: r.nivel_risco_residual || r.nivel_risco_inicial || '',
        });
        map.set(row.requirement_id, list);
      });
      return map;
    },
  });
}
