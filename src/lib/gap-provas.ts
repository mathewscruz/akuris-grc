/**
 * Quantas provas cada requisito tem — somando as DUAS portas por onde elas
 * entram.
 *
 * A prova de um requisito pode estar em dois sítios, e ambos são caminhos que o
 * produto oferece:
 *
 *  · `gap_analysis_evaluations.evidence_files` — o array antigo, escrito pelo
 *    carregamento directo dentro do diálogo do requisito;
 *  · `evidence_library_links` com `requirement_id` — a biblioteca de
 *    evidências, que é a consolidação e o que `DocumentosDoRequisito` escreve
 *    hoje, incluindo o reaproveitamento de uma prova já usada noutro framework.
 *
 * A Declaração de Aplicabilidade contava só o primeiro. O comentário que lá
 * está conta metade da história: a coluna já tinha sido um literal `0` — «a SoA
 * exportada declarava zero evidências em todas as linhas» — e a correcção
 * trocou o zero pelo array, deixando de fora a biblioteca. Resultado: quem
 * anexa pelo caminho normal continua a exportar «0 evidências» no documento que
 * vai para o auditor, que ali se lê como *nada comprovado*.
 *
 * Está numa função só porque agora há dois leitores: a SoA e o cartão de
 * prontidão. Duas contagens de provas em dois ecrãs seria a repetição do erro
 * que este módulo já teve com a aderência — três fórmulas paralelas e uma
 * guarda dedicada a impedir a quarta.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * `requirement_id` → número de provas. **`null` quando a leitura falhou.**
 *
 * A distinção não é preciosismo. Um mapa vazio significa «nenhum requisito tem
 * prova» — uma afirmação — e uma consulta falhada não autoriza afirmação
 * nenhuma. Devolvendo `null`, quem chama sabe que não sabe: a SoA mostra zero
 * (como já mostrava) e o cartão de prontidão **não** acusa ninguém de não ter
 * prova. É o mesmo erro que já custou caro noutros módulos — leitura que falha
 * apresentada como facto.
 */
export async function provasPorRequisito(
  frameworkId: string,
  empresaId: string,
): Promise<Map<string, number> | null> {
  const mapa = new Map<string, number>();
  try {
    const [avaliacoes, ligacoes] = await Promise.all([
      supabase
        .from('gap_analysis_evaluations')
        .select('requirement_id, evidence_files')
        .eq('framework_id', frameworkId)
        .eq('empresa_id', empresaId),
      supabase
        .from('evidence_library_links')
        .select('requirement_id')
        .eq('framework_id', frameworkId)
        .eq('empresa_id', empresaId)
        .not('requirement_id', 'is', null),
    ]);
    if (avaliacoes.error) throw avaliacoes.error;
    if (ligacoes.error) throw ligacoes.error;

    for (const a of avaliacoes.data ?? []) {
      const ficheiros = (a as { evidence_files?: unknown }).evidence_files;
      if (Array.isArray(ficheiros) && ficheiros.length > 0) {
        mapa.set(a.requirement_id, ficheiros.length);
      }
    }
    for (const l of ligacoes.data ?? []) {
      const id = (l as { requirement_id: string | null }).requirement_id;
      if (id) mapa.set(id, (mapa.get(id) ?? 0) + 1);
    }
  } catch (error) {
    logger.error('Erro ao contar provas dos requisitos', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  return mapa;
}
