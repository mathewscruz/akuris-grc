# Projetos: melhorias visuais nas outras abas

Objetivo: levar Kanban, Calendário, Gantt, Sprints, Métricas e Automações ao mesmo nível da Lista e da janela da tarefa (cores por nível, chips de código, status tonais, avatares com foto).

## 1. Kanban
- Cartão no estilo da lista: chip do código (F0.1) + título, linha de contexto com a fase/domínio em cinza, ◆ dourado nos marcos.
- Rodapé do cartão: avatar com foto do responsável, data com cor de atraso, barra fina de progresso, contadores de subtarefas e comentários.
- Cabeçalho da coluna com a cor do status (mesmas cores dos chips: cinza, azul, verde, vermelho) e uma barra de topo dessa cor; contador em chip.
- Fases e domínios (tarefas agrupadoras) saem do quadro; ficam como filtro "Fase" no topo, para o quadro mostrar só atividades.

## 2. Calendário
- Tarefas como barras que atravessam os dias (início → fim), coloridas pelo status, em vez de só aparecerem no prazo.
- Dia de hoje destacado com círculo roxo; fins de semana em fundo mais suave; marcos com ◆.
- "+N mais" quando o dia tem muitas tarefas, abrindo uma lista.
- Alternar Mês / Semana.

## 3. Gantt
- Coluna da esquerda com a mesma hierarquia da lista (faixa roxa para fase, verde-azulada para domínio, recuo e chips).
- Escala de meses no topo com linhas verticais suaves e linha vertical "Hoje" em roxo.
- Barras arredondadas com a parte concluída preenchida (progresso real) e cor do status; fases como barra-resumo; marcos como losango dourado.
- Recolher/expandir fase igual à lista; zoom Semana / Mês / Trimestre.

## 4. Sprints
- Cartão de cada sprint com datas, chip de estado (Ativa / Concluída / Planeada), barra de progresso e avatares da equipa.
- Sprint ativa em destaque no topo com burndown em gráfico de área no padrão do sistema (paleta neutra + linha ideal tracejada).
- Estado vazio ilustrado com botão "Criar primeira sprint".

## 5. Métricas
- Faixa de KPIs no padrão StatStrip (progresso geral vs planeado, concluídas, atrasadas, próximo marco).
- "Progresso por fase" com as cores de nível e o código da fase em chip.
- Novos gráficos com dados reais: tarefas por status (rosca), carga por responsável (barras com foto), tendência semanal de conclusões, próximos marcos em linha do tempo.

## 6. Automações
- Cada regra como cartão "Quando … → Então …" com ícones, em vez de linhas de texto.
- Interruptor ativo/inativo visível no cartão, contador de execuções e data da última execução quando houver.
- Estado vazio com 3 modelos prontos (ex.: "Ao concluir, notificar o responsável da fase").

## Abas em geral
- Contadores nas abas (Kanban/Lista: nº de tarefas; Sprints: nº de sprints; Automações: nº de regras ativas).
- Barra de filtros partilhada (busca, responsável, fase, tipo) que se mantém ao trocar entre Kanban, Lista, Calendário e Gantt.

## Detalhes técnicos
- Reutilizar `StatusPill`, `statusKindDe`, chip de código e regra de nível já usados em `ListaTarefas`; extrair para um helper comum (`projeto-visual.ts`) para as seis abas usarem o mesmo padrão.
- Avatares via `useUsuariosEmpresa` (com `foto_url`, filtrado por empresa).
- Gráficos com `AkurisCharts` e `chart-tokens`; carregamento com `AkurisPulse`.
- Só apresentação: sem mudança de dados ou permissões, exceto contagem de execuções das automações, que só aparece se já existir registo.
- Verificação por Playwright em cada aba com o Projeto ISO 27001 da redpost.

Posso fazer tudo de uma vez ou por etapas (sugestão: 1 Kanban + 3 Gantt primeiro, que são as mais usadas).
