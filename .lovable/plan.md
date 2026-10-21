# Ligar Projetos aos demais módulos

## O que já existe
- Uma tarefa já pode ser ligada a riscos, controlos, incidentes, auditorias, requisitos, contratos, fornecedores, documentos, ativos, denúncias, planos de ação, dados pessoais, contas privilegiadas e continuidade (aba "Vínculos GRC").
- "Criar tarefa" já existe em Riscos, Incidentes, Gap Analysis e Contratos.
- Hoje a ligação é só de ida: o módulo de origem não mostra as tarefas nem o seu andamento.

## Oportunidades propostas

1. **Tarefas visíveis no painel lateral de cada módulo**
   Na aba "Ligações" do painel de risco, controlo, incidente, requisito etc., mostrar as tarefas ligadas com estado, responsável, prazo e link para abrir a tarefa.

2. **"Criar tarefa" em todos os módulos**
   Estender o botão para Controlos, Auditorias (achados), Documentos, Ativos, Continuidade, Privacidade e Planos de Ação, já com o vínculo preenchido.

3. **Projeto a partir do Gap Analysis**
   Botão "Gerar projeto de implementação" num framework: cria um projeto com uma fase por domínio e uma tarefa por requisito não conforme, já ligadas.

4. **Progresso que volta para o módulo**
   Quando todas as tarefas ligadas a um requisito/achado/plano estiverem concluídas, avisar no sino o responsável para rever o item (sem mudar estado automaticamente — decisão humana).

5. **Evidência da tarefa reaproveitada**
   Anexos de tarefas ligadas a um requisito ou controlo podem ser enviados à Biblioteca de Evidências com um clique.

6. **Projeto no Dashboard e em Minhas Pendências**
   Cartão "Projetos em risco" (tarefas atrasadas por projeto) e tarefas atrasadas ligadas a riscos críticos destacadas.

## Detalhes técnicos
- Reutilizar `projeto_tarefa_vinculos` (sem nova tabela); hook novo `useTarefasDoRegisto(entidade, id)` em `useDetalheLigacoes`, sempre filtrado por `empresa_id`.
- Botão genérico a partir de `CriarTarefaMenuItem` com tipo de entidade.
- Geração de projeto via RPC transacional escopada pela empresa da sessão.
- Aviso de conclusão por trigger em `projeto_tarefas` usando `criar_notificacao`.
- Textos pt/en via t(); visual com `projeto-visual.tsx` e StatusPill.
- Ordem sugerida: 1 → 2 → 3 → 4 → 5 → 6.
