# Popup da tarefa: círculo de % alinhado e preenchimento mais fácil

## Problema
- No popup da tarefa, o número do círculo é um texto separado, colocado por cima do desenho. Por isso pode sair do centro.
- A % só pode ser preenchida digitando um número, e o campo anda de 5 em 5.

## Como vai ficar
1. **Círculo alinhado e animado**
   - O número passa a fazer parte do próprio desenho do círculo e fica sempre no centro exato.
   - Ao mudar a %, o anel e o número sobem juntos, de forma suave.
   - Verde a 100%, roxo nos demais valores, como hoje.
2. **Preencher a % com um clique**
   - Botões rápidos: **0 · 25 · 50 · 75 · 100%**.
   - Uma barra deslizante de 0 a 100, de 5 em 5, que também funciona com as setas do teclado.
   - O campo para digitar continua disponível ao lado, para valores exatos.
   - Clicar em 100% marca a tarefa como concluída, como já acontece com o estado "Concluído".
3. **Calcular automaticamente**
   - Para tarefas com subtarefas ou checklist, há um interruptor "Calcular pelas subtarefas/checklist". A % passa a ser a proporção de itens concluídos e os controles manuais ficam bloqueados.
   - Quando a tarefa está num estado concluído, tudo fica bloqueado em 100%, como hoje.

## Detalhes técnicos
- `ProgressRing` em `TarefaDialog.tsx`: `<text textAnchor="middle" dominantBaseline="central">` dentro do SVG; animação do número com `requestAnimationFrame` (respeita `prefers-reduced-motion`); `transition-ui` no traço.
- Barra deslizante com o componente `Slider` do sistema; botões rápidos com o padrão de pílula atual (`Chip`/botão `rounded-full`).
- Cálculo automático: subtarefas concluídas ÷ total (ou itens marcados do checklist ÷ total). O resultado é gravado em `progresso_pct` ao salvar. A preferência fica na própria tarefa, em `tags` com uma etiqueta interna `__pct_auto`, sem mudar o banco de dados.
- Textos novos em PT e EN; teste unitário para o cálculo automático.
