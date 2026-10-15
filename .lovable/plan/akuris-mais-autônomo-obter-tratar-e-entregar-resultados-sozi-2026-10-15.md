# Akuris mais autônomo: obter, tratar e entregar resultados sozinho

Objetivo: o usuário deixa de alimentar o sistema à mão e passa a receber pronto o que precisa decidir.

## 1. Obtenção automática (dados entram sozinhos)
- **Integrações reais, começando por Microsoft 365/Entra/Intune e AWS.** Hoje AWS e Intune estão só simulados na Nexure. Com elas, ativos, usuários, contas privilegiadas e configurações entram por varredura agendada.
- **Coleta automática de evidências.** Cada varredura vira evidência ligada ao requisito (por exemplo, MFA ativo e criptografia de disco). O requisito passa a "atendido" ou "em falta" sem upload manual.
- **Leitura de documentos enviados.** Contratos, políticas e relatórios de pentest anexados geram registros sozinhos: datas de vencimento, fornecedor, achados e requisitos cobertos.
- **Caixa de entrada por e-mail.** Um endereço por empresa recebe incidentes, faturas e respostas de fornecedores e cria os registros.

## 2. Tratamento automático (o sistema analisa e propõe)
- **Riscos sugeridos a partir dos achados.** Um achado de integração, auditoria ou incidente sugere um risco já ligado ao ativo e ao controle, com nota inerente e residual.
- **Planos de ação gerados.** Cada lacuna do Gap Analysis ou controle reprovado vira uma proposta de plano com responsável, prazo e passos. O usuário só aprova.
- **Reavaliação contínua.** Controles, riscos e frameworks recalculam a nota quando entra uma evidência nova ou uma vence. Também avisam quando o residual fica desatualizado.
- **Orientações sempre prontas.** As orientações dos requisitos são preparadas em segundo plano, em ciclos agendados, sem depender de um clique do super admin.

## 3. Entrega automática (o resultado chega ao usuário)
- **Resumo semanal por e-mail e no sino.** O que mudou, o que vence nos próximos 30 dias, os 5 riscos que mais pioraram e as tarefas atrasadas por responsável.
- **Relatório executivo mensal em PDF,** pronto para a diretoria, com evolução da conformidade por framework.
- **Lembretes e escalonamento.** Uma tarefa vencida avisa o responsável. Se continuar parada, avisa o gestor.
- **Assistente "Pergunte ao Akuris".** O usuário pergunta, por exemplo "o que falta para a ISO 27001?", e recebe a resposta com links para os itens.

## Ordem sugerida
1. Orientações em segundo plano e resumo semanal: rápido, baixo risco e valor imediato.
2. Planos de ação e riscos sugeridos: transforma a análise em ação.
3. Leitura de documentos e caixa de entrada por e-mail.
4. Integrações reais (Microsoft e AWS): o maior ganho, mas exige configurar acessos de verdade.

## Detalhes técnicos
- Tarefas agendadas via `pg_cron` chamando Edge Functions, cada uma com lote limitado, trava no banco, marcação de progresso e pausa em 402/403/429.
- Tudo com escopo `empresa_id`. As notificações saem pelo sino. As sugestões da IA ficam como "proposta", e só passam a valer depois de aprovadas.
- A IA usada nas tarefas de plataforma (orientações) não desconta créditos da empresa. As análises por empresa seguem a regra atual de créditos.
- Cada item será detalhado num plano próprio antes de ser construído.
