# Leitor do documento analisado dentro do Akuris

## O que muda para o usuário
- "Abrir documento" deixa de abrir uma aba com texto cru e passa a abrir um **leitor dentro do sistema**, num painel lateral largo, com a identidade Akuris.
- **Cabeçalho do leitor:** ícone de documento, nome da política, framework analisado, data da análise, nº de palavras e páginas estimadas; botões "Baixar texto" e fechar.
- **Sumário à esquerda:** lista das seções detectadas (Objetivo, Aplicabilidade, Documentos auxiliares, Definições…), clicável, destacando a seção em leitura.
- **Corpo formatado à direita:**
  - títulos de seção (linhas em maiúsculas ou numeradas como "1.", "1.1") viram títulos com o estilo do sistema;
  - listas (linhas começando por "-", "•", "a)", "Lei nº…", "PO 0021…") viram listas com marcadores;
  - termos de definição ("Acervo Acadêmico Digital: …") ficam com o termo em negrito;
  - parágrafos com espaçamento confortável, largura de leitura limitada, fonte DM Sans.
- **Busca no documento:** campo que destaca as ocorrências e salta entre elas.
- Funciona para todos os documentos já analisados, sem reenviar nada; acentos corretos.
- Textos novos em PT e EN.

## Detalhes técnicos
- Novo `src/components/gap-analysis/adherence/DocumentoAnalisadoViewer.tsx` usando `DialogShell variant="side"` (padrão de painel de leitura do sistema).
- Novo módulo puro `src/components/gap-analysis/adherence/estrutura-documento.ts` que transforma o texto em blocos (`titulo` com nível, `paragrafo`, `lista`, `definicao`) e gera o sumário; com teste em `__tests__/estrutura-documento.test.ts` (títulos em maiúsculas, numeração, listas, definições).
- Download do texto via `storage.download` (mesma pasta `empresa_id`, políticas inalteradas) com TanStack Query, chave com empresa_id + caminho; loader `AkurisPulse`.
- `abrirDocumentoAnalisado` substituído por estado `documentoAberto` em `AdherenceResultView` e `AdherenceAssessmentView`; "Baixar texto" mantém o download UTF-8 já corrigido.
- Texto renderizado como React (sem HTML injetado), destaque de busca com `<mark>` em tokens semânticos.
- Validar no preview abrindo o documento da política deste caso.
