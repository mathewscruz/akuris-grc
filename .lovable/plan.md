# DocGen: robustez da geração e qualidade do documento

## Diagnóstico (confirmado no código)

**1. A formatação se perde na exportação — é a maior causa da "qualidade baixa".**
A IA escreve markdown dentro de `secoes[].conteudo` (negrito, listas, tabelas RACI, subtítulos), mas os exportadores tratam o conteúdo como texto cru:

- DOCX (`DocGenDialog.tsx`, geração do blob): `conteudo.split('\n')` e cada linha vira um `Paragraph` com um único `TextRun`. Resultado: `**Responsável**` sai literalmente com asteriscos, `- item` vira texto, e a tabela RACI vira um amontoado de `|` e traços.
- PDF (jsPDF): mesmo problema, só `splitTextToSize` + `pdf.text`. Sem negrito inline, sem tabela, sem hierarquia de subtítulos.
- Só existe H1 por seção. Não há H2/H3, não há listas numeradas nativas, não há tabelas reais.
- Capa montada com parágrafos vazios em loop (posição varia conforme o título), sumário sem números de página, sem TOC nativo do Word.
- `glossario`, `historico_versoes` e `coverage_map` são produzidos pela IA mas **nunca aparecem** no arquivo exportado.

**2. Fragilidade da geração.**
O documento inteiro vem em uma única resposta JSON de até 20.000 tokens. Se o modelo truncar ou escapar mal uma aspa, o `JSON.parse` falha e o fallback despeja o texto bruto numa seção chamada "Conteúdo" — é o "documento com falha" que o usuário vê. Não há repair de JSON, nem retry, nem validação de estrutura mínima.

## O que será feito

### 1. Renderizador de markdown único (base de tudo)
Criar `src/lib/docgen-render.ts`: um parser leve do subset markdown que a IA usa (títulos `##`/`###`, listas com marcador e numeradas, tabelas GFM `| a | b |`, negrito/itálico inline, citações) que produz um AST simples. Esse AST alimenta os três destinos — preview, DOCX e PDF — para que os três fiquem idênticos.

### 2. DOCX de padrão consultoria
- Estilos declarados (Título, Heading 1/2/3, corpo, tabela) com fonte e espaçamento consistentes, página US Letter/A4 explícita.
- Numeração hierárquica automática das seções e subseções (1., 1.1, 1.1.1).
- Listas com numeração nativa do Word (não bullets unicode).
- Tabelas reais (RACI, histórico de versões, glossário, matriz de cobertura) com larguras fixas, cabeçalho sombreado e bordas.
- Capa posicionada por espaçamento (não por parágrafos vazios), sumário com `TableOfContents` clicável.
- Apêndices automáticos: Glossário, Histórico de Versões e Matriz de Cobertura de Requisitos (do `coverage_map`).
- Cabeçalho com título + classificação; rodapé mantém paginação atual.

### 3. PDF equivalente
- Mesmo AST, com `jspdf-autotable` para tabelas, negrito inline, hierarquia de títulos, quebras de página que não cortam títulos, sumário com números de página e os mesmos apêndices.

### 4. Preview fiel na tela
O painel do documento passa a usar o mesmo renderizador, para o que o usuário vê ser o que sai no arquivo (hoje o preview usa regex ad-hoc diferente da exportação).

### 5. Robustez da geração
- Parser tolerante no `docgen-chat`: extrair o maior bloco JSON válido, reparar truncamento comum (fechar strings/arrays) e, se ainda falhar, **uma** re-tentativa pedindo apenas o JSON — em vez de cair no fallback de texto cru.
- Validação de esquema mínimo (título, ≥3 seções não vazias); se reprovar, o usuário recebe erro claro com botão "Gerar novamente" em vez de um documento quebrado.
- Geração em dois lotes de seções quando o template tem muitas seções, evitando truncar em 20k tokens e reduzindo o tempo por chamada.
- Barra de progresso por etapa (briefing → redação → verificação de conformidade → refino), em vez do estado único de "gerando".

### 6. Ajuste fino do prompt
Declarar explicitamente o subset markdown permitido (e proibir HTML), exigir tabela RACI em formato de tabela markdown, subseções com `###`, e proibir asteriscos decorativos fora de negrito — assim o renderizador sempre recebe algo previsível.

## Detalhes técnicos

- Novo: `src/lib/docgen-render.ts` (parser markdown → AST), `src/lib/docgen-docx.ts` e `src/lib/docgen-pdf.ts` (AST → docx / jsPDF), extraídos de `DocGenDialog.tsx` (que hoje concentra ~300 linhas de exportação).
- Nova dependência: `jspdf-autotable` (tabelas no PDF). `docx` e `jspdf` já estão no projeto.
- `supabase/functions/docgen-chat/index.ts`: helper `parseDocumentJson` com repair + retry na action `generate_document`; ajuste do bloco de prompt editorial; nada muda em `_shared/compliance-score.ts`, então a paridade com `analyze-document-adherence` e os testes de compliance existentes seguem válidos.
- Testes: casos de renderização (tabela GFM, lista aninhada, negrito) e casos de parse tolerante (JSON truncado, JSON com cerca de markdown).
- Sem mudança de schema no banco e sem alteração no fluxo de créditos.
