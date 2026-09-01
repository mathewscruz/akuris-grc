/**
 * Onde se escolhe o modelo. Um sítio, não quinze.
 *
 * Estava espalhado: cada função trazia o nome escrito à mão, e o produto
 * acabou com **seis** modelos em produção — `2.5-flash`, `2.5-flash-lite`,
 * `3-flash-preview`, `3.1-flash-lite`, `3.1-pro-preview` e `3.6-flash`.
 * Trocar de modelo era editar quinze ficheiros e descobrir o décimo sexto
 * mais tarde.
 *
 * As escolhas são por FEITIO DO TRABALHO, não por função:
 *
 *  · `MECANICO` — transformação literal, sem juízo: traduzir um requisito de
 *    uma língua para outra. O texto de partida manda em tudo.
 *  · `PADRAO` — há juízo, e alguém lê o resultado: sugerir tratamento de
 *    risco, diagnosticar lacunas, escrever a orientação que fica no catálogo,
 *    responder no chat. É a maior parte do produto.
 *  · `LEITURA_LONGA` — ler um documento inteiro contra um requisito.
 *  · `RESERVA` — rede de segurança, noutro fornecedor de propósito.
 *
 * ## Porquê estes, e não os que cá estavam
 *
 * Treze das quinze funções corriam em `gemini-3-flash-preview`. Um `-preview`
 * pode mudar ou desaparecer sem aviso; numa funcionalidade que o cliente paga,
 * isso é risco de disponibilidade, não um pormenor.
 *
 * `PADRAO` passa a ser `3.6-flash`: geração mais recente, mesmo nível, e
 * **estável**. Qualidade igual ou melhor, e sai do preview. Custa o dobro por
 * pedido (R$0,06 contra R$0,03) — e a esse volume isso é ruído: o produto fez
 * 144 chamadas em seis meses, ou seja a diferença acumulada é de alguns reais.
 * Trocar estabilidade por sete reais seria mau negócio.
 *
 * `MECANICO` é `3.1-flash-lite`, a um terço do preço do que cá estava. Fica
 * reservado à tradução, que é o único trabalho onde o nível `lite` não pode
 * decidir nada de errado — e é dos poucos que cresce por requisito, portanto é
 * onde o preço se multiplica. Não o pus no cruzamento de evidências nem na
 * pontuação de questionário: esses alimentam decisões de conformidade, e
 * poupar um cêntimo à custa de um juízo pior é o negócio ao contrário.
 *
 * `LEITURA_LONGA` fica em `3.1-pro-preview`. É o único ainda em preview, e
 * fica de propósito: não há um `pro` estável no catálogo, e descer o trabalho
 * mais difícil do produto para um nível `flash` seria trocar qualidade por
 * dinheiro — exactamente o que não se pediu.
 *
 * Os dois modelos novos **já corriam neste produto**: são o rápido e o bom da
 * `docgen-chat`. Não é uma aposta em nome desconhecido.
 *
 * `RESERVA` fica noutro fornecedor porque uma avaria do primeiro não pode
 * parar o produto — e é o ÚNICO ponto onde entra um segundo. A família GPT-5
 * recusa `max_tokens` e temperatura não-padrão; quem a usar trata disso (ver
 * `docgen-chat`).
 */

export const MODELOS = {
  /** Transformação literal: tradução. Nível `lite` chega e custa um terço. */
  MECANICO: 'google/gemini-3.1-flash-lite',
  /** Há juízo e alguém lê. A maior parte do produto. */
  PADRAO: 'google/gemini-3.6-flash',
  /** Documento inteiro contra requisito. O mais caro, e o que o justifica. */
  LEITURA_LONGA: 'google/gemini-3.1-pro-preview',
  /** Geração de imagem para campanhas. Sem equivalente nos outros níveis. */
  IMAGEM: 'google/gemini-2.5-flash-image',
  /** Rede de segurança, noutro fornecedor. */
  RESERVA: 'openai/gpt-5.4-mini',
} as const;

export type ModeloAkuris = typeof MODELOS[keyof typeof MODELOS];
