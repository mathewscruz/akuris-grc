export type Acao = {
  titulo: string;
  descricao?: string;
  prioridade?: string;
  requisito_codigo?: string | null;
  requirement_id?: string | null;
  essencial?: boolean;
  exigencia_norma?: string;
  evidencia_documento?: string;
  impacto?: string;
  passos?: string[];
  texto_sugerido?: string;
};

/**
 * Separa ajustes essenciais (sem eles a política não fica em compliance) das
 * boas práticas. Análises antigas não trazem `essencial`: alta/média contam
 * como essenciais. Numa política já em compliance nada é pendência.
 */
export function agruparAjustes(acoes: Acao[], emCompliance: boolean) {
  const essenciais: { acao: Acao; idx: number }[] = [];
  const recomendados: { acao: Acao; idx: number }[] = [];
  acoes.forEach((acao, idx) => {
    const essencial = !emCompliance && (typeof acao.essencial === 'boolean' ? acao.essencial : acao.prioridade !== 'baixa');
    (essencial ? essenciais : recomendados).push({ acao, idx });
  });
  return { essenciais, recomendados };
}

/** Tem instrução detalhada (análises novas) ou só título/descrição (antigas). */
export const temInstrucao = (a: Acao) =>
  !!(a.exigencia_norma || a.evidencia_documento || a.impacto || a.texto_sugerido || (a.passos && a.passos.length));
