/**
 * Onde se escolhe o modelo. Um sítio, não quinze.
 *
 * Estava espalhado: cada função trazia o nome do modelo escrito à mão, e o
 * produto acabou com **seis** modelos diferentes em produção — `2.5-flash`,
 * `2.5-flash-lite`, `3-flash-preview`, `3.1-flash-lite`, `3.1-pro-preview` e
 * `3.6-flash`. Trocar de modelo era editar quinze ficheiros e descobrir o
 * décimo sexto mais tarde.
 *
 * Aqui as escolhas são três, por FEITIO DO TRABALHO e não por função:
 *
 *  · `EXTRACAO` — classificar, comparar, devolver JSON curto. É a maior parte
 *    do produto: cruzar evidência, pontuar questionário, diagnosticar lacunas,
 *    traduzir requisito. Trabalho mecânico, resposta curta, formato fixo.
 *  · `REDACAO` — escrever para uma pessoa ler: política, resposta de chat,
 *    orientação que fica no catálogo. Vale mais qualidade.
 *  · `LEITURA_LONGA` — ler um documento inteiro contra um requisito. É o mais
 *    caro por pedido, e o único que hoje justifica um modelo `pro`.
 *
 * `RESERVA` é a rede: fica noutro fornecedor de propósito, para uma avaria do
 * primeiro não parar o produto. É o ÚNICO ponto onde entra um segundo
 * fornecedor — a família GPT-5 recusa `max_tokens` e temperatura não-padrão, e
 * quem a usar tem de tratar disso (ver `docgen-chat`).
 *
 * ATENÇÃO aos `-preview`: podem mudar ou desaparecer sem aviso. Treze funções
 * dependiam de um. Estão aqui para ficar registado o que corre hoje — trocar
 * por um estável é uma decisão de qualidade, e passa a ser uma linha.
 */

export const MODELOS = {
  /** Classificar, comparar, extrair JSON curto. O mais barato que serve. */
  EXTRACAO: 'google/gemini-3-flash-preview',
  /** Texto que uma pessoa vai ler. */
  REDACAO: 'google/gemini-3.6-flash',
  /** Documento inteiro contra requisito. */
  LEITURA_LONGA: 'google/gemini-3.1-pro-preview',
  /** Rede de segurança, noutro fornecedor. */
  RESERVA: 'openai/gpt-5.4-mini',
} as const;

export type ModeloAkuris = typeof MODELOS[keyof typeof MODELOS];
