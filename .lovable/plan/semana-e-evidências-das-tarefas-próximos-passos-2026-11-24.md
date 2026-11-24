# Semana e evidências das tarefas: próximos passos

O que o cliente pediu já existe: o Gantt semanal mostra mês/semana, a semana atual e o filtro "Esta semana", e cada tarefa tem a aba Evidências (arquivo de até 20 MB ou link), com a opção "Exigir evidência para concluir". Este plano vai além: ligar essas evidências e a visão semanal ao resto do Akuris.

## 1. Evidência da tarefa vale também no Gap Analysis e nos Controles
- Quando a tarefa está ligada a um requisito ou controle (Ligações GRC), ao anexar a evidência aparece a opção "Usar também como evidência do requisito/controle".
- A ficha do requisito mostra "Evidências vindas de projetos", com link para a tarefa de origem.
- Assim, quem implementa a ISO 27001 pelo projeto não precisa enviar o mesmo arquivo duas vezes.

## 2. Escolher um documento que já existe no Akuris
- Na aba Evidências, um terceiro botão, "Do Akuris", ao lado de Arquivo e Link, deixa escolher um documento do módulo Documentos (por exemplo, uma política aprovada).
- O documento entra como evidência por referência, sem cópia, e o vínculo continua ativo quando ele for atualizado.

## 3. Minha semana
- Na página "Minhas tarefas", uma visão "Semana" mostra 7 colunas (seg–dom) com as tarefas de todos os projetos que vencem ou estão em andamento em cada dia.
- O topo mostra o resumo da semana: a concluir, atrasadas e sem evidência.
- Dá para arrastar uma tarefa para outro dia e mudar o prazo, com opção de desfazer.

## 4. Resumo semanal por e-mail e no sino
- Toda segunda de manhã, cada responsável recebe as tarefas da semana e as concluídas que ainda estão sem evidência.
- O aviso aparece no sino e chega por e-mail, pelo mesmo caminho dos avisos de tarefa que já existem.
- Cada pessoa pode desligar o resumo.

## 5. Pacote de evidências do projeto
- Um botão no projeto gera um PDF com a lista de tarefas concluídas, as evidências (nome, autor, data, link) e o requisito ligado a cada uma.
- Serve para entregar ao auditor.

## Detalhes técnicos
- 1: tabela de ligação `projeto_tarefa_anexo_evidencias` (anexo_id, requisito/controle, empresa_id), com RLS por empresa. Reaproveita a URL assinada do bucket projeto-anexos. O RequirementDrawer (página) ganha a secção correspondente.
- 2: coluna `documento_id uuid` em projeto_tarefa_anexos, mais `tipo_origem='documento'`. O gatilho de "exigir evidência" passa a aceitar essa origem.
- 3: componente novo em MinhasTarefas, usando useAtualizarTarefas (otimista + undo) e lib/projeto-cronograma.ts para a regra de datas.
- 4: novo modo semanal em send-projeto-tarefa-notification (cron de segunda), mais uma preferência do usuário. Textos em pt-BR, pt-PT e en.
- 5: PDF gerado no navegador com pdf-utils, que já é o único gerador de PDF.
- Todas as consultas filtram por empresa_id.
