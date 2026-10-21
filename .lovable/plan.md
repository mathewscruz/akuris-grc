# Lista de tarefas (Modelo A) e janela da tarefa (Modelo A — ClickUp) idênticas aos mockups

Objetivo: corrigir as diferenças visíveis nas capturas atuais e reproduzir fielmente os dois modelos escolhidos.

## 1. Lista — "Faixas por nível"

Diferenças atuais a corrigir:
- Cada linha aparece como um cartão separado com barra lateral vermelha/verde por atraso. O modelo usa uma tabela contínua, com a cor ditada pelo nível, não pelo atraso.
- A fase não tem faixa roxa; o domínio não tem faixa verde-azulada.
- "Coluna" e "Status" repetem a mesma informação com círculos vazios.

Como fica:
- **Fase**: linha inteira com fundo roxo suave, barra roxa de 3px à esquerda, seta de recolher, chip roxo cheio com o código (F0), título em negrito, contador "(8)" em cinza, barra de progresso roxa com %.
- **Domínio**: fundo verde-azulado suave, barra verde-azulada, recuo de 1 nível, chip verde-azulado, título semi-negrito.
- **Atividade**: fundo do cartão, recuo de 2 níveis com traço de ligação "└", chip roxo claro com o código, título normal.
- **Marco**: losango ◆ dourado antes do título.
- Linhas contínuas separadas só por um fio fino (sem espaçamento entre linhas, sem cantos arredondados por linha).
- **Status**: um único chip preenchido e colorido (Não iniciado cinza, Em andamento azul, Concluído verde, Atrasado vermelho). A coluna "Coluna" deixa de duplicar o status quando o quadro usa as mesmas etapas.
- Datas vencidas continuam em vermelho, só no texto da data.
- Barra de % com cor do nível (roxo) e verde quando 100%.

## 2. Janela da tarefa — "ClickUp"

Diferenças atuais a corrigir:
- Cabeçalho genérico "Editar tarefa"; título dentro de uma caixa de input com borda roxa.
- Caminho mostra só "Projeto ISO 27001".
- Status quebrado (círculo em cima do texto); propriedades em caixas de formulário.
- Abas sem contadores; Atividade/Comentários não aparecem; anel de progresso pequeno.

Como fica:
- **Barra superior**: caminho clicável "Projeto ISO 27001 › FASE 0 › Domínio" com chip do código, à direita botão de status colorido (chip cheio com seta), copiar link e fechar.
- **Título**: texto grande sem borda, editável ao clicar (borda só no foco).
- **Coluna esquerda**: Descrição (área limpa, aparece borda só no foco); Subtarefas com cabeçalho "2 de 8 concluídas" + barra, linhas com círculo de marcar, código em chip, título, responsável (avatar) e prazo, e "+ Adicionar subtarefa" como linha inline; Checklist com o mesmo padrão; abas com contadores: Atividade (n) · Comentários (n) · Tempo · Vínculos GRC (n), com a linha do tempo de atividade e campo de comentário fixos embaixo.
- **Coluna direita (painel de propriedades)**: lista label/valor sem caixas — ícone + rótulo à esquerda, valor clicável à direita (fica realçado no hover): Status (chip), Responsável (avatar + nome), Prioridade (bandeira colorida), Datas (início → conclusão em uma linha), Estimativa, Sprint, Etiquetas (chips + "+"), Progresso com anel grande (56px) e % no centro. Abaixo, cartões de Vínculos GRC.
- **Rodapé**: Excluir (texto vermelho, com confirmação e desfazer) à esquerda; Fechar e Salvar à direita.
- **Celular**: propriedades sobem para o topo em grade de 2 colunas.

## Detalhes técnicos
- `ListaTarefas.tsx`: remover o tom lateral por atraso e o estilo de linha-cartão herdado do DataTable para esta tabela; aplicar `linhaCls` por nível com tokens (`--primary`, `--chart-teal`); unificar Coluna/Status em `StatusBadge` preenchido.
- `TarefaDialog.tsx`: novo header com breadcrumb e `StatusPill` (Popover com etapas); título `Input` variante ghost; componente `PropRow` ghost (Popover/Select sem borda); contadores via contagem de comentários, vínculos e atividade já carregados; exclusão via `undoableAction`; `ProgressRing` 56px.
- Sem mudança de dados nem permissões; textos novos em pt/en no `p3-projetos.ts`.
- Verificação: abrir o Projeto ISO 27001 como usuário da redpost via Playwright e comparar capturas da lista e da janela com os modelos.
