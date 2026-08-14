/**
 * Biblioteca global de cenários de risco (catálogo partilhado, sem empresa_id).
 *
 * A importação é feita pela RPC `importar_riscos_biblioteca`, que resolve a
 * empresa do utilizador autenticado no servidor — nada aqui aceita empresa_id
 * vindo do cliente.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface RiscoBiblioteca {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  causas: string[] | null;
  consequencias: string[] | null;
  probabilidade_sugerida: number;
  impacto_sugerido: number;
  tipos_ativo: string[] | null;
  controlos_recomendados: string[] | null;
  origem: string | null;
  tags: string[] | null;
}

export interface ImportarResultado {
  criados: number;
  ignorados_duplicados: number;
  ligacoes_criadas: number;
  controlos_nao_encontrados: number;
}

/** Catálogo global — leitura para qualquer utilizador autenticado. */
export function useRiscosBiblioteca(enabled = true) {
  return useQuery({
    queryKey: ['riscos-biblioteca'],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<RiscoBiblioteca[]> => {
      const { data, error } = await (supabase as any)
        .from('riscos_biblioteca')
        .select(
          'id, codigo, titulo, descricao, categoria, causas, consequencias, ' +
            'probabilidade_sugerida, impacto_sugerido, tipos_ativo, ' +
            'controlos_recomendados, origem, tags',
        )
        .order('codigo');
      if (error) throw error;
      return (data ?? []) as RiscoBiblioteca[];
    },
  });
}

/** Códigos da biblioteca já importados por esta empresa (evita duplicados). */
export function useRiscosBibliotecaImportados(enabled = true) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['riscos-biblioteca-importados', empresaId],
    enabled: enabled && !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('riscos')
        .select('biblioteca_codigo')
        .eq('empresa_id', empresaId!)
        .not('biblioteca_codigo', 'is', null);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.biblioteca_codigo as string));
    },
  });
}

export function useImportarBiblioteca() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      codigos,
      mapearControlos,
    }: {
      codigos: string[];
      mapearControlos: boolean;
    }): Promise<ImportarResultado> => {
      const { data, error } = await supabase.rpc('importar_riscos_biblioteca', {
        codigos,
        mapear_controlos: mapearControlos,
      });
      if (error) throw error;
      return data as unknown as ImportarResultado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riscos-biblioteca-importados'] });
    },
  });
}
