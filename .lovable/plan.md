# Corrigir o erro 503 em "Analisando a conformidade" (Comprovar, ISO 27001)

## O que aconteceu
Os registos de 16/10 mostram:
- Documento recebido sem problema (Política de Segurança da Informação, 18 KB).
- A análise pediu ao modelo de IA, **num único pedido**, a avaliação dos **121 requisitos** da ISO 27001, com até 48 mil palavras de resposta.
- O serviço de IA trabalhou cerca de **3 minutos** e devolveu "Service temporarily unavailable" (503). O sistema não tentou de novo e mostrou o erro cru.
- O crédito **não** foi cobrado (só é cobrado depois de sucesso).

Ou seja: o pedido é grande demais para uma só chamada, e uma falha temporária não tem segunda tentativa.

## O que vou mudar
1. **Dividir a análise em lotes**: os requisitos são avaliados em grupos de ~25, com 2 a 3 lotes em simultâneo. Cada lote termina em segundos em vez de minutos, e os resultados são juntados no fim com o mesmo cálculo de pontuação de hoje.
2. **Nova tentativa automática**: se um lote recebe falha temporária (503/5xx ou limite de pedidos), tenta de novo até 2 vezes com espera crescente. Outros erros não são repetidos.
3. **Resultado parcial em vez de nada**: se algum lote falhar mesmo assim, os requisitos dele entram como "não avaliados" (fora da pontuação) e o utilizador vê um aviso para reanalisar, em vez de perder tudo.
4. **Mensagem clara no ecrã**: em vez de "Erro na IA (503): {...}", aparece "O serviço de análise está temporariamente indisponível. Tente novamente em alguns minutos" com botão "Tentar novamente", em PT-BR, pt-PT e EN.
5. **Crédito**: continua a ser cobrado 1 crédito só quando a análise conclui.

## Detalhes técnicos
- `supabase/functions/analyze-document-adherence/index.ts`: extrair a chamada para `analisarLote(reqs)`; `max_tokens` por lote ~12k; pool de concorrência 3; retry com backoff+jitter só em 429/5xx (respeita `Retry-After`); juntar `requisitos_analisados`, pontos fortes/melhoria e recomendações (dedupe); resumo executivo de um lote final curto ou concatenação; `computeAnalyzedScore` sobre o conjunto, excluindo lotes falhados; devolver `status` 503 com código `ia_indisponivel` quando todos falham.
- Teste Deno novo para o merge de lotes e para o retry (só 429/5xx repetem).
- Frontend (`AdherenceAnalysisProgress` / chamada via `invokeEdgeFunction`): mapear `ia_indisponivel` para a mensagem traduzida + botão de repetir; aviso de requisitos não avaliados.
- Sem alterações na base de dados.
