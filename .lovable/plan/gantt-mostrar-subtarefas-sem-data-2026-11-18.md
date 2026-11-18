# Gantt: mostrar subtarefas sem data

## Problema
A linha da subtarefa sem data aparece na lista à esquerda, mas fica vazia na linha do tempo, sem nenhuma barra. Parece que a subtarefa "sumiu" de dentro da tarefa principal.

## Como vai ficar
- **Subtarefa sem data dentro de uma tarefa com período:** aparece uma barra fantasma, tracejada e esmaecida, ocupando o mesmo período da tarefa principal. Ela leva o rótulo "Sem data". Assim, dá para ver a que parte do cronograma a subtarefa pertence.
- **Quando nem a tarefa principal tem período:** aparece uma pequena etiqueta "Sem data" no início da linha do tempo.
- **Na lista à esquerda:** um ícone discreto de calendário ao lado do nome indica que falta definir a data.
- **Ao clicar na barra fantasma ou na etiqueta:** a tarefa abre para definir as datas, como já acontece com as outras barras.
- **Barra-resumo e escala do gráfico:** só usam datas reais. As barras fantasmas não alteram o período da tarefa principal.
- **Ordenação por data de início ou por prazo:** as tarefas sem data ficam no fim da lista e também ganham a etiqueta "Sem data".
- **Textos:** "Sem data" e a dica "Defina as datas para posicionar no cronograma" terão versões em PT e EN.

## Detalhes técnicos
- `GanttChart.tsx`: nova função para achar o período herdado do ancestral mais próximo, usando `resumo()`/`intervalo()` e ignorando as barras fantasmas. Ela só é usada para desenhar e nunca grava nada.
- Barra fantasma com `border-dashed`, `bg-muted/40` e tokens semânticos. A etiqueta usa `<Chip/>`.
- Teste unitário para o período herdado: uma subtarefa sem data herda o período do pai; sem pai datado, não herda nada.
