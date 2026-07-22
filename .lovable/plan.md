## Problema confirmado

Após a IA fazer perguntas de refinamento, as respostas do usuário não alteram o documento. Duas causas concretas no fluxo atual:

1. **Geração inicial ignora o histórico do chat.** Em `supabase/functions/docgen-chat/index.ts` (action `generate_document`, linhas ~660‑694) o prompt monta o documento a partir de `context.informacoes_coletadas`. Esse objeto nunca é populado: no action `chat` (linha ~548) ele apenas faz `{ ...context.informacoes_coletadas, ...(parsedResponse.informacoes_coletadas || {}) }`, e a IA nunca devolve `informacoes_coletadas` (a resposta é texto puro). O array `messages` (com as respostas do usuário) fica salvo em `docgen_conversations.mensagens`, mas **não é enviado** para o prompt de geração. Resultado: o documento sai genérico, sem refletir o que o usuário respondeu.

2. **Depois de gerado, mensagens no chat não modificam o documento.** O `DocGenDialog` só altera o `generatedDocument` via `refine_section` (dialog `DocGenSectionRefiner`) ou `quick_adherence`. Se o usuário responder no chat "no nosso caso a retenção é 5 anos", a mensagem vai como `action: 'chat'` e volta uma resposta textual — o documento permanece intocado.

## Correções

### 1. Enviar o diálogo real para a geração (backend)

Em `supabase/functions/docgen-chat/index.ts`, action `generate_document`:

- Recuperar `messages` da `conversation` (já disponível como `conversation.mensagens`).
- Filtrar mensagens `user`/`assistant` e formatar como transcrição no prompt do documento, ex.:
  ```
  === RESPOSTAS DO USUÁRIO NO BRIEFING ===
  [user] ...
  [assistant] ...
  ```
- Instruir explicitamente: "Incorpore literalmente prazos, nomes de sistemas, papéis, retenções, valores e exceções mencionados pelo usuário abaixo. Se houver conflito entre o template e a resposta do usuário, prevaleça a resposta do usuário."
- Passar essa transcrição (últimas ~30 mensagens) tanto no `systemPrompt` quanto na `user message` para a chamada `callClaude`.

### 2. Extrair `informacoes_coletadas` estruturado no chat (backend)

Ainda em action `chat`, após a resposta do modelo, fazer uma segunda chamada leve à IA (ou reaproveitar a mesma resposta pedindo JSON adicional oculto) que retorne `informacoes_coletadas` com chaves livres (`escopo`, `responsavel`, `retencao`, `sistemas`, etc.). Persistir no `updatedContext.informacoes_coletadas` para uso posterior na geração.

Se preferir manter simples (1 chamada), pular esta etapa — a transcrição do item 1 já resolve o caso do usuário. Mantida no plano como melhoria opcional.

### 3. Nova action `refine_document` (backend)

Adicionar em `docgen-chat/index.ts` um branch `action === 'refine_document'` que:

- Recebe `document` (atual) + `instruction` (mensagem do usuário) + `conversation_id`.
- Prompt: "Reescreva APENAS as seções afetadas pela instrução do usuário, preservando o restante literalmente. Devolva o documento JSON completo no mesmo schema."
- Consome 1 crédito (`consume_ai_credit`), mesmo padrão de `refine_section`.
- Retorna `{ document }`.

### 4. Ligar o chat pós-geração ao `refine_document` (frontend)

Em `src/components/documentos/DocGenDialog.tsx`:

- Enquanto `!generatedDocument`, `sendMessage` continua usando `action: 'chat'` (comportamento atual).
- Quando `generatedDocument` já existe, `sendMessage` passa a chamar `action: 'refine_document'` com o documento atual e a instrução do usuário; ao voltar, `setGeneratedDocument(data.document)` e adiciona uma mensagem do assistente ("Atualizei as seções X e Y com base na sua observação").
- Manter o botão de refino por seção como opção avançada.
- Invalidar `adherenceResult` após refino global (igual ao `refine_section`).

### 5. Feedback visual

- Toast `akurisToast({ module: 'documentos', tone: 'success', title: 'Documento atualizado' })` após `refine_document`.
- Loader `AkurisPulse` no botão de envio enquanto o refino roda.

## Fora de escopo

- Não muda schema do banco.
- Não altera `docgen_templates`, `DocGenBriefing` ou `DocGenTemplateGallery`.
- Sem mudanças em créditos além do consumo padrão já existente para `refine_section`.

## Arquivos afetados

- `supabase/functions/docgen-chat/index.ts` — items 1, 2 (opcional) e 3.
- `src/components/documentos/DocGenDialog.tsx` — item 4 e 5.
