# DocGen sem resposta na geração de política

## O que foi confirmado nos logs

Nos logs reais da função `docgen-chat` de hoje:

- `12:09:04` — pedido `generate_document` (ISO 27001) entra.
- `12:10:25` — score inicial calculado (28).
- `12:11:22` — auto-refino 1 termina (28 → 36, ainda 15 gaps).
- `12:11:34` — a função é encerrada (~2min30s de execução).

O limite de execução de uma Edge Function é da ordem de ~150s, então a requisição estoura o tempo antes de devolver o documento. Como o frontend chama sem timeout nem streaming, a tela fica em "gerando" para sempre e o usuário vê "sem resposta".

- `12:06:58` — outro erro real: o gateway de IA devolveu `403 credit_limit_reached` (limite de créditos do workspace). Esse erro virou HTTP 500 com texto genérico, sem avisar o usuário que era crédito.

## Causas

1. **Pipeline longo demais numa única requisição**: geração inicial + quality gate + até 2 rodadas de auto-refino, cada uma uma chamada ao modelo "pro" com até 18.000 tokens, tudo em série na mesma chamada HTTP.
2. **Sem streaming e sem timeout no cliente**: `supabase.functions.invoke` sem `signal`; se a função morre por timeout, a promessa nunca resolve e o loading nunca sai.
3. **Erros de crédito não chegam ao usuário**: 402/403 do gateway viram `Error` genérica → HTTP 500; o frontend só reconhece `CREDITS_EXHAUSTED`, então o diálogo de créditos nunca aparece.

## O que será feito

### 1. Quebrar a geração em etapas (fim do timeout)

- `generate_document` passa a fazer **apenas a geração inicial + score**, e retorna o documento já com o score e a lista de gaps residuais.
- O auto-refino vira uma ação separada `auto_refine` (uma tentativa por chamada), disparada pelo frontend logo após receber o documento, mostrando progresso ("Refinando para conformidade — tentativa 1 de 2").
- A cada etapa o usuário já vê conteúdo na tela; nenhuma chamada isolada passa de ~90s.

### 2. Proteção de tempo e recuperação no frontend

- Cada chamada ao `docgen-chat` ganha `AbortSignal` com teto de 120s e mensagem clara ao estourar ("A geração demorou mais que o esperado — tente novamente ou reduza o escopo"), sempre liberando o estado de loading.
- Botão "Tentar novamente" no lugar do estado travado, preservando o briefing e o histórico da conversa.
- `finally` garantido em todos os fluxos para nunca deixar `isLoading`/`isGeneratingDoc` presos.

### 3. Erros de crédito visíveis

- `callClaude` passa a distinguir 402/403 de crédito e a função retorna `{ error: 'CREDITS_EXHAUSTED' }` com HTTP 200, e `{ error: 'RATE_LIMITED' }` para 429.
- O frontend então abre o `CreditsExhaustedDialog` corretamente em vez de um toast genérico.

### 4. Guarda de custo/tempo no refino

- O auto-refino continua limitado a 2 tentativas, mas com corte adicional por tempo: se a etapa anterior levou mais de 60s, a próxima tentativa é oferecida como botão manual ("Refinar mais") em vez de automática.

## Detalhes técnicos

- `supabase/functions/docgen-chat/index.ts`: separar o bloco de auto-refino (linhas ~942-1034) numa nova action `auto_refine` que recebe `{ documento, framework_ids, attempt }` e devolve `{ documento, score_before, score_after, residual_gaps, should_continue }`; ajustar o handler de erro (linhas ~1525-1533) e `callClaude` (linhas ~81-119) para mapear 402/403/429 em códigos de erro estruturados.
- `src/components/documentos/DocGenDialog.tsx`: criar um helper único `callDocGen(body, { timeoutMs })` com `AbortController`, usado pelos cinco pontos de chamada (linhas ~314, 363, 470, 503, 530); encadear `generate_document` → `auto_refine` com atualização incremental do documento e do chip de score.
- Nenhuma alteração no cálculo de score (`_shared/compliance-score.ts`) para não quebrar a paridade com `analyze-document-adherence`; os testes existentes de compliance devem continuar passando.

## Observação

O limite de créditos do workspace já foi atingido hoje (403). Mesmo com as correções, se os créditos acabarem a geração não roda — a diferença é que o sistema vai dizer isso claramente.
