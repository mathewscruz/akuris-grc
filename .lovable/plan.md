# E-mails das atividades de projeto para o responsável

## Como está hoje (verificado)
- Ao atribuir uma atividade, o responsável recebe apenas um aviso no sino; **nenhum e-mail é enviado**.
- Mudança de status (coluna) não gera aviso nem e-mail.
- Prazo próximo não gera aviso nem e-mail: a rotina de prazos das tarefas existe, mas não está agendada para rodar, e não envia e-mails.

## O que vai passar a acontecer
O "dono" da atividade é o **responsável** atribuído. Ele recebe e-mail (e o aviso correspondente no sino) quando:
1. **For atribuído** a uma atividade (nova ou reatribuída) — exceto se ele mesmo se atribuiu.
2. **O status mudar** (ex.: "Em andamento" → "Concluído") — exceto se foi ele mesmo que mudou. O e-mail mostra status anterior e novo e quem alterou.
3. **O prazo estiver próximo**: 3 dias antes e no dia do vencimento, uma vez cada (sem repetir). Atividades concluídas não recebem lembrete.

Cada e-mail segue o visual dos demais e-mails do Akuris, no idioma do usuário (pt/en), com projeto, atividade, prazo e botão "Abrir atividade" que leva direto à tarefa. Respeita o descadastro de e-mails já existente.

## Regras
- Só usuários da mesma empresa do projeto; nunca e-mail para outra empresa.
- Responsável sem e-mail ou desativado: não envia, sem erro para quem fez a ação.
- Agrupamento de fase/domínio (itens-pai) não recebe lembrete de prazo, só as atividades.

## Detalhes técnicos
- Nova Edge Function `send-projeto-tarefa-notification` (Resend, `RESEND_API_KEY` já usada pelas outras), com modos `atribuicao`, `status` e `prazo`; valida empresa do projeto x perfil do destinatário e registra também em `notifications`.
- Gatilho no banco (`AFTER UPDATE OF responsavel_id, coluna_id` / `INSERT`) chama a função via `pg_net`, substituindo o aviso só-sino atual para evitar duplicação.
- Lembretes de prazo: rotina diária (1x/dia, 08:00 de Brasília) que seleciona atividades não concluídas com fim em 3 dias ou hoje; colunas `lembrete_3d_enviado_em` e `lembrete_dia_enviado_em` em `projeto_tarefas` evitam repetição e são zeradas se o prazo mudar.
- Testes: função pura que decide destinatário/se envia (auto-ação, concluída, janela de 3 dias), e verificação ponta a ponta disparando cada evento numa tarefa de teste e conferindo log de envio e aviso no sino.
