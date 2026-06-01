# Projetos — Fase 3 (Paridade com Jira/ClickUp + Itens pendentes)

## Passos manuais que vou executar

1. **Habilitar `pg_cron` e `pg_net`** via migration.
2. **Agendar o `projeto-sla-checker`** para rodar a cada hora (via insert SQL com URL + anon key reais).
3. **Embutir `<CriarTarefaFromGRC>`** nas telas de **Gap Analysis (requisito)**, **Incidentes**, **Riscos** e **Auditorias** (1 botão padrão "Criar tarefa de projeto" em cada detalhe/linha).

## Exclusão de projetos

- Botão **"Excluir projeto"** no header de `ProjetoDetalhe` (variante destrutiva, atrás de `ConfirmDialog` com digitar o nome para confirmar — padrão Jira).
- Menu de contexto **"Arquivar / Excluir"** no card de projeto em `Projetos.tsx` (3 pontos).
- Bloqueia exclusão se houver tarefas ativas — oferece "Arquivar" como alternativa segura (muda `status` para `arquivado`).
- Hook `useDeleteProjeto` já existe — só falta o gatilho na UI.

## Lacunas identificadas vs Jira/ClickUp e o que entra nesta fase

### Gestão de trabalho (essencial faltando)
- **Filtros e busca avançada** na Lista: por responsável, prioridade, status, tags, prazo, SLA, origem GRC.
- **Agrupamento** na visão Lista: por coluna, prioridade ou responsável (estilo ClickUp "Group by").
- **Subtarefas** com indentação visual e progresso herdado (campo `parent_task_id` já existe — só falta UI).
- **Bulk actions**: seleção múltipla na Lista para mover de coluna, mudar prioridade, atribuir responsável, excluir.
- **Quick add** inline no Kanban (linha "+ Adicionar tarefa" no rodapé de cada coluna sem abrir dialog).

### Visões adicionais
- **Visão Calendário** mensal mostrando tarefas pelo `prazo` (drag para alterar prazo).
- **Minha caixa** ("My Work" do ClickUp): rota `/projetos/minhas-tarefas` listando tudo onde o usuário é responsável, agrupado por urgência.

### Sprints / Iterações (modo ágil leve)
- Tabela `projeto_sprints` (nome, data_inicio, data_fim, projeto_id, ativa, objetivo).
- Coluna `sprint_id` em `projeto_tarefas`.
- Seletor de sprint no header + "Sprint atual" como filtro padrão.
- Burndown simples (SVG) na aba Sprint.

### Time tracking
- Tabela `projeto_tempo_entradas` (tarefa_id, user_id, horas, descricao, data).
- Botão **Play/Pause** na TarefaDialog que registra tempo.
- Soma do `tempo_gasto_horas` atualizada por trigger.

### Automações (UI)
- Tela **`/projetos/:id/automacoes`** com builder visual:
  - **Quando**: tarefa criada / movida para coluna X / prazo vencido / SLA em risco.
  - **Então**: atribuir a Y / mover para coluna Z / mudar prioridade / notificar usuário / criar tarefa filha.
- Edge function **`projeto-automacao-executor`** chamada por trigger pg quando tarefas mudam de coluna.

### Templates (UI)
- Tela **`/configuracoes/projeto-templates`** (super-admin gerencia globais; admin gerencia da empresa).
- Botão **"Criar a partir de template"** no `Projetos.tsx` (mostra templates globais + empresa).
- Aplicar template clona colunas + tarefas iniciais.

### Notificações centralizadas
- Trigger pg que insere em `notifications` quando: tarefa atribuída, comentário com menção, prazo vence em 24h, SLA violado.
- Aparecem no sino do header (padrão já existente).

### Colaboração refinada
- **@menções** no campo de comentário (autocomplete de usuários da empresa).
- **Reações** nos comentários (👍 ✅ ❓) — tabela `projeto_comentario_reacoes`.
- **Edição/exclusão** do próprio comentário (timestamp `updated_at`).
- **Watchers**: `projeto_tarefa_seguidores` já existe — botão "Seguir" no TarefaDialog.

