# Gantt: subtarefas sem data aninhadas também na ordenação por data

## Situação
O ajuste anterior não resolve esse caso. O print mostra o Gantt ordenado por data. Nesse modo, a lista fica plana: todas as tarefas sem data vão para o fim, longe da tarefa principal. As barras "Sem data" só aparecem no modo "Estrutura do projeto".

## Como vai ficar
- Na ordenação por **Data de início** ou **Prazo**, a hierarquia é mantida. Fases, domínios e atividades são ordenados por data dentro do próprio nível.
- Cada subtarefa continua logo abaixo da sua tarefa principal, com o recuo de sempre e a seta para recolher.
- Dentro de cada grupo, as subtarefas com data vêm primeiro, em ordem de data. As sem data vêm depois, ainda dentro do grupo e com a barra tracejada "Sem data" no período da tarefa principal.
- A data de um grupo é a da primeira atividade datada dentro dele. Grupos sem nenhuma data vão para o fim do seu nível.
- A escolha da ordenação continua salva por projeto.

## Detalhes técnicos
- `ordenarArvorePorData(tarefas, ordem)` em `projeto-acompanhamento.ts`: ordena os irmãos de cada nível pela chave de data. A chave de um grupo é a menor data entre os descendentes datados. Os sem data ficam no fim, mantendo a `ordem` original. A função devolve uma lista com a profundidade de cada tarefa.
- `GanttChart.tsx`: o modo por data passa a usar essa função e a respeitar `recolhidos`, como o modo estrutura.
- Teste: uma subtarefa sem data fica logo depois das irmãs datadas, dentro do mesmo pai, e não no fim da lista.
