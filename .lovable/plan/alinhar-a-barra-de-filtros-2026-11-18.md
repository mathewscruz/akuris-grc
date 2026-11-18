# Alinhar a barra de filtros

## O problema
Na lista de atividades dos projetos, cada filtro (Status, Prioridade, Coluna, Agrupar por, Responsável, Tipo) tem o nome **por cima** da caixa. Por isso os filtros ficam mais baixos que a busca, e o aviso de atrasadas, "Ir para hoje" e "8 de 8" ficam desalinhados no meio.

Os outros módulos (Riscos, Ativos, Contratos, Documentos...) já usam o padrão do sistema: o nome fica **dentro** da caixa ("Status: Todos"), com a mesma altura da busca. A lista de atividades era a única tela com o estilo antigo nas barras de filtro.

## O que muda
- Lista de atividades: os filtros passam ao padrão do sistema (nome dentro da caixa, mesma altura da busca), numa só linha alinhada.
- Busca, filtros, aviso de atrasadas, "Ir para hoje" e o contador "8 de 8" ficam todos na mesma linha central; em telas estreitas quebram de linha sem se desalinharem.
- Mesma revisão nas outras abas de Projetos com filtros no topo (Kanban, Sprints, Ligações GRC e o seletor de vista do projeto): mesma altura (40px) que a busca e os botões ao lado.

## Detalhes técnicos
- `ListaTarefas.tsx`: trocar os blocos `flex-col gap-1` + `<span>` por `<ToolbarField label=...>` (já usado por `ModuleToolbar`), busca com `h-10`, contêiner `items-center`, grupo da direita `ml-auto items-center`.
- `KanbanBoard.tsx`, `SprintsPanel.tsx`, `VinculosGRCPanel.tsx`, `ProjetoDetalhe.tsx`: seletores do topo com `h-10` (ou `ToolbarField` quando há rótulo), alinhados com os botões vizinhos.
- Verificação: varredura confirmou que nenhuma outra barra de filtro do sistema usa rótulo por cima; capturas de tela da lista em 1280px e 2844px para conferir o alinhamento.
