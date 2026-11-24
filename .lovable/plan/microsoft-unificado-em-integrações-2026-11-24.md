# Microsoft unificado em Integrações

## Situação hoje
Hoje a Microsoft aparece em pedaços, em dois lugares:
- No catálogo: "Microsoft Teams" (avisos por webhook) e "Azure" (o cliente cola Tenant ID, Client ID e segredo à mão para puxar dispositivos do Intune e usuários).
- Na coleta de evidências: Microsoft 365, Entra ID, Intune, SharePoint e OneDrive, cada um como cartão separado, com login próprio.

## O que muda para o usuário
Um único cartão **Microsoft 365** em Integrações, com um botão **Conectar com Microsoft**.

```text
[Conectar com Microsoft]
   -> tela oficial da Microsoft: o administrador do tenant entra e clica "Aceitar"
   -> volta ao Akuris já conectado
   -> escolhe o que usar (ligar/desligar):
        [x] Dispositivos do Intune  -> Gestão de Ativos
        [x] Usuários e grupos (Entra ID) -> Revisão de acessos
        [ ] Documentos (SharePoint / OneDrive) -> Evidências
        [ ] Avisos no Teams
   -> frequência: manual / diária / semanal
```

Sem copiar Tenant ID, sem criar "app registration", sem segredo para colar. É o jeito mais fácil: um clique de um administrador da empresa cliente ("consentimento do administrador"). O cliente pode revogar a qualquer momento no portal dele.

## Por que esse caminho
- O Akuris tem um único aplicativo registrado na Microsoft, válido para qualquer empresa (multi-tenant). Cada cliente só autoriza esse aplicativo no tenant dele.
- A leitura é feita pelo servidor do Akuris, só leitura, sem depender de um usuário logado; a conexão não cai quando alguém sai da empresa.
- Cada conexão fica presa à empresa no Akuris (isolamento por empresa), como os demais dados.

## Intune -> Gestão de Ativos
- Sincroniza dispositivos gerenciados: nome, sistema, versão, fabricante/modelo, número de série, usuário principal, conformidade, criptografia, última sincronização.
- Cria ou atualiza o ativo pela chave (empresa + id do dispositivo no Intune), sem duplicar ativos vindos do agente MeshCentral (casa pelo número de série quando existir).
- Dispositivo removido do Intune fica marcado como "não visto", não é apagado.
- Resultado e erros vão para o sino.

## Etapas
1. Akuris (você) registra uma vez o aplicativo multi-tenant no Entra ID da Akuris, com permissões só de leitura: DeviceManagementManagedDevices.Read.All, User.Read.All, GroupMember.Read.All, RoleManagement.Read.Directory, AuditLog.Read.All, Organization.Read.All (e Sites.Read.All só se ligar documentos). Guia passo a passo entregue junto.
2. Cartão único "Microsoft 365" no catálogo, substituindo Teams, Azure e os 5 cartões da coleta.
3. Fluxo de consentimento do administrador e tela de escolha dos dados.
4. Sincronização do Intune para Ativos (manual + agendada), com aviso no sino.
5. Migração: conexões Azure antigas (tenant/segredo manuais) continuam funcionando, marcadas como "modo antigo" com convite para reconectar; o webhook do Teams vira uma opção dentro do cartão.

## Detalhes técnicos
- Reaproveitar `integration-connect`/`integration-worker`, trocando o fluxo delegado por provedor (`/organizations/oauth2/v2.0/authorize`) por um provedor `microsoft` único usando `https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=...&redirect_uri=...&state=...`; o callback recebe `tenant` e `admin_consent=True`, valida o `state` (`integration_oauth_states`) e grava o tenant na conexão da empresa.
- Tokens app-only por client credentials (`/{tenant}/oauth2/v2.0/token`, scope `https://graph.microsoft.com/.default`), obtidos a cada execução; nenhum segredo do cliente é armazenado.
- Segredos da plataforma já previstos: `MICROSOFT_INTEGRATION_CLIENT_ID`/`_SECRET`; liberação continua pelo `INTEGRATION_COLLECTIONS_ENABLED`.
- `COLLECTION_PROVIDERS`: substituir microsoft365/entra_id/intune/sharepoint/onedrive por `microsoft` com `scope_ids` (intune, entra, documentos, teams). `IntegrationHub`: remover cartões `teams` e `azure`; `AzureConfigDialog` fica só para conexões legadas.
- Intune: `GET /v1.0/deviceManagement/managedDevices` com paginação (`@odata.nextLink`), mapeamento puro em `regras.ts` com testes; upsert em `ativos` por `(empresa_id, intune_device_id)`.
- Status no catálogo e em "Conectados" seguem `useConexoesAtivas` (mesma consulta).
- Textos PT/EN via t().

## Pendente de você
- A Akuris usa Google Workspace, e isso não muda nada: o e-mail continua no Google. Basta criar um tenant Entra ID gratuito só para registrar o aplicativo:
  1. Em azure.microsoft.com/free (ou entra.microsoft.com), criar a conta com um e-mail da Akuris (ex.: integracoes@akuris.com.br); isso cria um tenant tipo akuris.onmicrosoft.com, sem custo e sem licença Microsoft 365.
  2. Opcional: verificar o domínio akuris.com.br nesse tenant (registro TXT no DNS) — necessário para o "editor verificado".
  3. Entra ID > Registros de aplicativo > Novo: tipo de conta "Contas em qualquer diretório organizacional (multilocatário)"; URL de redirecionamento (Web) = https://lnlkahtugwmkznasapfd.supabase.co/functions/v1/integration-connect.
  4. Permissões de API > Microsoft Graph > Permissões de aplicativo (Application, só leitura): DeviceManagementManagedDevices.Read.All, User.Read.All, GroupMember.Read.All, RoleManagement.Read.Directory, AuditLog.Read.All, Organization.Read.All; Sites.Read.All só com documentos. Nenhuma delegada. Conceder consentimento do administrador.
  5. Certificados e segredos > novo segredo; Client ID e segredo vão para os Segredos das funções do projeto Supabase lnlkahtugwmkznasapfd como MICROSOFT_INTEGRATION_CLIENT_ID e MICROSOFT_INTEGRATION_CLIENT_SECRET (formulário seguro na construção).
- A Microsoft pode pedir "editor verificado" (Publisher verification) para clientes aceitarem sem alerta; recomendado, mas não bloqueia.
