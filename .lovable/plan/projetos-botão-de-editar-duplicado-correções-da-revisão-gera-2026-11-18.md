# Projetos: botão de editar duplicado + correções da revisão geral

## 1. Um único "Editar projeto"
- Remover o botão "Editar" ao lado de "Ações" na página do projeto. "Editar projeto" continua sendo a primeira opção do menu "Ações".

## 2. Correções encontradas na revisão
**Dados e estados**
- Tarefa reaberta no Kanban (saindo de Concluído) volta a ficar com 100%. Agora a % zera e a tarefa volta a poder ficar atrasada.
- "Criar tarefa" a partir de outro módulo (risco, controle, etc.) só abria uma vez. Passa a abrir sempre.
- Se o vínculo com o outro módulo falhar, tentar de novo não cria mais tarefa duplicada; só refaz o vínculo.
- Nos registros de tempo, o total de horas atualiza na hora ao lançar ou apagar.
- O cronômetro deixa de "carregar" o tempo de uma tarefa para outra.
- Apagar uma sprint libera as tarefas dela imediatamente.

**Métricas e datas**
- Tarefa com prazo hoje deixa de ser "atrasada" desde a meia-noite. Tarefas só com data de fim entram na conta.
- A % de conclusão das métricas passa a contar só atividades reais (sem as tarefas-grupo), batendo com os números do topo.
- Datas dos registros de tempo deixam de aparecer um dia antes.
- O burndown da sprint para no dia de hoje; não desenha dias futuros como se já tivessem acontecido.

**Idioma**
- Avisos "Tarefa removida", "Sprint removida", "Tempo registrado" e erros passam a aparecer em inglês quando o sistema está em inglês.

Verificado sem problema: campos salvam e carregam corretamente, calendário mensal/semanal sem erro de limites, traduções existentes completas.

## Detalhes técnicos
- `ProjetoDetalhe.tsx:143`: remover Button; manter `ProjetoActionsMenu onEdit`.
- Migration: no trigger de conclusão, ao sair de coluna concluída, `progresso_pct = 0` quando estava 100.
- `CriarTarefaFromGRC`: props controladas `open/onOpenChange`; guardar `createdTaskId` para retry só do vínculo. `CriarTarefaMenuItem` usa as props.
- `TempoPanel`: total somado de `entradas`; reset de `startedAt/elapsed` ao mudar `tarefaId`; `parseDataLocal(e.data)`.
- `useProjetoExtras` delete sprint: invalidar `['projeto-tarefas', projetoId]`; toasts via `tGlobal` com chaves PT/EN (também `useProjetoTarefas`).
- `MetricasPanel`: usar `estaAtrasada()` e conjunto de folhas de `projeto-acompanhamento`.
- `SprintsPanel`: série real cortada em `now`.
- Testes: métricas (folhas/atraso hoje) e reset de progresso ao reabrir.
