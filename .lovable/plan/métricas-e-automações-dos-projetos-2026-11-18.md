# Métricas e Automações dos projetos

## Automações: defeitos que impedem funcionar
Verificado no código e no banco:
- **"Notificar usuário" não chega a ninguém**: o aviso é gravado num lugar que não existe; o sino nunca recebe. Passa a cair no sino (e respeita a preferência de e-mail do utilizador).
- **"Mudar prioridade" não faz nada**: o painel grava um nome de ação e o executor espera outro. Os dois passam a usar o mesmo.
- O formulário aceita salvar ações incompletas (mover sem coluna, notificar sem pessoa) e nome vazio sem aviso. Passa a destacar o campo e bloquear o salvar.

## Automações: funcionalidades
- **Gatilho "Prazo vencido"**: a rotina diária que já avisa prazos passa a disparar as automações deste gatilho (uma vez por atividade).
- **Condições simples**: "só se prioridade for X" e "só se responsável for Y", além da coluna.
- **Mensagem personalizada** no "Notificar usuário" (com o nome da atividade).
- **Histórico**: últimas 10 execuções por automação (quando, atividade, resultado), num painel expansível no cartão.
- **Testar agora**: escolher uma atividade e ver o que a regra faria, sem aplicar.
- Cartão mostra a regra em frase legível: "Quando uma atividade for concluída → notificar Ana".

## Métricas: correções
- Contagens por prioridade e por coluna contam só atividades (sem as fases/agrupadores), igual aos restantes indicadores.
- Velocidade semanal diz "8 semanas" (é o que mostra) e marca a média.
- "Eficiência" passa a "Gasto vs estimado" com barra, e só aparece quando há estimativas.

## Métricas: novos indicadores
- **Burnup do projeto**: atividades concluídas acumuladas vs total ao longo do tempo, com linha do planejado.
- **Previsão de término**: com base na velocidade das últimas 4 semanas, data provável de conclusão vs data prevista do projeto.
- **Atrasadas por responsável**: na carga por pessoa, mostrar quantas estão atrasadas em vermelho; clicar abre a lista filtrada.
- **Tempo médio de conclusão** por prioridade.
- Filtro de período (30/90 dias/tudo) no topo do painel.

## Detalhes técnicos
- Executor: `notificacoes` → `notifications` (title/message/link_to/metadata), aceitar `mudar_prioridade` como alias de `definir_prioridade`, condições `prioridade`/`responsavel_id`, `{titulo}` na mensagem; registar cada execução em nova tabela `projeto_automacao_execucoes` (empresa_id, automacao_id, tarefa_id, resultado, erro) com RLS por empresa e grants.
- `send-projeto-tarefa-notification` (tipo prazo): chamar automações `prazo_excedido` para tarefas vencidas ainda não disparadas (coluna `automacao_prazo_disparada_em`).
- "Testar agora": modo `dry_run` no executor, devolve as ações previstas sem gravar.
- Métricas: cálculos novos em `lib/projeto-acompanhamento.ts` com testes (previsão, burnup, atrasadas por pessoa); gráficos com `AkurisCharts` e `chart-tokens`.
