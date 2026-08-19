import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Marco de certificação — a data-alvo contra a qual o score é lido.
 *
 * O cabeçalho do módulo tinha uma coluna "Próximo marco" com um convite
 * ("defina um marco para acompanhar o ritmo") e um botão cujo `onClick` era um
 * bloco vazio. Estes hooks são o outro lado desse botão.
 *
 * **O marco pertence ao framework, não à empresa.** A empresa escolhe quantos
 * frameworks quiser, e "faltam 35 pontos para a meta" não quer dizer nada
 * quando o índice é a média ponderada de ISO 27001, LGPD e NIST CSF. Quem
 * certifica, certifica um framework, numa data. A lista de frameworks mostra o
 * marco mais próximo entre os ativos, dizendo de qual é; quem define é a tela
 * do framework.
 */

export interface MarcoCertificacao {
  id: string;
  rotulo: string;
  /** ISO `YYYY-MM-DD`. */
  data_alvo: string;
  score_alvo: number;
  framework_id: string;
}

/** O marco mais próximo da empresa, com o framework a que pertence. */
export interface ProximoMarco extends MarcoCertificacao {
  framework_nome: string;
}

const chave = (empresaId?: string, frameworkId?: string) =>
  ['gap-marco', empresaId ?? null, frameworkId ?? null] as const;

export function useMarcoCertificacao(empresaId?: string, frameworkId?: string) {
  return useQuery<MarcoCertificacao | null>({
    queryKey: chave(empresaId, frameworkId),
    enabled: !!empresaId && !!frameworkId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gap_analysis_marcos')
        .select('id, rotulo, data_alvo, score_alvo, framework_id')
        .eq('empresa_id', empresaId!)
        .eq('framework_id', frameworkId!)
        .is('concluido_em', null)
        .order('data_alvo', { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as MarcoCertificacao) ?? null;
    },
  });
}

/**
 * O marco em aberto mais próximo da empresa, seja de que framework for.
 *
 * É o que a lista de frameworks mostra: ali não há um framework escolhido, e
 * inventar um marco "da carteira" seria somar prazos de coisas diferentes.
 */
export function useProximoMarcoDaEmpresa(empresaId?: string) {
  return useQuery<ProximoMarco | null>({
    queryKey: ['gap-marco-proximo', empresaId ?? null],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gap_analysis_marcos')
        .select('id, rotulo, data_alvo, score_alvo, framework_id, gap_analysis_frameworks(nome)')
        .eq('empresa_id', empresaId!)
        .is('concluido_em', null)
        .order('data_alvo', { ascending: true })
        .limit(1);
      if (error) throw error;
      const linha = data?.[0] as (MarcoCertificacao & {
        gap_analysis_frameworks?: { nome?: string } | null;
      }) | undefined;
      if (!linha) return null;
      return { ...linha, framework_nome: linha.gap_analysis_frameworks?.nome || '' };
    },
  });
}

export interface MarcoParaGravar {
  empresaId: string;
  frameworkId: string;
  rotulo: string;
  dataAlvo: string;
  scoreAlvo: number;
  /** Presente quando se está a editar o marco já existente. */
  id?: string;
}

/** Invalida o marco do framework e o "mais próximo" da lista. */
function invalidar(qc: ReturnType<typeof useQueryClient>, empresaId: string, frameworkId: string) {
  qc.invalidateQueries({ queryKey: chave(empresaId, frameworkId) });
  qc.invalidateQueries({ queryKey: ['gap-marco-proximo', empresaId] });
}

export function useSalvarMarco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: MarcoParaGravar) => {
      const linha = {
        empresa_id: m.empresaId,
        framework_id: m.frameworkId,
        rotulo: m.rotulo.trim(),
        data_alvo: m.dataAlvo,
        score_alvo: m.scoreAlvo,
      };
      const { error } = m.id
        ? await supabase.from('gap_analysis_marcos').update(linha).eq('id', m.id)
        : await supabase.from('gap_analysis_marcos').insert(linha);
      if (error) throw error;
    },
    onSuccess: (_r, m) => invalidar(qc, m.empresaId, m.frameworkId),
  });
}

export function useRemoverMarco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { id: string; empresaId: string; frameworkId: string }) => {
      const { error } = await supabase.from('gap_analysis_marcos').delete().eq('id', m.id);
      if (error) throw error;
    },
    onSuccess: (_r, m) => invalidar(qc, m.empresaId, m.frameworkId),
  });
}
