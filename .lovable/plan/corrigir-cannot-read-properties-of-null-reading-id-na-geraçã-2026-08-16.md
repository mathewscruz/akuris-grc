# Corrigir "Cannot read properties of null (reading 'id')" na geração direta do DocGen

## Diagnóstico (confirmado nos logs e no esquema)

O log da Edge Function `docgen-chat` mostra que o documento **foi gerado com sucesso** (score calculado, compliance registada) e o erro ocorre logo a seguir, ao gravar o registo auxiliar:

```text
DocGen generate_document compliance (final) { initial_score: 14, ... }
ERROR TypeError: Cannot read properties of null (reading 'id')  -> index.ts (insert docgen_generated_docs)
```

Causa: a inserção em `docgen_generated_docs` grava `tipo_documento: context.tipo_documento_identificado`, mas essa coluna é **NOT NULL** (confirmado no esquema). No modo "gerar documento direto" não existe etapa de chat, logo o tipo nunca é identificado e fica `null`. A inserção falha, o erro é ignorado (`const { data } = ...`, sem `error`), `generatedDoc` fica `null` e a linha seguinte lê `generatedDoc.id` — rebentando depois de o documento já estar pronto. O utilizador perde o documento e vê apenas o erro.

## Correção

1. Calcular `tipo_documento` com cascata de fallbacks: tipo identificado no chat -> `template.tipo_documento` -> `doc_type_hint` -> `'politica'`. Mesmo tratamento para `nome`.
2. Capturar o `error` da inserção, registar em log e **não interromper a resposta** — a persistência do rascunho é acessória; o documento gerado tem de chegar ao utilizador.
3. Devolver `document_id: generatedDoc?.id ?? null` em vez de aceder diretamente a `.id`.
4. Redeployar a função `docgen-chat` e validar uma geração direta ponta a ponta.

## Detalhes técnicos

- Ficheiro: `supabase/functions/docgen-chat/index.ts`, bloco `action === 'generate_document'` (inserção em `docgen_generated_docs` e resposta imediatamente a seguir).
- Sem alterações de esquema, RLS ou frontend: o `DocGenDialog` já lida com `document_id` ausente e já mostra o estado de erro/retry.
- Nota separada (não incluída nesta correção): o score de conformidade dessa geração ficou em 14%, abaixo do gate. É um tema de qualidade de geração, distinto deste crash.
