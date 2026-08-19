/**
 * Bases legais de um tratamento — leitura e escrita.
 *
 * Um tratamento apoia-se com frequência em MAIS DO QUE UMA base legal, cada
 * uma a legitimar uma parte diferente da operação. É o que os ROPA reais dizem:
 *
 *   Execução de contrato (Art. 7º, V) para comunicações obrigatórias;
 *   Legítimo Interesse (Art. 7º, IX) para campanhas de relacionamento;
 *   Cumprimento de obrigação legal (Art. 7º, II) para retenção fiscal.
 *
 * `ropa_registros.base_legal` continua a existir e é a base de menor `ordem`,
 * projetada por gatilho — por isso o filtro da lista, o PDF e a busca global
 * continuam a funcionar sem saberem desta tabela. Quem escreve é sempre aqui.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { exigirEscrita } from '@/lib/supabase-write';

export interface BaseLegalDoRopa {
  id: string;
  ropa_id: string;
  empresa_id: string;
  base_legal: string;
  justificativa: string | null;
  /** Que parte da operação esta base cobre — é o que torna a lista auditável. */
  abrangencia: string | null;
  ordem: number;
}

/** Entrada de escrita: sem os identificadores, que o gravador preenche. */
export type BaseLegalEntrada = Pick<
  BaseLegalDoRopa,
  'base_legal' | 'justificativa' | 'abrangencia'
>;

const chave = (ropaId?: string) => ['ropa-bases-legais', ropaId] as const;

export function useRopaBasesLegais(ropaId?: string) {
  return useQuery({
    queryKey: chave(ropaId),
    enabled: !!ropaId,
    queryFn: async (): Promise<BaseLegalDoRopa[]> => {
      const { data, error } = await supabase
        .from('ropa_bases_legais')
        .select('id, ropa_id, empresa_id, base_legal, justificativa, abrangencia, ordem')
        .eq('ropa_id', ropaId!)
        .order('ordem')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as BaseLegalDoRopa[];
    },
  });
}

/**
 * Substitui a lista inteira de bases de um tratamento.
 *
 * Apaga e volta a inserir em vez de reconciliar linha a linha: a lista é curta
 * (raramente passa de quatro) e a ordem importa, portanto reconciliar dava mais
 * caminhos para errar do que reescrever. O gatilho recalcula a base primária a
 * cada operação, e a última que corre é a que fica.
 */
export function useGravarBasesLegais(ropaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      empresaId,
      bases,
    }: {
      empresaId: string;
      bases: BaseLegalEntrada[];
    }) => {
      if (!ropaId) throw new Error('Tratamento sem identificador');

      await exigirEscrita(supabase.from('ropa_bases_legais').delete().eq('ropa_id', ropaId));

      const limpas = bases
        .map((b) => ({ ...b, base_legal: b.base_legal?.trim() }))
        .filter((b) => b.base_legal);
      if (limpas.length === 0) return;

      await exigirEscrita(
        supabase.from('ropa_bases_legais').insert(
          limpas.map((b, i) => ({
            ropa_id: ropaId,
            empresa_id: empresaId,
            base_legal: b.base_legal,
            justificativa: b.justificativa?.trim() || null,
            abrangencia: b.abrangencia?.trim() || null,
            ordem: i,
          })),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chave(ropaId) });
      // A base primária de `ropa_registros` mudou por gatilho; a lista que a
      // mostra tem de voltar a ler.
      qc.invalidateQueries({ queryKey: ['privacidade'] });
    },
  });
}
