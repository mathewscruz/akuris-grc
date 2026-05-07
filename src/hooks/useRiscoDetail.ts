/**
 * useRiscoDetail — carrega tratamentos, histórico e controles vinculados ao risco aberto no drawer.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RiscoTratamento {
  id: string;
  descricao: string;
  tipo_tratamento: string;
  status: string;
  prazo: string | null;
  data_conclusao: string | null;
  responsavel: string | null;
  eficacia: string | null;
}

export interface RiscoHistoricoItem {
  id: string;
  created_at: string;
  tipo: string;
  probabilidade: string;
  impacto: string;
  nivel_risco: string;
  observacoes: string | null;
  avaliado_por: string | null;
}

export interface RiscoControleVinculado {
  id: string;
  controle_id: string;
  eficacia_estimada: string | null;
  tipo_vinculacao: string;
  controle: { nome: string; tipo: string; status: string; criticidade: string } | null;
}

export function useRiscoDetail(riscoId: string | null) {
  return useQuery({
    queryKey: ['risco-detail', riscoId],
    enabled: !!riscoId,
    queryFn: async () => {
      const [tratRes, histRes, ctrlRes] = await Promise.all([
        supabase
          .from('riscos_tratamentos')
          .select('id, descricao, tipo_tratamento, status, prazo, data_conclusao, responsavel, eficacia')
          .eq('risco_id', riscoId!)
          .order('created_at', { ascending: false }),
        supabase
          .from('riscos_historico_avaliacoes')
          .select('id, created_at, tipo, probabilidade, impacto, nivel_risco, observacoes, avaliado_por')
          .eq('risco_id', riscoId!)
          .order('created_at', { ascending: false }),
        supabase
          .from('controles_riscos')
          .select('id, controle_id, eficacia_estimada, tipo_vinculacao, controle:controles(nome, tipo, status, criticidade)')
          .eq('risco_id', riscoId!),
      ]);

      return {
        tratamentos: (tratRes.data || []) as RiscoTratamento[],
        historico: (histRes.data || []) as RiscoHistoricoItem[],
        controles: ((ctrlRes.data || []) as any[]).map((c) => ({
          ...c,
          controle: Array.isArray(c.controle) ? c.controle[0] : c.controle,
        })) as RiscoControleVinculado[],
      };
    },
    staleTime: 1000 * 60,
  });
}
