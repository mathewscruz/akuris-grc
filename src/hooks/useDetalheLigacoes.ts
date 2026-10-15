/**
 * Ligações carregadas pelas fichas laterais. Todas as consultas usam
 * query keys por empresa e filtram empresa_id quando a tabela o tem;
 * tabelas-filhas (aditivos, marcos, comunicações) são lidas pelo id do pai,
 * que já veio filtrado por empresa, e continuam protegidas por RLS.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

function useEmpresa() {
  const { profile } = useAuth() as any;
  return (profile?.empresa_id as string | undefined) || null;
}

export function useContratoLigacoes(contratoId?: string | null) {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ['detalhe-contrato', empresaId, contratoId],
    enabled: !!empresaId && !!contratoId,
    queryFn: async () => {
      const [{ data: aditivos }, { data: marcos }] = await Promise.all([
        supabase.from('contrato_aditivos').select('id, numero_aditivo, tipo, status, valor_novo, data_assinatura, created_at').eq('contrato_id', contratoId!).order('created_at', { ascending: false }),
        supabase.from('contrato_marcos').select('id, nome, tipo, status, data_prevista, data_realizada, valor, created_at').eq('contrato_id', contratoId!).order('data_prevista', { ascending: true }),
      ]);
      return { aditivos: aditivos || [], marcos: marcos || [] };
    },
  });
}

export function useFornecedorLigacoes(fornecedorId?: string | null) {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ['detalhe-fornecedor', empresaId, fornecedorId],
    enabled: !!empresaId && !!fornecedorId,
    queryFn: async () => {
      const [{ data: contratos }, { data: avaliacoes }] = await Promise.all([
        supabase.from('contratos').select('id, nome, numero_contrato, status, valor, moeda, data_fim').eq('empresa_id', empresaId!).eq('fornecedor_id', fornecedorId!),
        supabase.from('due_diligence_assessments').select('id, status, score_final, ia_nivel_risco, data_envio, data_conclusao, created_at').eq('empresa_id', empresaId!).eq('fornecedor_id', fornecedorId!).order('created_at', { ascending: false }),
      ]);
      return { contratos: contratos || [], avaliacoes: avaliacoes || [] };
    },
  });
}

export function useIncidenteLigacoes(incidenteId?: string | null) {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ['detalhe-incidente', empresaId, incidenteId],
    enabled: !!empresaId && !!incidenteId,
    queryFn: async () => {
      const { data } = await supabase.from('incidentes_comunicacoes').select('id, tipo_comunicacao, destinatario, data_comunicacao, meio_comunicacao, created_at').eq('incidente_id', incidenteId!).order('data_comunicacao', { ascending: false });
      return { comunicacoes: data || [] };
    },
  });
}

export function useSistemaLigacoes(sistemaId?: string | null) {
  const empresaId = useEmpresa();
  return useQuery({
    queryKey: ['detalhe-sistema', empresaId, sistemaId],
    enabled: !!empresaId && !!sistemaId,
    queryFn: async () => {
      const { data } = await supabase.from('contas_privilegiadas').select('id, usuario_beneficiario, nivel_privilegio, status, data_expiracao').eq('empresa_id', empresaId!).eq('sistema_id', sistemaId!);
      return { contas: data || [] };
    },
  });
}
