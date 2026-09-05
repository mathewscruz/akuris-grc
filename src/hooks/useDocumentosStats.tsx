import { readAllPages } from "@/lib/read-all-pages";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { contarDocumentos } from "@/lib/metrics";

interface DocumentosStats {
  total: number;
  ativos: number;
  vencidos: number;
  vencendo30Dias: number;
  confidenciais: number;
  aprovados: number;
  pendentesAprovacao: number;
}

export const useDocumentosStats = () => {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['documentos-stats', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }): Promise<DocumentosStats> => {
      const { data: documentos, error } = await readAllPages((from, to) => supabase
        .from('documentos')
        .select('status, data_vencimento, classificacao, data_aprovacao')
        .eq('empresa_id', empresaId!).order('id').range(from, to).abortSignal(signal), signal);

      if (error) throw error;

      return contarDocumentos(documentos);
    },
  });
};
