# Visão semanal clara e evidências nas atividades

O cliente pediu duas coisas: ver claramente as semanas de cada mês, e anexar uma evidência (arquivo ou link) a cada atividade concluída.

## 1. Divisão das semanas no Gantt
Hoje o zoom "Semana" só aumenta a largura dos dias. O cabeçalho continua mostrando apenas os meses.
- Cabeçalho em duas linhas no zoom Semana: em cima o mês, embaixo as semanas ("S1 · 03–09", "S2 · 10–16"…), começando na segunda-feira.
- Linhas verticais marcando o início de cada semana, mais fortes na virada do mês. Fins de semana com um fundo levemente mais escuro.
- A semana atual fica destacada com uma faixa suave, além da linha "Hoje".
- No zoom Mês, aparecem traços finos nas semanas, sem rótulos, para não poluir.
- Novo atalho "Esta semana": filtra a lista e o Gantt para mostrar só as atividades com período nesta semana (seg–dom), com um resumo no topo, por exemplo "6 atividades · 2 atrasadas · 3 concluídas".

## 2. Evidências na atividade
O banco já tem uma tabela de anexos de atividade e um espaço protegido para arquivos, mas a janela da atividade não tem nenhum lugar para usá-los.
- Nova aba **Evidências** na janela da atividade, com:
  - arrastar/soltar ou escolher um arquivo (PDF, imagem, Office, até 20 MB);
  - "Adicionar link" (SharePoint, Drive, etc.) com nome;
  - lista com nome, quem enviou, data, botão para abrir/baixar e excluir com desfazer.
- **Exigir evidência para concluir** (opção no projeto, ligada por padrão): ao mover para Concluído na janela, no Kanban ou na edição em lote, sem evidência, aparece um aviso "Anexe uma evidência para concluir" que abre direto a aba Evidências.
- Clipe com contador na lista e no Kanban para mostrar quais atividades já têm evidência.
- Ao concluir uma atividade ligada a um requisito do Gap Analysis, perguntar "Usar também como evidência do requisito?" para aproveitar o mesmo arquivo.

## Detalhes técnicos
- Gantt: gerar `semanas[]` em `GanttChart.tsx` (startOfWeek seg), cabeçalho duplo quando `zoom==='semana'`; função pura `semanasNoIntervalo` em `projeto-cronograma.ts` com teste.
- Anexos: migration para adicionar `empresa_id`, `tipo_origem ('arquivo'|'link')`, `url` em `projeto_tarefa_anexos`; reescrever a RLS com isolamento por empresa e membro do projeto; caminho `empresa_id/projeto_id/tarefa_id/arquivo` no bucket existente com políticas checando o prefixo da empresa; URLs assinadas para baixar; links só `https`.
- `projetos.exigir_evidencia boolean default true`; a validação fica no cliente e também em um trigger (bloqueia `concluida_em` sem anexo quando exigido), para valer em qualquer caminho.
- Hook `useTarefaAnexos` com escopo por empresa; textos PT/EN; testes da regra "não conclui sem evidência".
