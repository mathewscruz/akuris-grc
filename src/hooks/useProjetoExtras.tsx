import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

/* =========================================================
   SPRINTS
========================================================= */
export interface ProjetoSprint {
  id: string;
  empresa_id: string;
  projeto_id: string;
  nome: string;
  objetivo: string | null;
  data_inicio: string;
  data_fim: string;
  ativa: boolean;
  concluida: boolean;
  created_at: string;
}

export function useSprints(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto-sprints', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_sprints' as any)
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoSprint[];
    },
  });
}

export function useUpsertSprint(projetoId: string) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  return useMutation({
    mutationFn: async (sprint: Partial<ProjetoSprint> & { id?: string; nome: string; data_inicio: string; data_fim: string }) => {
      if (!empresaId) throw new Error('Empresa não identificada');
      const { id, ...rest } = sprint;
      if (id) {
        const { error } = await supabase.from('projeto_sprints' as any).update(rest as any).eq('id', id).eq('empresa_id', empresaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projeto_sprints' as any).insert({ ...rest, projeto_id: projetoId, empresa_id: empresaId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto-sprints', projetoId] });
      toast.success('Sprint salva');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useDeleteSprint(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_sprints' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto-sprints', projetoId] });
      toast.success('Sprint removida');
    },
  });
}

/* =========================================================
   TIME TRACKING
========================================================= */
export interface TempoEntrada {
  id: string;
  empresa_id: string;
  tarefa_id: string;
  user_id: string;
  horas: number;
  descricao: string | null;
  data: string;
  created_at: string;
}

export function useTempoEntradas(tarefaId: string | undefined) {
  return useQuery({
    queryKey: ['tarefa-tempo', tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_tempo_entradas' as any)
        .select('*')
        .eq('tarefa_id', tarefaId!)
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TempoEntrada[];
    },
  });
}

export function useAddTempo(tarefaId: string) {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ horas, descricao, data }: { horas: number; descricao?: string; data?: string }) => {
      if (!user || !profile?.empresa_id) throw new Error('Não autenticado');
      const { error } = await supabase.from('projeto_tempo_entradas' as any).insert({
        empresa_id: profile.empresa_id,
        tarefa_id: tarefaId,
        user_id: user.id,
        horas,
        descricao: descricao ?? null,
        data: data ?? new Date().toISOString().slice(0, 10),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tarefa-tempo', tarefaId] });
      qc.invalidateQueries({ queryKey: ['projeto-tarefas'] });
      toast.success('Tempo registrado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useDeleteTempo(tarefaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_tempo_entradas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tarefa-tempo', tarefaId] });
      qc.invalidateQueries({ queryKey: ['projeto-tarefas'] });
    },
  });
}

/* =========================================================
   REAÇÕES EM COMENTÁRIOS
========================================================= */
export interface ComentarioReacao {
  id: string;
  comentario_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export function useReacoes(comentarioIds: string[]) {
  return useQuery({
    queryKey: ['comentario-reacoes', [...comentarioIds].sort().join(',')],
    enabled: comentarioIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_comentario_reacoes' as any)
        .select('*')
        .in('comentario_id', comentarioIds);
      if (error) throw error;
      return (data ?? []) as unknown as ComentarioReacao[];
    },
  });
}

export function useToggleReacao() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ comentarioId, emoji, atual }: { comentarioId: string; emoji: string; atual?: ComentarioReacao }) => {
      if (!user || !profile?.empresa_id) throw new Error('Não autenticado');
      if (atual) {
        const { error } = await supabase.from('projeto_comentario_reacoes' as any).delete().eq('id', atual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projeto_comentario_reacoes' as any).insert({
          comentario_id: comentarioId,
          user_id: user.id,
          empresa_id: profile.empresa_id,
          emoji,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comentario-reacoes'] }),
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

/* =========================================================
   AUTOMAÇÕES
========================================================= */
export interface Automacao {
  id: string;
  empresa_id: string;
  projeto_id: string;
  nome: string;
  descricao: string | null;
  gatilho: string;
  condicoes: Record<string, any>;
  acoes: Array<Record<string, any>>;
  ativa: boolean;
  ultima_execucao_em: string | null;
  execucoes_count: number;
  created_at: string;
}

export function useAutomacoes(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto-automacoes', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_automacoes' as any)
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Automacao[];
    },
  });
}

