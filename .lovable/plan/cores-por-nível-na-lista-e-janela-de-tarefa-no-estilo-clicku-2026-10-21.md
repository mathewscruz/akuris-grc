# Cores por nível na lista e janela de tarefa no estilo ClickUp

## 1. Lista de tarefas: Modelo A, faixas por nível
- **Fase:** linha em faixa roxa suave com barra roxa à esquerda, título em negrito, botão para recolher ou expandir e uma barra de progresso da fase (média das atividades).
- **Domínio:** faixa verde-azulada (teal) mais clara, recuada um nível, com barra teal à esquerda e o próprio botão de recolher.
- **Atividade:** linha branca, com linhas finas ligando-a ao nível de cima e o código (F0.1, D2.3…) num chip roxo antes do título.
- **Marco:** losango ◆ dourado/roxo junto do título.
- **Status:** chips coloridos. Não iniciado em cinza, Em andamento em azul, Concluído em verde e Atrasado em vermelho.
- A informação de recolher e expandir fica guardada enquanto a pessoa navega pelas abas.
- Funciona no modo claro e no escuro, sempre com as cores do sistema.

## 2. Janela da tarefa: Modelo A, ClickUp
Janela larga, dividida em duas colunas:
- **Topo:** caminho do item (Projeto ISO 27001 / Fase 0 / Domínio), título grande editável direto no lugar, abas com contadores (Detalhes, Subtarefas, Checklist, Tempo, Vínculos GRC).
- **Coluna esquerda:**
  - Descrição.
  - Subtarefas, com caixa de seleção, prazo, barra "2 de 4 concluídas" e "+ Adicionar subtarefa".
  - Checklist com progresso.
  - "Atividade e comentários", com o campo de comentário no fim.
- **Coluna direita (propriedades), uma por linha com ícone:**
  - Status: chip colorido que troca a coluna do quadro.
  - Responsável, com avatar.
  - Prioridade, com bandeira.
  - Datas de início e de conclusão.
  - Estimativa.
  - Sprint.
  - Etiquetas: tipo, referência ISO e módulo, com a opção de adicionar.
  - Progresso: anel com % editável.
  - Abaixo, os cartões de "Links de GRC".
- **Rodapé:** Excluir (com confirmação e opção de desfazer) e Salvar. As alterações das propriedades continuam a ser guardadas só ao clicar em Salvar, como hoje.
- **No celular:** a janela ocupa a tela inteira e a coluna de propriedades passa para cima do conteúdo.

## Detalhes técnicos
- `ListaTarefas.tsx`: estilo por profundidade (0 = fase, 1 = domínio, 2+ = atividade, detectada pela hierarquia e não pelo texto), estado `recolhidos` em Set, chip de ID extraído do prefixo do título "XX — ".
- `TarefaDialog.tsx`: reorganizado em `TarefaDetalheLayout` (grid `lg:grid-cols-[1fr_340px]`). Reaproveita os painéis que já existem (Checklist, Tempo, Comentários, VinculosGRCPanel, UserSelect, DateField) e acrescenta data de início, progresso e etiquetas ao formulário. Subtarefas: lista das tarefas filhas e criação com `parent_task_id`.
- Cores só por tokens (primary, accent/teal, chart-tokens); textos novos em pt e en; testes de i18n.
