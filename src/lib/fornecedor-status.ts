/**
 * Situação do fornecedor — vocabulário único da tabela `fornecedores`.
 *
 * A mesma coluna é escrita por dois módulos com listas diferentes: o diálogo
 * de Contratos oferece `ativo | inativo | suspenso`, o Due Diligence só
 * conhece `ativo | inativo`, e o próprio seed do produto traz `em_avaliacao`.
 *
 * O efeito era o pior possível para um módulo de due diligence: a lista
 * filtrava por `ativo` **por omissão**, com o filtro escondido atrás de um
 * botão, e nem sequer oferecia as outras situações. Um terceiro suspenso ou
 * em avaliação — exactamente os que precisam de ser reavaliados —
 * desaparecia do ecrã sem que nada o dissesse.
 */
export const FORNECEDOR_STATUS = ['ativo', 'em_avaliacao', 'suspenso', 'inativo'] as const;

export type FornecedorStatus = (typeof FORNECEDOR_STATUS)[number];

const CHAVES: Record<string, string> = {
  ativo: 'fornecedorStatus.ativo',
  em_avaliacao: 'fornecedorStatus.emAvaliacao',
  suspenso: 'fornecedorStatus.suspenso',
  inativo: 'fornecedorStatus.inativo',
};

/** Tom do chip: só `ativo` é neutro-positivo; o resto pede atenção. */
export const tomDoStatusFornecedor = (
  status?: string | null,
): 'success' | 'warning' | 'destructive' | 'neutral' => {
  switch (status) {
    case 'ativo':
      return 'success';
    case 'em_avaliacao':
      return 'warning';
    case 'suspenso':
      return 'destructive';
    default:
      return 'neutral';
  }
};

/** Um valor fora do vocabulário continua visível pelo que está gravado. */
export function rotuloStatusFornecedor(
  status: string | null | undefined,
  t: (chave: string) => string,
): string {
  if (!status) return '-';
  return CHAVES[status] ? t(CHAVES[status]) : status;
}

export function opcoesStatusFornecedor(
  t: (chave: string) => string,
): { value: string; label: string }[] {
  return FORNECEDOR_STATUS.map((s) => ({ value: s, label: t(CHAVES[s]) }));
}
