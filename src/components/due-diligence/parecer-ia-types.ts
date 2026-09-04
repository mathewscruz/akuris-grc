/** O que pedir ao fornecedor por causa de uma resposta fraca. */
export interface PedidoAoFornecedor {
  pergunta: string;
  respondeu: string;
  pedir: string;
}

/** A leitura de uma secção do questionário. */
export interface SecaoDoParecer {
  secao: string;
  pontosFortes?: string[];
  pontosAtencao?: string[];
  oQuePedir?: PedidoAoFornecedor[];
}

export interface ParecerDaIA {
  nivelRisco?: string;
  resumo?: string;
  pontosFortes?: string[];
  pontosAtencao?: string[];
  recomendacoes?: string[];
  evidenciasEmFalta?: string[];
  confianca?: string;
  modelo?: string;
  respostasAnalisadas?: number;
  secoes?: SecaoDoParecer[];
}
