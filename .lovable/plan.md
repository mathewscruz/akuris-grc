# Janela da tarefa: alinhamento completo

## O que muda
Todos os campos e botões da janela passam a ter a mesma altura (36px) e a ficar alinhados pela base, com o mesmo espaço entre rótulo e campo.

- **Aba Tempo — registo manual**: Horas, Descrição e o botão "+" na mesma linha e com a mesma altura; rótulos com o mesmo espaço acima dos dois campos; botão "+" quadrado do tamanho do campo.
- **Aba Tempo — cronómetro**: campo e botão Iniciar/Parar na mesma altura e centrados; os três números de resumo alinhados.
- **Checklist**: campo "Adicionar item…" e botão "+" com a mesma altura (hoje o botão é maior que o campo).
- **Comentários**: caixa de texto e botão de enviar alinhados pela base, botão do mesmo tamanho do "+".
- **Vínculos GRC**: seletor de tipo, campo de busca e botão Adicionar na mesma altura.
- **Painel direito**: todas as linhas (Status, Responsável, Prioridade, Datas, Estimativa, Sprint, Etiquetas) com a mesma altura e o valor alinhado à mesma margem esquerda; o campo de progresso com a mesma altura dos outros.
- **Subtarefas**: linha de "Adicionar subtarefa" com a mesma altura das outras linhas.

## Detalhes técnicos
- `TempoPanel.tsx`: linha manual `flex items-end gap-2`, `Label` com `mb-1.5 block` em ambos, `Input h-9`, botão `size="icon" h-9 w-9`; cronómetro `items-center`, botões `h-9`.
- `TarefaDialog.tsx`: `ChecklistPanel` input `h-9` + botão `h-9 w-9`; `ComentariosPanel` `items-end`, botão `h-9 w-9`; `Prop` com `min-h-9`, valores com `px-2` uniforme (UserSelect, DateField, Input, Select, etiquetas); input de progresso `h-9`.
- `VinculosGRCPanel.tsx`: `SelectTrigger`, busca e botão com `h-9`, `sm:items-center`.
- Verificação por Playwright: abrir uma atividade do Projeto ISO 27001 com sessão da redpost e capturar cada aba (Detalhes, Comentários, Tempo, Vínculos) para conferir o alinhamento.
