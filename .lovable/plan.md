# Projetos: datas das subtarefas e melhorias propostas

## O que já está pronto
- **Lista de atividades:** a coluna "Período" mostra início → fim de cada tarefa e subtarefa.
- **Popup da tarefa:** tem os campos de início e prazo, e o Gantt desenha as barras com essas datas.
- **Gantt:** subtarefas sem data aparecem dentro da tarefa principal, com a barra tracejada "Sem data", também na ordenação por data. A barra da tarefa principal cobre o período das subtarefas que têm data.
- **No "Projeto ISO 27001":** as 122 subtarefas têm data e responsável.

## Lacunas encontradas
1. **Lista de subtarefas no popup:** mostra só a data de fim, sem o início.
2. **Gantt:** não é possível arrastar ou esticar uma barra para mudar as datas, nem definir as datas de uma tarefa sem data direto no gráfico.
3. **Dependências:** as dependências entre tarefas (uma só começa quando outra termina) existem no sistema, mas não aparecem no Gantt. Também não há aviso quando uma tarefa começa antes de a anterior terminar.
4. **Tarefa principal:** não há aviso quando as datas da tarefa principal não cobrem as das subtarefas.
5. **Comparação com o plano original:** não dá para comparar o cronograma atual com o plano inicial e ver o quanto cada atividade atrasou.
6. **Ações em lote na lista:** não é possível selecionar várias tarefas e mudar responsável, estado ou datas de uma só vez, nem deslocar um grupo inteiro em X dias.

## O que proponho fazer
1. **Datas no popup:** mostrar "início → fim" em cada subtarefa e destacar em vermelho as atrasadas.
2. **Gantt editável:**
   - arrastar uma barra move a tarefa no tempo;
   - esticar a ponta da barra muda o prazo;
   - clicar numa barra "Sem data" já define as datas.

   Cada mudança pode ser desfeita.
3. **Dependências no Gantt:** setas ligando as tarefas dependentes e aviso de conflito ("começa antes da anterior terminar").
4. **Aviso na tarefa principal:** um alerta quando as subtarefas passam do período dela, com o botão "Ajustar período ao das subtarefas".
5. **Linha de base:** botão "Salvar linha de base", que guarda as datas atuais. O Gantt passa a mostrar uma barra fina com o plano original e quantos dias cada atividade desviou.
6. **Ações em lote na lista:** selecionar várias tarefas para mudar responsável, estado ou datas, ou deslocar todas em X dias.

Se preferir começar por uma parte menor, os itens 1 a 4 são rápidos e não mudam o banco de dados. Os itens 5 e 6 são maiores.

## Detalhes técnicos
- Item 2: arrastar com pointer events no `GanttChart`, arredondando para o dia mais próximo. A gravação usa o hook otimista existente e `undoableAction`, com consultas sempre filtradas por `empresa_id` e projeto.
- Item 3: ler `projeto_tarefa_dependencias` (FS, SS, FF, SF) com escopo por empresa e desenhar as setas em SVG por cima da área do gráfico.
- Item 5: migration adicionando `baseline_inicio` e `baseline_fim` em `projeto_tarefas`, e uma RPC `salvar_linha_base(projeto_id)` que verifica a empresa da sessão.
- Item 6: barra de seleção no `DataTable` e update em lote filtrado por empresa e projeto.
- Testes para o arredondamento ao arrastar, para a detecção de conflito de dependência e para o deslocamento em lote.
- Todos os textos novos em PT e EN.
