# Integrações plug & play

## Como está hoje
Existem dois caminhos misturados na tela de Integrações:
- **Janelas antigas** (Azure/Intune, Google Workspace, Jira, ServiceNow, Slack, Teams, Webhooks): o cliente precisa criar um "app" no portal do fornecedor e colar Tenant ID, Client ID, Client Secret ou tokens. Difícil para quem não é técnico.
- **Coletas novas** (Microsoft 365, Entra ID, Intune, AWS, GitHub, SharePoint, OneDrive, Google Drive): já têm o fluxo "Entrar com a conta" (OAuth), mas estão desligadas por padrão e dependem de chaves do Akuris configuradas no servidor.

## Proposta: "Conectar" em 1 clique

### 1. Um app do Akuris por fornecedor (o cliente não cria nada)
O Akuris registra uma única vez seu próprio app na Microsoft, Google, GitHub, Atlassian e Slack. O cliente só clica em **Conectar com Microsoft**, faz login como administrador, aceita as permissões e volta para o Akuris já conectado.
- Microsoft (Entra ID, Intune, M365, SharePoint, OneDrive, Teams): consentimento de administrador, sem Tenant/Client/Secret.
- Google (Workspace, Drive): login Google com permissões de leitura.
- GitHub: instalar o "GitHub App do Akuris" escolhendo os repositórios.
- Jira: "Conectar com Atlassian" em vez de token de API.
- Slack: botão "Adicionar ao Slack" escolhendo o canal.

### 2. AWS sem chaves de acesso
Botão **Conectar AWS** abre o console da AWS com um modelo pronto (CloudFormation) que cria uma função só de leitura com um código exclusivo da empresa. Ao terminar, o Akuris detecta sozinho e confirma a conexão. Nada de copiar chaves.

### 3. Assistente único de 3 passos para todas
```text
[1 Escolher o que coletar] -> [2 Entrar com a conta] -> [3 Escolher escopo e frequência]
```
- Mesmo visual para todas as integrações (substitui as 7 janelas diferentes).
- Teste automático ao final: "Encontramos 214 usuários e 98 dispositivos".
- Estado claro no cartão: Conectado / Precisa reautorizar / Erro, com botão "Reconectar".
- Aviso no sino quando uma conexão expira ou falha.

### 4. Organização do catálogo
- Agrupar por categoria: Identidade, Dispositivos, Nuvem, Código, Documentos, Comunicação, Chamados.
- Mostrar só o que está pronto; o resto aparece como "Em breve" (sem botão que não funciona).
- Campos manuais (Tenant ID etc.) ficam escondidos em "Configuração avançada", para clientes que exigem app próprio.
- ServiceNow e Webhooks seguem com formulário simplificado (não oferecem login em 1 clique), com guia passo a passo.

## O que precisa de você
- Criar (uma vez) os apps do Akuris na Microsoft, Google, GitHub, Atlassian e Slack e informar as chaves; eu preparo o guia exato de cada um.
- Uma conta AWS do Akuris para hospedar o modelo de conexão.
- Depois disso, liberar as coletas novas para os clientes.

## Ordem sugerida
1. Microsoft (cobre Entra, Intune, M365, Teams) e AWS - maior valor para GRC.
2. Google e GitHub.
3. Jira e Slack.
4. Remover as janelas antigas depois que todos migrarem.

## Detalhes técnicos
- Reaproveitar `integration-connect` + `_shared/integration-oauth.ts` (state de uso único já existe) e `integration_connections`; estender `PROVIDERS` com `jira`, `slack`, `google_workspace`, `teams`.
- Microsoft: endpoint `/organizations/v2.0/adminconsent`, multi-tenant, tokens por tenant cifrados; Graph scopes só leitura.
- AWS: quick-create CloudFormation URL com `ExternalId` = hash por empresa; verificação via `sts:AssumeRole`.
- Novo `IntegrationConnectWizard` substitui os `*ConfigDialog`; os antigos viram aba "Avançado".
- Secrets: `*_INTEGRATION_CLIENT_ID/SECRET`, `GITHUB_INTEGRATION_APP_SLUG`, `INTEGRATION_WORKER_TOKEN`, `INTEGRATION_COLLECTIONS_ENABLED=true`.
- Tudo filtrado por `empresa_id`, só admin com MFA conecta; notificações via `notifications`.
