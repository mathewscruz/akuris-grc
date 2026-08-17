# Por que o DocGen parece nunca funcionar

O módulo não está "criado errado" — mas tem duas falhas concretas que, juntas, fazem quase toda geração terminar em erro ou em documento marcado como fora de conformidade.

## O que os dados mostram

Log real da última geração (16/08, "Política de Controlo de Acesso", ISO 27001):

```text
framework_ids: 2 frameworks
catalog_size: 184 requisitos
coverage_items: 14
initial_score: 8   → gate de publicação exige 80
depois: TypeError: Cannot read properties of null (reading 'id')
```

### Causa 1 — o score compara uma política inteira com o catálogo inteiro do framework
O denominador do score é o universo completo de requisitos dos frameworks selecionados (184 requisitos, porque foram enviados dois frameworks). Uma política de controlo de acesso cobre, por definição, 10 a 20 requisitos. Resultado matemático inevitável: 8%. A partir daí o sistema mostra avisos de não conformidade, sugere refino automático que nunca consegue convergir, e o diálogo de "publicar mesmo com baixa conformidade" aparece sempre. O utilizador lê isso como "o DocGen não funciona".

### Causa 2 — a conversa pode ficar nula e a função rebenta no fim
A criação da conversa (`docgen_conversations`) ignora o erro de inserção. Se falhar, o código continua, gasta os minutos de geração da IA, debita crédito e só rebenta no fim ao gravar o resultado (`conversation.id` sobre um valor nulo). O utilizador vê "A geração não foi concluída" depois de esperar — e o crédito já foi consumido.

### Causa 3 — o pipeline é comprido demais para um pedido só
Geração (20k tokens) + quality gate de reescrita + refino automático encadeados aproximam-se do limite de tempo da plataforma, o que explica gerações que "ficam a pensar" e falham sem mensagem clara.

## O que vou corrigir

1. **Score com âmbito honesto**
   - O denominador passa a ser o subconjunto de requisitos aplicáveis ao tipo de documento (âmbito declarado), não o catálogo completo.
   - A cobertura total do framework continua visível, mas como métrica informativa separada ("este documento cobre 14 de 184 requisitos do ISO 27001"), sem bloquear a publicação.
   - O gate de 80% passa a incidir sobre o âmbito do documento, que é o que o próprio Akuris consegue atestar de forma independente.
   - Quando o utilizador tiver vários frameworks ativos, a geração usa apenas o framework escolhido para o documento, não todos.

2. **Falha rápida e sem cobrar crédito**
   - Capturar o erro de inserção da conversa e devolver mensagem clara antes de chamar a IA.
   - Guardar todos os acessos a `conversation`/`template` com verificação prévia.
   - Confirmar que o crédito só é debitado depois de existir documento e registo gravado.

3. **Mensagens de erro úteis no diálogo**
   - Distinguir, na interface, três casos: sem crédito, falha da IA, e falha de gravação — cada um com ação própria (tentar novamente, recuperar rascunho, contactar suporte).

## Detalhes técnicos

- `supabase/functions/docgen-chat/index.ts`: âmbito do denominador em `expandNaoCobertosFromCatalog` / `computeCoverageScore`; verificação de erro no insert de `docgen_conversations`; uso de um único `framework_id` quando o pedido traz vários; `chargeAiCredit()` só após persistência bem-sucedida.
- `src/components/documentos/DocGenDialog.tsx`: separar "score do âmbito" (gate) de "cobertura do framework" (informativo); estados de erro distintos.
- `src/i18n/modules/docgen.ts`: novas chaves em pt-PT, pt-BR e en.
- Sem alterações de base de dados.