### Métricas e relatórios
- Dashboard do projeto com: velocidade (tarefas/semana), cycle time médio, distribuição por prioridade, taxa de SLA.
- Exportar tarefas em CSV (usando `csv-utils.ts`).
- Exportar status report em PDF (usando `pdf-utils.ts`).

### Tarefas recorrentes
- Campo `recorrencia` (cron-like simples: diária, semanal, mensal) — trigger gera a próxima ao concluir.

## Faseamento (uma entrega)

**Pacote A — fundamentos faltando (alta prioridade):**
1. Migration: `projeto_sprints`, `projeto_tempo_entradas`, `projeto_comentario_reacoes`, coluna `sprint_id` em `projeto_tarefas`, trigger de notificações.
2. Habilita `pg_cron`/`pg_net` + agenda `projeto-sla-checker` (hourly).
3. Exclusão/arquivamento de projeto (UI).
4. Filtros + busca + agrupamento na Lista; bulk actions; quick-add no Kanban.
5. Subtarefas (UI hierárquica).
6. Visão Calendário + rota "Minhas tarefas".
7. `<CriarTarefaFromGRC>` embutido em Gap Analysis, Incidentes, Riscos e Auditorias.

**Pacote B — produtividade (incluso):**
8. Time tracking (Play/Pause + somatório).
9. UI de Automações (builder + executor edge function).
10. UI de Templates (lista, criar, aplicar).
11. Watchers (seguir/parar de seguir).
12. @menções + reações em comentários.

**Pacote C — métricas (incluso):**
13. Sprint board + burndown SVG.
14. Mini-dashboard de métricas no projeto.
15. Exportar CSV/PDF.

Tarefas recorrentes ficam fora deste plano (item de baixa prioridade — pode entrar em fase futura se você quiser).

## Detalhes técnicos

```text
projeto_sprints              (id, empresa_id, projeto_id, nome, objetivo, data_inicio, data_fim, ativa, created_at)
projeto_tempo_entradas       (id, empresa_id, tarefa_id, user_id, horas, descricao, data, created_at)
projeto_comentario_reacoes   (id, comentario_id, user_id, emoji, created_at)
projeto_tarefas.sprint_id    (uuid, fk → projeto_sprints.id, nullable)

Triggers:
  trg_notifica_tarefa_atribuida   → notifications quando responsavel_id muda
  trg_notifica_comentario_mencao  → notifications quando mencionados[] não vazio
  trg_executa_automacoes          → invoca projeto-automacao-executor via pg_net quando coluna_id muda

Edge functions:
  projeto-automacao-executor      → recebe tarefa+gatilho, lê regras ativas, executa ações
  projeto-recorrente-generator    → (não nesta fase)

UI:
  src/pages/MinhasTarefas.tsx
  src/pages/ProjetoAutomacoes.tsx
  src/pages/ProjetoTemplates.tsx
  src/components/projetos/CalendarView.tsx
  src/components/projetos/SprintBoard.tsx
  src/components/projetos/BurndownChart.tsx
  src/components/projetos/ListaTarefasAdvanced.tsx (filtros, bulk, agrupar, subtarefas)
  src/components/projetos/TimeTracker.tsx
  src/components/projetos/AutomacaoBuilder.tsx
  src/components/projetos/MetricasDashboard.tsx

Multi-tenant: toda query inclui .eq('empresa_id', empresaId). RLS espelhando o padrão da Fase 1/2.
Identidade visual: DM Sans, StatCards, StatusBadges (status-tone), AkurisPulse, EmptyState, CornerAccent.
Loaders: somente AkurisPulse — sem Loader2/Skeleton visíveis.
Toasts: Sonner via akurisToast quando aplicável.
```

## Fora de escopo (deixar para depois)
- Integração com Git/PRs, dependências cross-projeto, formulários customizados, dashboards multi-projeto agregados, importação de Jira/CSV, API pública de projetos. Posso atacar em uma Fase 4 dedicada se você quiser.

Pode aprovar que eu sigo direto na implementação desses três pacotes (A+B+C) em uma mensagem só.