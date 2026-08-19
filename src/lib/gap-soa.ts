import { supabase } from '@/integrations/supabase/client';

/**
 * Requisitos que a empresa declarou fora do escopo na Declaração de
 * Aplicabilidade.
 *
 * Existe porque a mesma consulta estava faltando em quatro lugares — o score,
 * a contagem por categoria, a fila de remediação e a exportação em PDF — e
 * cada um deles cobrava um requisito que a empresa já tinha dispensado, com
 * justificativa registrada e aceite formal. O caso mais grave era o PDF: é o
 * documento que vai para o auditor, e ele listava como lacuna algo que a
 * própria Declaração de Aplicabilidade excluía.
 */
export async function buscarForaDoEscopo(
  frameworkId: string,
  empresaId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('gap_analysis_soa')
    .select('requirement_id, aplicavel')
    .eq('framework_id', frameworkId)
    .eq('empresa_id', empresaId);

  return new Set(
    (data || []).filter((s) => s.aplicavel === false).map((s) => s.requirement_id),
  );
}
