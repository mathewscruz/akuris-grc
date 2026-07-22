## Achados reais no fluxo DocGen

Percorri o fluxo ponta-a-ponta (`DocGenDialog.tsx`, `docgen-chat/index.ts` e integrações com `docgen_conversations` / `docgen_generated_docs`). Encontrei **6 inconsistências reais** que merecem correção agora, além de código morto. Nenhuma quebra o fluxo feliz — mas causam perda silenciosa de trabalho do usuário e um cenário de cobrança indevida.

---

### 1. `refine_section` e `refine_document` não persistem o documento no banco
`generate_document` grava em `docgen_generated_docs`, mas os dois fluxos de refino (por seção — botão "Refinar" — e global — chat pós-geração) devolvem o documento atualizado apenas em memória. Se o usuário fechar o diálogo ou usar "Restaurar conversa" antes de exportar/salvar em Documentos, **todo refino é perdido**.

**Fix:** ao final de `refine_section` e `refine_document`, dar `UPDATE` em `docgen_generated_docs` (row mais recente da conversa) com o novo `conteudo`.

---

### 2. `loadConversation` sempre zera o documento gerado
`src/components/documentos/DocGenDialog.tsx:988` faz `setGeneratedDocument(null)` ao restaurar. Combinado com o item 1, uma conversa restaurada nunca reexibe o documento — mesmo que ele exista no banco.

**Fix:** após restaurar a conversa, buscar o registro mais recente em `docgen_generated_docs` por `conversation_id` (com filtro de `empresa_id`) e hidratar `generatedDocument`.

---

### 3. Cobrança de crédito acontece antes de validar payload das actions de refino
Em `docgen-chat/index.ts:319-334` o `consume_ai_credit` roda antes do bloco que valida `document`/`instruction` (`refine_section`, `refine_document`, `quick_adherence`). Chamadas malformadas cobram 1 crédito e depois retornam `400`.

**Fix:** mover a validação de payload das actions que exigem `document`/`instruction`/`section_index`/`framework_context.framework_id` para **antes** do `consume_ai_credit`. Manter cobrança só se o payload estiver válido.

---

### 4. `extractFrameworks` zera frameworks já detectados
`extractFrameworks` retorna sempre `string[]` (nunca `null`). O merge `extractFrameworks(messageText) || (context as any).frameworks_relacionados` (linhas 526–527 e 544–546) resolve para o array vazio recém-criado e **descarta** os frameworks detectados em turnos anteriores.

**Fix:** trocar por `const detected = extractFrameworks(messageText); frameworks_relacionados: detected.length ? detected : (context as any).frameworks_relacionados`. Aplicar em ambos os pontos.

---

### 5. `documento_pronto` não é persistido no `contexto` da conversa
O flag `documento_pronto` é devolvido no response e usado para exibir o botão "Gerar Documento", mas nunca é gravado em `docgen_conversations.contexto`. Ao restaurar a conversa, o botão desaparece até o usuário mandar mais uma mensagem.

**Fix:** incluir `documento_pronto: isDocumentReady` no `updatedContext` salvo em `docgen_conversations`, e no `loadConversation` do frontend rehidratar `setDocumentReady((contexto as any)?.documento_pronto === true)`.

---

### 6. `refine_document` não recebe o contexto da empresa
O refino global usa apenas título, framework name e transcrição — sem `company_context`. Assim, refinos podem perder aderência aos dados reais da empresa que a geração inicial já tinha.

**Fix:** no frontend, incluir `company_context: companyContext` no body do `refine_document`; no backend, se `company_context_input` (ou `context.company_context`) existir, injetar um bloco "CONTEXTO REAL DA EMPRESA" no `userPrompt` do `refine_document` (mesmo padrão já usado em `chat`/`generate_document`).

---

### 7. Código morto — `saveDocument`
`src/components/documentos/DocGenDialog.tsx:542-581` define `saveDocument` que **não é referenciado por nada**. O botão "Salvar em Documentos" chama `handleOpenCreateDialog` e abre o `DocumentoDialog`. `saveDocument` também referencia `setIsDocumentSaved` e `setHasUnsavedChanges` que existem, mas o resultado nunca é executado.

**Fix:** remover a função `saveDocument` para evitar confusão futura. Nenhuma UI depende dela.

---

## Fora do escopo (não vou tocar agora)

- **Ordem dos hooks fragmentada** (`useState` na linha 863 depois de várias funções): funciona porque React só exige mesma ordem por render — não é bug.
- **`docgen_learning_patterns.numero_usos: 1`** sempre reescrito: comportamento antigo, não afeta o fluxo do usuário. Se você quiser, faço em separado.
- **`renderLineWithTooltips` sobre HTML já processado** pode envolver termos dentro de `<strong>`: cosmético, não corrompe renderização (DOMPurify limpa).

---

## Arquivos afetados

- `supabase/functions/docgen-chat/index.ts` — itens 1, 3, 4, 5, 6 (backend)
- `src/components/documentos/DocGenDialog.tsx` — itens 2, 5, 6, 7 (frontend)
- Redeploy da edge function `docgen-chat` ao final.

Sem migrações de banco — as tabelas envolvidas (`docgen_generated_docs`, `docgen_conversations`) já têm as colunas necessárias.

## Validação

Após implementar:
1. Abrir DocGen, gerar um documento com briefing "gerar direto", refinar uma seção → fechar → reabrir "Restaurar conversa" → o documento refinado deve reaparecer.
2. Enviar mensagem de refino pós-geração citando dados concretos → conferir se a resposta injeta esses dados e se, ao reabrir, persistem.
3. Chamar `refine_document` sem `instruction` (via curl) → deve retornar `400` sem consumir crédito (checar log).