# Requisito em página cheia, idêntico ao modelo "Ler e decidir"

## O que muda para o usuário
1. **Página cheia:** clicar num requisito, na tabela do framework ou na busca, abre uma página própria, sem janela flutuante.
   - O endereço fica no formato `/gap-analysis/framework/<framework>/requisito/<requisito>`, então dá para compartilhar o link e usar o botão voltar do navegador.
   - O "X" e a tecla Esc voltam para a lista, que se mantém na mesma posição.
   - As setas ‹ 1/121 › continuam passando de um requisito para outro.
2. **Visual fiel ao modelo:**
   - **Cabeçalho compacto:** selo, nome do framework, chip do código e título em uma linha. Abaixo, a descrição numa linha só, em texto pequeno.
   - **Tipografia menor e mais densa**, como na imagem: títulos de bloco em 15px, sem caixa alta ("Como cumprir", não "COMO CUMPRIR"), e texto em 13–14px.
   - **Como cumprir:** mostra no máximo 5 a 6 ações práticas e curtas. Perguntas de reflexão e textos longos ficam em "Ver orientação completa", que expande ali mesmo. A nota "Orientação incluída…" vira uma linha pequena no rodapé do bloco.
   - **Decisão:** controle segmentado baixo, numa linha só, com rótulos que não quebram. A opção escolhida fica sempre roxa, como no modelo. A cor de gravidade continua só no texto de status da tabela.
   - **Cartão de sugestão:** ícone de brilho, título "Sugerido: Parcial — 2 de 3 evidências encontradas", explicação em roxo e o botão "Aplicar" à direita.
     - Sem evidências ligadas, mostra uma linha curta: "Ligue documentos de evidência para receber uma sugestão".
     - O pré-diagnóstico por IA vira um link discreto abaixo do cartão.
   - **Evidências esperadas:** lista com check verde ou círculo vazio, ícone de documento, título, descrição, arquivo ligado e o controle ligado, quando existir. Tem os chips "Encontrada" e "Faltando" e o contador "X de Y encontradas".
   - **Prazo e Responsável:** campos grandes como no modelo. O responsável aparece com avatar e nome.
   - **Botão Salvar:** largo, fixo no rodapé da coluna direita. "Salvar e fechar" e os atalhos ficam numa linha discreta abaixo.
   - As duas colunas rolam de forma independente, sem a barra de rolagem grossa no meio.
3. **Celular:** colunas empilhadas e o botão Salvar fixo no rodapé.

## Mantido
O salvamento, o rascunho por empresa e por usuário, a sugestão local sem créditos, a justificativa obrigatória, as teclas 1 a 4, o link "Vínculos e plano de ação" e os textos em PT/EN.

## Detalhes técnicos
- Extrair o corpo do `RequirementDrawer` para um novo `RequirementWorkspace` (sem Dialog), com as props `requirementId`, `empresaId`, `sequence`, `onNavigate` e `onClose`.
- Nova página `src/pages/GapAnalysisRequirementPage.tsx` e nova rota lazy em `App.tsx`.
  - A sequência anterior/próximo vem do estado de navegação. Quando não houver, a página busca os requisitos do framework ordenados por código, filtrados por empresa.
- `RequirementDrawerProvider.openRequirement` passa a navegar para a rota, em vez de abrir o Dialog. Assim, a tabela e a busca (Cmd+K) usam a página sem mudar quem as chama.
- `parseItens` separa as ações (frases imperativas) das perguntas (terminadas em "?"). Só as ações aparecem na lista curta.
- Atualizar os testes de arquitetura que citam `RequirementDrawer.tsx` e registrar a regra em AGENTS.md: a revisão de requisito é uma página com rota própria.
