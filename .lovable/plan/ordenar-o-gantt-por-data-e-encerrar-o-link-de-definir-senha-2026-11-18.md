# Ordenar o Gantt por data e encerrar o link de definir senha após o uso

## 1. Gantt: ordenar por data
- No topo do Gantt, adicionar um seletor **"Ordenar: Estrutura do projeto | Data de início | Prazo"**.
- "Estrutura" mantém a ordem atual (fases > domínios > atividades).
- "Data de início"/"Prazo" mostram as tarefas em lista única, da mais cedo para a mais tarde; tarefas sem data ficam no fim. O nível (fase/domínio/atividade) continua indicado pela cor da linha.
- A escolha fica lembrada por projeto no navegador.

## 2. Link de definir senha continua "ativo"
**Causa (verificada no código):** a página não confere o link ao abrir; só testa quando a pessoa clica em salvar. Por isso, um link já usado continua mostrando o formulário como se fosse válido (a troca falha só no fim).

**Correção:**
- Ao abrir o link, o Akuris confere na hora, sem gastar o link, se ele ainda vale. Se já foi usado, foi substituído por um convite mais novo ou expirou, aparece direto a tela "Link expirado ou já utilizado", com o botão para pedir um novo.
- Após definir a senha, a página atual também passa a exibir sucesso e não volta ao formulário se for recarregada.
- O link continua sendo de uso único e a verificação não revela e-mail nem dados da conta.

## Detalhes técnicos
- Gantt: estado `ordenacao` em `GanttChart.tsx` (localStorage `gantt-ordem:<projetoId>`), achatando a árvore e ordenando por `data_inicio`/`data_fim` com nulos ao fim; i18n PT/EN.
- Link: função SQL `public.setup_link_status(_token_hash text)` SECURITY DEFINER, `search_path` fixo, somente leitura em `auth.users` (`recovery_token`/`confirmation_token` = hash e `recovery_sent_at` dentro da validade), retorna apenas `valid boolean`; GRANT EXECUTE para anon/authenticated. `DefinirSenha.tsx` chama no carregamento antes de mostrar o formulário (o token continua sendo consumido só no envio, por causa dos scanners de e-mail).
- Teste: ordenação por data (nulos no fim) e status do link (usado → inválido).
