# Corrigir definitivamente a falha recorrente do DocGen

## Diagnóstico confirmado

A geração enviada às 01:31:58 chegou ao AI Gateway, mas o modelo `google/gemini-3.1-pro-preview` ficou **90,09 segundos sem devolver qualquer resposta** e o gateway encerrou a chamada com `503 upstream_stall`. O pedido tinha 2.966 tokens de entrada e produziu zero tokens de saída.

Hoje o `docgen-chat` transforma qualquer erro 5xx do gateway diretamente em `AI_ERROR`/502. Não existe uma segunda tentativa automática para indisponibilidade do provedor; o frontend apenas mostra “A geração não foi concluída”. A repetição automática existente cobre somente JSON inválido, não falha 503. O botão manual também cria uma nova chave de idempotência a cada clique.

## Implementação

1. **Fallback automático dentro do `docgen-chat`**
   - Encapsular a chamada ao modelo numa política de resiliência específica para geração de documentos.
   - Manter o Gemini 3.1 Pro como primeira opção de qualidade.
   - Se ocorrer 500/502/503/504, falha de rede ou ausência de resposta dentro do limite da tentativa, repetir automaticamente com o modelo rápido já suportado pelo projeto.
   - Não repetir erros de crédito, limite de requisições, autenticação nem cancelamento do utilizador.

2. **Orçamento de tempo real por tentativa**
   - Dividir o orçamento de 115 segundos entre tentativa principal e fallback, em vez de permitir que o primeiro provedor consuma praticamente todo o tempo.
   - Propagar `AbortSignal` para interromper realmente cada tentativa vencida.
   - Garantir tempo suficiente para o fallback concluir antes do limite da Edge Function.

3. **Crédito e idempotência sem cobrança duplicada**
   - Fazer as duas tentativas pertencerem à mesma operação e à mesma chave de idempotência.
   - Consumir apenas um crédito quando o fallback recuperar a geração.
   - Estornar apenas quando todas as tentativas falharem.
   - Reutilizar a chave da tentativa lógica também no botão “Tentar novamente”, evitando novo débito caso a resposta anterior tenha sido concluída no servidor, mas perdida no cliente.

4. **Resposta estruturada e experiência do utilizador**
   - Retornar códigos distintos para indisponibilidade temporária, timeout e falha definitiva.
   - Fazer o frontend recuperar automaticamente sem exibir erro quando o fallback funcionar.
   - Quando ambas falharem, mostrar uma mensagem clara de indisponibilidade temporária, mantendo briefing, conversa e possibilidade segura de repetir.
   - Substituir o `console.error` deste fluxo pelo logger padrão do Akuris.

5. **Validação de regressão**
   - Criar testes da política de retry cobrindo: 503 seguido de sucesso, timeout seguido de sucesso, 402 sem retry, 429 sem retry, cancelamento sem retry, duas falhas com estorno e sucesso via fallback com um único consumo.
   - Testar a geração completa preservando documento, conversa e chave de idempotência.
   - Executar os testes da Edge Function e validar a função implantada com uma chamada real autenticada.

## Resultado esperado

Um `503 upstream_stall` isolado deixa de interromper a demonstração: o DocGen troca de modelo automaticamente, conclui o documento dentro do orçamento da função e cobra no máximo um crédito por geração lógica.