export function useUpsertAutomacao(projetoId: string) {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (a: Partial<Automacao> & { id?: string; nome: string; gatilho: string }) => {
      if (!profile?.empresa_id) throw new Error('Empresa não identificada');
      const { id, ...rest } = a;
      if (id) {
        const { error } = await supabase.from('projeto_automacoes' as any).update(rest as any).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projeto_automacoes' as any).insert({
          ...rest,
          projeto_id: projetoId,
          empresa_id: profile.empresa_id,
          criado_por: user?.id ?? null,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto-automacoes', projetoId] });
      toast.success('Automação salva');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useDeleteAutomacao(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_automacoes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projeto-automacoes', projetoId] }),
  });
}

/* =========================================================
   TEMPLATES
========================================================= */
export interface Template {
  id: string;
  empresa_id: string | null;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  dados: { colunas?: Array<{ nome: string; ordem: number; is_concluido?: boolean }>; tarefas?: Array<{ titulo: string; prioridade?: string }> };
  is_global: boolean;
  created_at: string;
}

export function useTemplates() {
  return useQuery({
    queryKey: ['projeto-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_templates' as any)
        .select('*')
        .order('is_global', { ascending: false })
        .order('nome');
      if (error) throw error;
      return (data ?? []) as unknown as Template[];
    },
  });
}

export function useUpsertTemplate() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (t: Partial<Template> & { id?: string; nome: string; dados: Template['dados'] }) => {
      const { id, ...rest } = t;
      const payload: any = {
        ...rest,
        empresa_id: t.is_global ? null : profile?.empresa_id,
        criado_por: user?.id,
      };
      if (id) {
        const { error } = await supabase.from('projeto_templates' as any).update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projeto_templates' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto-templates'] });
      toast.success('Template salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projeto_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projeto-templates'] });
      toast.success('Template removido');
    },
  });
}

export function useAplicarTemplate() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ template, nomeProjeto }: { template: Template; nomeProjeto: string }) => {
      if (!profile?.empresa_id || !user) throw new Error('Não autenticado');
      // 1) cria projeto
      const { data: proj, error: ePr } = await supabase
        .from('projetos' as any)
        .insert({
          empresa_id: profile.empresa_id,
          nome: nomeProjeto,
          descricao: template.descricao,
          status: 'ativo',
          owner_id: user.id,
        } as any)
        .select('id')
        .single();
      if (ePr) throw ePr;
      const projetoId = (proj as any).id as string;

      // 2) Se template define colunas, remove default e cria as do template
      const colunasTpl = template.dados?.colunas ?? [];
      if (colunasTpl.length > 0) {
        await supabase.from('projeto_colunas' as any).delete().eq('projeto_id', projetoId);
        const linhas = colunasTpl.map((c, i) => ({
          projeto_id: projetoId, nome: c.nome, ordem: c.ordem ?? i, is_concluido: c.is_concluido ?? false,
        }));
        const { error: eC } = await supabase.from('projeto_colunas' as any).insert(linhas as any);
        if (eC) throw eC;
      }

      // 3) Recupera primeira coluna para insert das tarefas
      const { data: cols } = await supabase
        .from('projeto_colunas' as any).select('id').eq('projeto_id', projetoId).order('ordem').limit(1);
      const primeiraColuna = (cols as any[])?.[0]?.id;

      const tarefasTpl = template.dados?.tarefas ?? [];
      if (tarefasTpl.length > 0 && primeiraColuna) {
        const linhas = tarefasTpl.map((t, i) => ({
          projeto_id: projetoId,
          coluna_id: primeiraColuna,
          titulo: t.titulo,
          prioridade: t.prioridade ?? 'media',
          ordem: i,
          criador_id: user.id,
        }));
        const { error: eT } = await supabase.from('projeto_tarefas' as any).insert(linhas as any);
        if (eT) throw eT;
      }
      return projetoId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] });
      toast.success('Projeto criado a partir do template');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao aplicar template'),
  });
}
