/**
 * Situação do fornecedor.
 *
 * Namespace próprio porque a coluna `fornecedores.status` é partilhada por
 * Contratos e Due Diligence — ter o rótulo dentro de um deles foi como as duas
 * listas divergiram e como `em_avaliacao`, que o próprio seed do produto
 * grava, ficou sem nome em metade da aplicação.
 */
export const fornecedorStatus = {
  pt: {
    fornecedorStatus: {
      ativo: 'Ativo',
      emAvaliacao: 'Em avaliação',
      suspenso: 'Suspenso',
      inativo: 'Inativo',
      todos: 'Todos',
    },
  },
  en: {
    fornecedorStatus: {
      ativo: 'Active',
      emAvaliacao: 'Under assessment',
      suspenso: 'Suspended',
      inativo: 'Inactive',
      todos: 'All',
    },
  },
};
