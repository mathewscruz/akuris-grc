# Publicação — integrações em breve

## Escopo autorizado

Publicar a versão preparada do Akuris com as novas integrações temporariamente indisponíveis. Microsoft 365, Entra ID, Intune, AWS, GitHub, SharePoint, OneDrive e Google Drive exibem seus logotipos e “Em breve”. Não solicitar consentimento nem iniciar coletas. Preservar os conectores existentes.

Inclui as correções já preparadas de abertura do assistente de frameworks sem perguntas de escopo (como NIST), ligação profunda a sistemas e sincronização manual do conector Azure legado.

## Validação antes de publicar

- 1.000 testes frontend em 179 arquivos aprovados, incluindo catálogo sem chamadas remotas, botões desabilitados, busca e português/inglês.
- 11 testes Deno aprovados, incluindo bloqueio por padrão mesmo com credenciais e ausência de acesso ao banco pelo processador desativado.
- Tipos frontend e três funções, lint dos arquivos de catálogo e build de produção aprovados.
- Visual autenticado local: oito cartões legíveis com marca original; conectores existentes acessíveis na aba própria.
- Git remoto conferido sem divergência antes da preparação. Nenhum auxiliar de autenticação local integra a publicação.
- Dry-run do banco: apenas `20260909100000` e `20260909101000` pendentes. **Não aplicar nesta versão.** Nenhum dado de cliente precisa ser migrado para exibir “Em breve”.

## Plano operacional e retorno

1. Fixar `INTEGRATION_COLLECTIONS_ENABLED=false` no backend da produção.
2. Publicar `integration-connect` e `integration-worker` com o bloqueio, além da correção de `azure-integration` legado.
3. Sincronizar o código validado e publicar o frontend no projeto Lovable existente.
4. Conferir domínio, arquivos publicados e respostas indisponíveis dos endpoints novos.

Não criar/configurar agendador nem executar coletas de homologação ou clientes nesta versão. Não modificar os registros nos fornecedores. A versão anterior do frontend é `877b9a426b16c8df5e4881f26dcfa0e7633fb236`; eventual retorno deve preservar o bloqueio das integrações novas no backend. A implementação e os requisitos de ativação futura estão documentados em `integrations-2026-09-08.md`.

## Resultado confirmado da publicação

- Frontend publicado no projeto Lovable existente, código `bcfd37d3a935fe2ffd09279f865cfd63001e8059`; publicação `428ff25f-2560-4981-b455-305f2771e24f`. Domínio `https://akuris.pt` entrega o catálogo novo. Conferência autenticada em `/configuracoes?tab=integracoes`: oito marcas, oito botões “Em breve” desabilitados e aviso de indisponibilidade.
- As funções novas e a correção de `azure-integration` foram publicadas. `INTEGRATION_COLLECTIONS_ENABLED=false` foi gravado antes da publicação. Testes HTTP em produção confirmaram 503/`integrations_coming_soon` para os oito fornecedores, callback OAuth e worker, sem executar coletas.
- **O publicador aplicou automaticamente as migrações `20260909100000` e `20260909101000`**, apesar do plano de mantê-las pendentes. A consulta de produção confirmou zero conexões, zero execuções e ausência dos dois secrets de agendamento no Vault. A tarefa criada, `integration-collections` (job 10), ainda estava ativa, mas o dispatch não tinha destino/token configurados e o worker já estava bloqueado.
- A migração complementar `20260909102000` mantém somente essa tarefa inativa, preservando sua definição e os outros agendamentos. Validada no banco local; dry-run de produção confirmou apenas essa migração pendente. Uma tentativa de conexão do dry-run teve timeout transitório no pooler; a repetição concluiu normalmente.
- As credenciais e aplicativos preparados nos fornecedores foram preservados. Nenhuma liberação externa, autorização de cliente ou coleta foi executada. Ativar futuramente requer todos os critérios de aceite do documento de implementação, liberação frontend/backend e retomada deliberada do job.
