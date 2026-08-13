# DocGen — Validação ponta a ponta

Data: 2026-08-13
Escopo: briefing → geração → auto-refino → refino manual → análise de aderência →
exportação (DOCX/PDF) → publicação em Documentos.

## Resumo

O pipeline está operacional. A validação encontrou **1 defeito real** (corrigido)
e mapeou **2 limitações** do ambiente de auditoria.

## O que foi validado

| Etapa | Como foi validado | Resultado |
| --- | --- | --- |
| Contrato de compliance (score, refino, denominador) | 11 testes Deno (`docgen-chat/compliance_test.ts`) | OK |
| Parsing tolerante do JSON do modelo | 8 testes Deno (`docgen-chat/json-parse_test.ts`) | 1 falha → corrigida |
| Renderização Markdown (AST compartilhado) | 14 testes Vitest (`src/lib/__tests__/docgen-render.test.ts`) | OK |
| Exportação DOCX/PDF | 5 testes Vitest (`src/lib/__tests__/docgen-export.test.ts`) | OK |
| Listagem/publicação em Documentos | 11 testes Vitest (`src/components/documentos/__tests__`) | OK |
| Execução real do modelo | Logs do AI Gateway (18 chamadas em 7 dias) | OK, ver abaixo |

## Defeito encontrado e corrigido

**Truncamento no meio de uma chave JSON derrubava o documento inteiro.**
Quando o modelo estourava o limite de tokens exatamente dentro de um nome de
campo (ex.: `{"nome":"B","conte`), o reparo antigo fechava aspas e brackets e
produzia um par chave/valor inválido; o fallback "último objeto completo" só
funcionava se a pilha de brackets tivesse zerado — o que nunca acontece com o
objeto raiz aberto. Resultado prático: o usuário recebia um bloco de texto cru,
sem capa nem seções.

Correção: os helpers saíram do `index.ts` para
`supabase/functions/_shared/docgen-json.ts` (testáveis sem subir o servidor) e o
reparo agora recua progressivamente até o último elemento completo do array
antes de desistir. Coberto pelo teste
"parseDocumentJson — truncado no meio do array de seções".

## Evidência de execução real (AI Gateway, 13/08)

- Geração com `google/gemini-3.1-pro-preview`: 45s–80s por chamada, 200 OK.
- Refinos com `google/gemini-3-flash-preview`: 2s–6s, 200 OK.
- 2 chamadas `499 cancelled` (~65s e ~78s): abortos do cliente (diálogo fechado
  ou navegação), **não** o timeout de 120s do frontend. Os tokens consumidos
  antes do aborto são cobrados — é o comportamento esperado.
- 1 chamada `403`: créditos de IA esgotados, tratada pelo `CreditsExhaustedDialog`.

Como cada chamada isolada fica bem abaixo dos ~150s da plataforma, a decisão de
quebrar geração e auto-refino em requisições encadeadas continua correta.

## Limitações desta auditoria

1. **Sem sessão autenticada de teste**: o projeto usa Supabase externo
   (`external_unmanaged`) e `docgen-chat` exige `verify_jwt = true`, então não é
   possível disparar o fluxo vivo a partir do ambiente de auditoria. A validação
   viva se apoia nos logs do gateway e nos testes das funções puras.
2. **Nenhum documento publicado nos últimos 3 dias** (`documentos` vazio no
   período) apesar das gerações de hoje — as sessões recentes foram de geração e
   teste, sem publicação. Não há indício de falha na gravação; se o usuário
   relatar perda ao salvar, este é o primeiro ponto a reinvestigar.

## Como reexecutar

- Deno: `supabase--test_edge_functions` com `functions: ["docgen-chat"]` (19 testes).
- Frontend: `bunx vitest run src/lib/__tests__/docgen-render.test.ts src/lib/__tests__/docgen-export.test.ts src/components/documentos/__tests__` (30 testes).
