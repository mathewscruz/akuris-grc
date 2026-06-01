# Módulo Projetos — Gestão de Atividades (Jira/ClickUp-like)

Novo módulo "Projetos" no Akuris para gerenciar atividades em cards, com 3 visões (Kanban, Lista, Gantt), comentários/anexos/checklist, automações, SLA, vínculo polimórfico com qualquer entidade GRC, criação automática a partir de gaps/achados e IA (quebra de tarefas + status report).

## Experiência do usuário

**Navegação** — Nova entrada na sidebar "Projetos" (seção Operação), com ícone proprietário Akuris (stroke 1.5).

**Páginas:**
1. `/projetos` — Hub com cards de projetos da empresa (KPIs: tarefas abertas, atrasadas, % conclusão, próximos vencimentos). StatCards editoriais + filtros por status/owner.
2. `/projetos/:id` — Workspace do projeto com abas:
   - **Kanban** — colunas customizáveis (status), drag-drop, WIP limit opcional, swimlanes por responsável/prioridade
   - **Lista** — tabela densa com filtros, ordenação, edição inline e bulk actions
   - **Gantt** — timeline com dependências (FS/SS/FF/SF), marcos, caminho crítico visual, zoom dia/semana/mês
   - **Visão Geral** — resumo, burndown, riscos, status report IA
   - **Automações** — regras "quando X então Y"
   - **Configurações** — membros, colunas, SLA, templates

**Card de tarefa (dialog full-screen no mobile)** — título, descrição (rich text), status, prioridade, responsável (UserSelect), seguidores, datas (início/fim/prazo), estimativa/tempo gasto, tags, checklist, dependências, anexos, comentários com @menção, e **bloco "Vínculos GRC"** mostrando entidades ligadas (risco, controle, incidente, auditoria, gap, contrato, due diligence, política, ativo).

**Criação automática** — Em Gap Analysis, Auditorias e Incidentes, botão "Criar tarefa em projeto" que abre seletor de projeto + pré-preenche título/descrição/vínculo. Item de auditoria reprovado pode disparar tarefa automaticamente via toggle.

**Notificações** — Tudo centralizado no sino do header (atribuição, comentário com @, vencimento próximo, SLA estourado, mudança de status).

**IA (consome créditos)** — Botão "Sugerir quebra" no projeto vazio gera lista de tarefas a partir do objetivo. Botão "Status Report" gera relatório executivo (progresso, bloqueios, riscos, próximos passos) exportável em PDF.

## Modelo de dados (Supabase)

Todas as tabelas com `empresa_id uuid not null`, RLS por empresa + membership, GRANT explícito, índices em FKs.

- `projetos` — nome, descrição, status (ativo/pausado/concluído/arquivado), owner_id, data_inicio, data_fim_prevista, cor, icone, configuracoes (jsonb: WIP limits, colunas customizadas, SLA por prioridade)
- `projeto_membros` — projeto_id, user_id, papel (owner/admin/membro/viewer)
- `projeto_colunas` — projeto_id, nome, ordem, cor, wip_limit, is_concluido
- `projeto_tarefas` — projeto_id, coluna_id, titulo, descricao, prioridade (baixa/media/alta/critica), responsavel_id, criador_id, data_inicio, data_fim, prazo, estimativa_horas, tempo_gasto_horas, progresso_pct, tags (text[]), ordem (para drag-drop), parent_task_id (subtarefas), bloqueada (bool)
- `projeto_tarefa_seguidores` — tarefa_id, user_id
- `projeto_tarefa_dependencias` — tarefa_id, depende_de_tarefa_id, tipo (FS/SS/FF/SF)
- `projeto_tarefa_checklist` — tarefa_id, texto, concluido, ordem
- `projeto_tarefa_comentarios` — tarefa_id, user_id, conteudo (rich), mencionados (uuid[])
- `projeto_tarefa_anexos` — tarefa_id, nome, url (Supabase Storage bucket `projeto-anexos`), tipo, tamanho
- `projeto_tarefa_vinculos` — tarefa_id, entidade_tipo (risco/controle/incidente/auditoria/gap/contrato/due_diligence/politica/ativo/denuncia/plano_acao), entidade_id, criado_por *(polimórfico — UNIQUE(tarefa_id, entidade_tipo, entidade_id))*
- `projeto_tarefa_atividade` — log timeline (campo, valor_antigo, valor_novo, user_id) para auditoria
- `projeto_automacoes` — projeto_id, nome, gatilho (jsonb), acoes (jsonb), ativa
- `projeto_templates` — empresa_id, nome, estrutura (jsonb: colunas + tarefas modelo)
- Bucket Storage: `projeto-anexos` (privado, RLS por empresa)

