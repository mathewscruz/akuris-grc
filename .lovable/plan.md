# Modelo de IA do DocGen: melhor qualidade com melhor custo

## Situação atual (verificada no código)

`supabase/functions/docgen-chat/index.ts` usa:
- Qualidade (geração e refino do documento): `google/gemini-3.1-pro-preview`
- Rápido (tarefas leves e fallback de resiliência): `google/gemini-3-flash-preview`

O Pro é o modelo mais caro e lento do fluxo — foi ele que provocou o stall de ~90s e o erro 503 recente.

## Recomendação

Trocar o par de modelos por geração atual, com melhor relação custo/qualidade e menor latência:

| Papel | Hoje | Proposto |
| --- | --- | --- |
| Geração/refino do documento | `google/gemini-3.1-pro-preview` | `google/gemini-3.6-flash` |
| Tarefas leves (títulos, perguntas do briefing, classificação) | `google/gemini-3-flash-preview` | `google/gemini-3.1-flash-lite` |
| Fallback quando o principal falha (503/stall) | `google/gemini-3-flash-preview` | `openai/gpt-5.4-mini` (outro fornecedor) |

Racional:
- `gemini-3.6-flash` é a geração mais recente do Flash, com qualidade de redação e raciocínio muito próxima do Pro para documentos normativos, custo bastante inferior e latência menor — o que por si só reduz a chance de estouro do orçamento de 115s da função.
- O fallback passa a ser de **outro fornecedor**: hoje, se o Google estiver degradado, o principal e o fallback caem juntos. Com OpenAI no fallback, a falha do Google deixa de derrubar a geração inteira.
- Tarefas leves migram para o Lite, que é a opção mais barata e é suficiente para títulos e perguntas.

## Alternativa se quiser máxima qualidade

Manter um "modo qualidade" opcional em `openai/gpt-5.4` apenas para o primeiro rascunho de políticas longas, mantendo o Flash para refinos. Custa mais por documento; só faz sentido se o texto do Flash ficar abaixo do esperado nos testes.

## Como validar antes de fixar a escolha

1. Gerar 3 documentos reais (Política de Segurança da Informação, Política de Privacidade, Procedimento de Gestão de Incidentes) com o par proposto.
2. Comparar contra a saída atual do Pro em: estrutura, presença dos elementos de controlo documental, linguagem normativa e ausência de factos inventados.
3. Registar duração e custo em créditos de cada geração via os registos do AI Gateway.
4. Só depois consolidar o par escolhido.

## Detalhe técnico

- Alterar as constantes `MODEL_FAST` / `MODEL_QUALITY` (linhas 81-82) em `supabase/functions/docgen-chat/index.ts` e introduzir uma terceira constante `MODEL_FALLBACK` usada em `callQualityWithFallback` (linhas 484-520), hoje a apontar para `MODEL_FAST`.
- Rever os parâmetros do corpo do pedido para o modelo OpenAI do fallback: a família GPT-5 rejeita `max_tokens` e `temperature` não-padrão; usar `max_completion_tokens`.
- Reequilibrar o orçamento de tempo: com um principal mais rápido, subir o corte da primeira tentativa de 55s para ~70s, mantendo folga para o fallback dentro dos 115s.
- Nenhuma alteração de base de dados, RLS ou interface. O consumo de crédito e a chave de idempotência mantêm-se inalterados.
- Restantes funções de IA (gap analysis, avaliação de evidências, assistentes) ficam fora deste âmbito nesta fase.
