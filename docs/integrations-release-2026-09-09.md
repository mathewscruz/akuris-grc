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

## Estado

Validação concluída; publicação em andamento. Registrar o resultado confirmado após o retorno do provedor e conferência do domínio.