**RLS** (híbrido conforme escolha):
- Admins/super-admin da empresa: acesso total
- Demais: só veem projetos onde são membros (via `projeto_membros`)
- Função SECURITY DEFINER `is_projeto_member(projeto_id, user_id)` para evitar recursão

## Edge Functions

- `projeto-suggest-tasks` — recebe objetivo, devolve tarefas sugeridas via Lovable AI Gateway (`google/gemini-3-flash-preview`), consome crédito via `consume_ai_credit`, retorna 402 se exausto
- `projeto-status-report` — gera relatório executivo do projeto (mesmo padrão)
- `projeto-automacao-executor` — disparado por triggers no banco quando tarefa muda; executa ações (notificar, mover, criar subtarefa)
- `projeto-sla-checker` — cron diário verifica SLA estourado e dispara notificação

Tudo com `verify_jwt=true`, validação Zod, wrapper `invokeEdgeFunction`, logger central.

## Integrações com módulos existentes

- **Planos de Ação**: cada tarefa de projeto pode opcionalmente "virar" plano de ação (toggle no card) — sincronização bidirecional via trigger
- **Gap Analysis / Auditorias / Incidentes / Riscos**: botão "Criar tarefa" + listagem de tarefas vinculadas na tela da entidade (componente `<TarefasVinculadasPanel entidadeTipo entidadeId />`)
- **Dashboard**: novo card "Projetos ativos" com KPIs agregados
- **Notificações**: usa o sino existente + tabela `notifications`

## Frontend

- Pasta `src/components/projetos/` com `KanbanBoard.tsx`, `GanttChart.tsx`, `TarefaDialog.tsx`, `TarefaCard.tsx`, `ProjetoDialog.tsx`, `AutomacaoDialog.tsx`, `VinculosGRCPanel.tsx`, `StatusReportDialog.tsx`
- Hooks: `useProjetos`, `useProjetoTarefas`, `useProjetoStats`
- Páginas: `src/pages/Projetos.tsx`, `src/pages/ProjetoDetalhe.tsx`
- Drag-drop: `@dnd-kit/core` (já leve, compatível com a stack)
- Gantt: implementação custom em SVG (sem libs pesadas) baseada nas tarefas + dependências, para manter identidade visual
- Rich text: Tiptap (mesmo padrão de outros módulos se houver, senão textarea + markdown)
- Identidade: DM Sans, Navy/Purple, StatusBadge, AkurisPulse para loading, StatCard editorial, CornerAccent nos headers, AkurisMarkPattern em empty states

## Permissões (RBAC)

Novo módulo `projetos` adicionado em `planos-utils` e nos perfis de permissão modular. Ações: `view`, `create`, `edit`, `delete`, `manage_automations`.

## Entrega faseada

**Fase 1 (esta entrega)** — CRUD de projetos/tarefas, Kanban com drag-drop, Lista, comentários, anexos, checklist, vínculos GRC, notificações no sino, criação a partir de gaps/auditorias/incidentes, RLS, RBAC.

**Fase 2 (próxima)** — Gantt com dependências, automações, SLA checker, templates de projeto, IA (suggest-tasks + status-report), dashboard agregado.

Divido em duas fases para garantir qualidade — confirme se prefere assim ou se quer tudo numa entrega só (será maior e mais lenta de validar).
