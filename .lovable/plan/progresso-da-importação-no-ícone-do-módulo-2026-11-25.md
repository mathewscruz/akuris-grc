# Progresso da importação no ícone do módulo

## O que o usuário vai ver
- Ao clicar no ícone da ferramenta (Microsoft, Google) numa página de módulo, como Ativos, Revisão de acessos ou Documentos, o anel giratório para, o logo fica opaco e aparece por cima um contador, como **42%**.
- O número é real: itens já gravados no Akuris ÷ itens recebidos da ferramenta.
- Enquanto o Akuris ainda busca os dados na ferramenta e não sabe o total, o contador mostra **0%** com um leve pulso. Ele começa a subir quando o total fica conhecido.
- No fim, o contador some, o ícone volta ao estado "sincronizado" e a lista do módulo recarrega. Se der erro, o ícone volta ao normal com o aviso de erro de sempre.
- Ao sair e voltar à página no meio da importação, o contador continua de onde estava.
- A dica ao passar o mouse diz "Importando do Google Workspace… 42%".

## Detalhes técnicos
- **Migração:** `integration_runs` ganha `progress_total integer` e `progress_done integer` (nulos = total ainda desconhecido). A RLS de leitura por empresa já existente continua valendo, sem nova permissão.
- **Servidor** (`_shared/integration-runner.ts`): depois da coleta, grava `progress_total` = itens que vão ser gravados no módulo importado (dispositivos para Ativos; contas para Revisão de acessos; arquivos para Documentos). `syncIntuneAtivos` e `syncGoogleAtivos` atualizam `progress_done` a cada 10 itens e no fim; a importação de contas e de documentos marca `done = total` quando termina. As atualizações filtram por `id` e `empresa_id`.
- **`integration-connect` `import_module`:** já devolve `run_id`. O badge passa a usar esse id.
- **Frontend** (`ImportarIntegracaoBadge.tsx`): depois do clique, guarda o `run_id` e consulta `integration_runs` (`id`, `empresa_id`) a cada 2 s enquanto `status` for `queued`/`running`. Na carga da página, também procura a execução em andamento mais recente da conexão para retomar o contador. A % vem de `progress_done/progress_total`, sem estimativa. Ao terminar, invalida as consultas do badge e da lista.
- **CSS:** estado `is-importing` (logo com opacidade 0,35, anel parado, número centralizado em fonte tabular). Respeita a preferência de movimento reduzido.
- **i18n PT/EN:** `integracaoImport.importando`.
- **Testes:**
  - servidor: o progresso chega a `total` e nunca passa dele;
  - frontend: o contador mostra a % medida e some ao concluir.
- Deploy de `integration-connect` e `integration-worker`.
