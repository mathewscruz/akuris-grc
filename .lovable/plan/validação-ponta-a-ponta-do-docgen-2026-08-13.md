# Validação ponta a ponta do DocGen

Objetivo: provar que o DocGen funciona do briefing até o documento salvo em Documentos, e corrigir o que a validação encontrar. Hoje não existe nenhum teste automatizado sobre o novo pipeline de renderização/exportação (`src/lib/docgen-render.ts`, `docgen-docx.ts`, `docgen-pdf.ts`) — só existem os testes de compliance da edge function.

## O que será validado

O fluxo tem 7 etapas e cada uma será verificada:

```text
1. Briefing (chat)        -> action 'chat'
2. Geração                -> action 'generate_document'
3. Auto-refino            -> action 'auto_refine' (encadeado pelo frontend)
4. Refino manual          -> actions 'refine_section' / 'refine_document'
5. Análise de aderência   -> action 'quick_adherence' + analyze-document-adherence
6. Exportação             -> DOCX e PDF
7. Publicação             -> salvar em Documentos (isolado por empresa_id)
```

## Como cada etapa será verificada

### A. Testes automatizados do renderizador e dos exportadores (novo)

Arquivo novo `src/lib/__tests__/docgen-render.test.ts`:
- Parser de markdown: títulos `##`/`###`, listas com marcador e numeradas (inclusive sub-itens), tabelas GFM, negrito/itálico/código inline, parágrafos e citações.
- Casos hostis que a IA costuma produzir: tabela sem linha separadora, linha de tabela com número de colunas diferente do cabeçalho, lista sem espaço após o hífen, texto com `**` desbalanceado — nenhum pode lançar exceção nem perder conteúdo.

Arquivo novo `src/lib/__tests__/docgen-export.test.ts`:
- Gera um documento de exemplo completo (capa, seções com tabela RACI, glossário, histórico de versões, matriz de cobertura) e confirma que `buildDocGenDocxBlob` e `buildDocGenPdfBlob` devolvem Blob não vazio, com o tipo MIME correto, sem lançar.
- Casos de borda: documento sem glossário/histórico, seção com conteúdo vazio, ausência de logo da empresa.

### B. Testes do parser tolerante de JSON (novo)

Arquivo novo `supabase/functions/docgen-chat/json-parse_test.ts`:
- `parseDocumentJson` com: JSON limpo; JSON dentro de cercas ```json; JSON com texto antes/depois; JSON truncado no meio de uma string; JSON truncado no meio de um array de seções.
- `isValidDocument` aceitando documento com 3+ seções substantivas e rejeitando documento com seções vazias ou sem `secoes`.

Para isso, as duas funções passam a ser exportadas do `index.ts` (mudança de uma palavra por função, sem efeito no runtime).

### C. Execução real contra o Supabase vinculado

Com a edge function já publicada, chamar cada action com um payload real e ler a resposta:
- `chat` — retorna pergunta de briefing e mantém `conversation_id`.
- `generate_document` — retorna documento válido, `_initial_score`, `_residual_gaps`, `should_auto_refine`.
- `auto_refine` — uma tentativa devolve `score_before`/`score_after`/`should_continue`.
- `refine_section` e `refine_document` — alteram de fato o conteúdo devolvido.
- `quick_adherence` — score coerente com o do gerador (a paridade já tem testes; aqui é a checagem viva).
Os logs da função serão lidos após cada chamada para confirmar ausência de erro e medir a duração de cada etapa contra o teto de ~150s.

### D. Verificação visual no navegador

Percorrer o diálogo no preview com Playwright: abrir DocGen, responder o briefing, gerar, conferir que o preview renderiza títulos/listas/tabelas (e não markdown cru), acionar refino de seção, e capturar screenshots. Baixar o DOCX e o PDF gerados e converter as páginas em imagens para inspecionar layout, tabelas, quebras de página e rodapé.

### E. Isolamento multi-tenant e créditos

- Confirmar que a gravação em `documentos` usa o `empresa_id` do perfil autenticado e que a leitura pós-publicação respeita RLS.
- Confirmar que o consumo de crédito acontece só após resposta OK do gateway e que 402/403 abrem o diálogo de créditos em vez de erro genérico.

## Entregáveis

- Relatório em `docs/audits/docgen-e2e-validation.md` com etapa, resultado, evidência (log/screenshot) e tempo de execução.
- Testes novos rodando no `vitest` (frontend) e no `deno test` (edge function).
- Correções dos defeitos encontrados, cada uma com o teste que a comprova.

## Observações

- Há uma falha de teste pré-existente em `documentos-aprovacoes-relacionamentos.test.ts` (sobre migrations, não sobre DocGen). Ela será tratada à parte ou deixada como está, conforme sua preferência.
- Se os créditos de IA do workspace estiverem esgotados no momento da validação, as etapas C e D que dependem do modelo não rodam; nesse caso o relatório registra isso explicitamente em vez de dar por aprovado.
