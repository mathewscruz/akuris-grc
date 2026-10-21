# Projeto ISO 27001 na empresa redpost

## O que a planilha traz
- 14 meses (01/08/2026 a 30/09/2027), cerca de 108 atividades divididas em fases (Fase 0, 1, ...).
- Cada atividade tem: ID (ex.: F0.3), descrição, Tipo (Gestão, Processo, Ferramenta técnica, Pessoas, Auditoria), referência ISO, responsável, mês de início/fim, status, % concluída, módulo Akuris, fase e observações. Também há marcos e documentos obrigatórios.

## Cadastro automático
1. Criar "Projeto ISO 27001" na empresa redpost, de 01/08/2026 a 30/09/2027, com o Halan Borges como dono.
2. Colunas do quadro com os mesmos status da planilha: Não iniciado, Em andamento, Atrasado, Concluído.
3. Cada fase vira uma tarefa principal; as atividades dela ficam como subtarefas.
4. Em cada atividade: título com o ID, datas, status, % concluída, observações na descrição e etiquetas para Tipo, referência ISO e módulo Akuris.
5. Na planilha o responsável aparece só como "Wired". Todas as atividades ficam inicialmente com o Halan, e depois ele pode trocar cada uma por outra pessoa da equipe: Hugo, Pedro, Joana ou Mathews.

## Ajustes no módulo para acompanhar como na planilha
- Lista de tarefas: colunas de ID, Fase, Tipo, Referência ISO, Responsável, Início/Fim, Status e % concluída, com agrupamento por fase e filtros por tipo e responsável.
- Marcos: as atividades marcadas com ◆ aparecem destacadas no Gantt e na lista.
- Painel do projeto (aba Métricas): progresso geral, atividades concluídas e atrasadas (prazo vencido e abaixo de 100%), "planejado até hoje", próximo marco e progresso por fase. São os mesmos números do Painel da planilha.
- Visão "Plano mensal": atividades agrupadas pelo mês de início (M1 a M14).

## Detalhes técnicos
- Inserção única via SQL em `projetos`, `projeto_colunas` e `projeto_tarefas` (parent_task_id para as fases, tags, progresso_pct, data_inicio/data_fim), sempre com empresa_id da redpost.
- O ID, a fase e a referência ficam nos campos que já existem (título e tags), sem tabela nova. O marco usa a tag `marco`.
- Antes de inserir, conferir no banco os nomes das colunas.
- Melhorias de interface em ListaTarefas e MetricasPanel, com textos em pt e en.
