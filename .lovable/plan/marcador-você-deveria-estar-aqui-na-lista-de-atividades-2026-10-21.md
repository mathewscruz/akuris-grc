# Marcador "Você deveria estar aqui" na lista de atividades

## O que o usuário verá
- Na aba Lista do projeto, uma linha-marcador horizontal (faixa fina com rótulo "Você deveria estar aqui · hoje, 21/10") inserida entre as atividades, na posição da data de hoje no cronograma.
- Ao lado do marcador, um resumo do ritmo:
  - **Adiantado**: há atividades concluídas cujo período ainda está no futuro ("3 atividades adiantadas").
  - **Atrasado**: atividades com fim antes de hoje e não concluídas ("5 atividades atrasadas").
  - **No ritmo**: nenhuma das duas situações.
- Atividades que deveriam estar em andamento hoje (início ≤ hoje ≤ fim) recebem um realce sutil; as atrasadas acima do marcador ganham um pequeno indicador "atrasada".
- Botão "Ir para hoje" na barra da lista que rola até o marcador.

## Regras
- O marcador aparece só quando a lista está ordenada por período (padrão) e sem agrupamento, ou agrupada por mês (dentro do mês atual). Em outras ordenações, mostra apenas o resumo de ritmo e o botão fica oculto.
- Posição: antes da primeira atividade cujo início é posterior a hoje. Se o projeto ainda não começou, fica no topo; se já terminou, no fim.
- "Concluída" = status concluído ou progresso 100%. Fases/domínios (agrupadores) não contam no resumo, só atividades-folha.
- Atividades sem data são ignoradas.

## Detalhes técnicos
- Nova função pura em `src/lib/projeto-acompanhamento.ts`: `calcularPosicaoHoje(tarefas, hoje)` devolvendo índice do marcador, ids em andamento esperado, atrasadas e adiantadas.
- `ListaTarefas.tsx`: renderiza uma `TableRow` marcador (colSpan total) com tokens semânticos e vocabulário de `projeto-visual.tsx`; `ref` para rolar com "Ir para hoje".
- Textos pt/en em `p3Projetos.lista.*`.
- Testes em `projeto-acompanhamento.test.ts`: projeto não iniciado, em curso com atraso, adiantado, terminado.
