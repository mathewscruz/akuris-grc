import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import type { Projeto, ProjetoStatus } from '@/types/projetos';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function useProjetos(filtroStatus?: ProjetoStatus | 'todos') {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['projetos', empresaId, filtroStatus ?? 'todos'],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from('projetos' as any)
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('created_at', { ascending: false });
      if (filtroStatus && filtroStatus !== 'todos') {
        q = q.eq('status', filtroStatus);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Projeto[];
    },
  });
}

export function useProjeto(id: string | undefined) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useQuery({
    queryKey: ['projeto', id],
    enabled: !!id && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projetos' as any)
        .select('*')
        .eq('id', id!)
        .eq('empresa_id', empresaId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Projeto | null;
    },
  });
}

export interface ProjetoInput {
  nome: string;
  descricao?: string | null;
  status?: ProjetoStatus;
  owner_id: string;
  data_inicio?: string | null;
  data_fim_prevista?: string | null;
  cor?: string | null;
  icone?: string | null;
}

export function useUpsertProjeto() {
  const qc = useQueryClient();
  const { profile, user } = useAuth();
  const empresaId = profile?.empresa_id;

  return useMutation({
    mutationFn: async ({ id, ...input }: ProjetoInput & { id?: string }) => {
      if (!empresaId) throw new Error('Empresa não identificada');
      if (id) {
        const { data, error } = await supabase
          .from('projetos' as any)
          .update(input as any)
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .select('*')
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('projetos' as any)
          .insert({ ...input, empresa_id: empresaId, created_by: user?.id } as any)
          .select('*')
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] });
      qc.invalidateQueries({ queryKey: ['projeto'] });
      toast.success('Projeto salvo com sucesso');
    },
    onError: (err: any) => {
      logger.error('Erro ao salvar projeto', err);
      toast.error(err.message || 'Erro ao salvar projeto');
    },
  });
}

export function useDeleteProjeto() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  return useMutation({
    mutationFn: async (id: string) => {
      if (!empresaId) throw new Error('Empresa não identificada');
      const { error } = await supabase
        .from('projetos' as any)
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] });
      toast.success('Projeto removido');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover'),
  });
}
