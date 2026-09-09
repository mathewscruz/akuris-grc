# Integrações Akuris — implementação e ativação

Data: 08/09/2026. Estado: código implementado e testes locais; ainda não publicado. Aplicativos GitHub/Google e identidade técnica AWS cadastrados com autorização do titular; oito secrets desses fornecedores guardados no backend de produção. Não houve conexão com contas de clientes nem teste de coleta real. A preparação Microsoft e os requisitos de liberação externa permanecem pendentes.

## Decisão de publicação em 09/09/2026

O usuário solicitou publicar a versão mantendo **as oito novas integrações indisponíveis, com “Em breve” em cada cartão**. Essa decisão substitui a ativação operacional descrita adiante: o catálogo está liberado para apresentação, mas não para conexão/coleta.

- O frontend usa `src/lib/integration-release.ts` desativado. Renderiza somente catálogo pesquisável, marcas originais e botões desabilitados; não monta consultas de conexões, diálogos ou tratamento de callback, mesmo com parâmetros antigos na URL.
- O backend exige `INTEGRATION_COLLECTIONS_ENABLED=true` explicitamente. Ausência, `false` ou valores diferentes mantêm `integration-connect` (incluindo retorno OAuth), `integration-worker`, disponibilidade e processamento bloqueados antes de acesso ao banco/fornecedores. A resposta é HTTP 503, `integrations_coming_soon`, sem cache. Credenciais previamente guardadas não ativam a funcionalidade.
- Não aplicar as duas migrações novas nem configurar Vault/agendador nesta publicação. O catálogo não depende delas. Os conectores legados, API Keys e Webhooks de Entrada permanecem disponíveis; a correção do conector legado `azure-integration` pode ser publicada separadamente, sem ativar a plataforma nova.
- Liberação futura exige concluir pendências dos fornecedores, aplicar as migrações, validar ponta a ponta e ativar deliberadamente tanto frontend quanto backend. Não ativar apenas porque existem secrets.
- Conferência local de 09/09: 179 arquivos/1.000 testes frontend aprovados, 11 testes Deno aprovados, tipos/lint/build aprovados. Catálogo autenticado conferido dentro do Akuris com os oito estados “Em breve”; aba dos conectores legados continua acessível. Publicação e conferência do domínio serão registradas no relatório da versão.

## Experiência entregue

Configurações → Integrações → Coleta de evidências reúne Microsoft 365, Entra ID, Intune, AWS, GitHub, SharePoint, OneDrive e Google Drive. O catálogo usa ativos de marca originais; a origem está em `public/integrations/BRANDS.md`.

Fluxo: autorizar no fornecedor, descobrir recursos, escolher o escopo e coletar. Uma conexão autorizada não é apresentada como coleta concluída. As evidências selecionadas ficam na Biblioteca de Evidências, com histórico e download privado. Podem ser vinculadas aos requisitos sem alterar automaticamente sua conformidade.

Há paginação, estados de erro/coleta parcial, pausa, retomada, desconexão e indicação de coleta desatualizada. A desconexão interrompe coletas e remove credenciais do Akuris; revogar o consentimento no fornecedor é uma ação separada, informada na interface. O histórico é preservado.

| Conector | O que esta versão consulta | Limites de interpretação |
| --- | --- | --- |
| Microsoft 365 | Contas do Entra, papéis de diretório, registro de MFA e dispositivos Intune | Permissões/licenças podem impedir parte da coleta; não altera contas nem dispositivos |
| Entra ID | Usuários e papéis atribuídos, incluindo membros de grupos com papéis; registro de MFA | Não é inventário de elegibilidades PIM; MFA registrado não comprova imposição de MFA |
| Intune | Dispositivos, sistema operacional, versão e conformidade reportada | Conformidade não muda automaticamente estado operacional ou criticidade de um ativo |
| AWS | MFA da conta raiz, bloqueios públicos de buckets S3, registro de eventos do CloudTrail | CloudTrail na região escolhida; não lê objetos nem representa auditoria completa da nuvem |
| GitHub | Repositórios acessíveis e proteção da branch padrão dos selecionados | Não lê o conteúdo do código nem inventa resultado quando a branch está inacessível |
| SharePoint | Bibliotecas e metadados de documentos acessíveis | Sem cópia do conteúdo, sem alteração de permissões |
| OneDrive | Unidades e metadados de arquivos acessíveis à conta | Não enumera automaticamente todos os OneDrives da organização |
| Google Drive | Metadados, versão e link de arquivos acessíveis, inclusive drives compartilhados | Sem cópia do conteúdo; não cria aprovação de conformidade |

As contas selecionadas de Microsoft 365/Entra podem alimentar os usuários de um sistema já cadastrado, incluindo contas comuns e administrativas, para a Revisão de Acessos. O vínculo usa o seletor de sistemas, não UUID digitado. Quando a consulta de papéis não é conclusiva, a importação dessa conta é suspensa e a coleta informa a lacuna; não converte privilégio desconhecido em usuário comum. Contas ausentes não são removidas automaticamente. É necessário revisar a classificação de acesso importada antes de decisões de revogação.

## Preparação única da plataforma

"Plug and play" para o cliente depende de preparar os aplicativos da plataforma uma vez. Cada empresa depois autoriza sua própria conta. Nenhuma senha do fornecedor é solicitada pelo Akuris.

Callback comum a registrar exatamente nos aplicativos OAuth:

`https://<projeto-supabase>.supabase.co/functions/v1/integration-connect`

Para a produção atual do Akuris, a URL exata é:

`https://lnlkahtugwmkznasapfd.supabase.co/functions/v1/integration-connect`

### Cadastro nos fornecedores

Os registros centrais devem pertencer à Akuris/Nexure, não a um cliente. A autorização de acesso aos dados de cada cliente acontece separadamente, pelo administrador da empresa no fluxo de conexão.

1. **Microsoft — um registro para cinco conectores:** no diretório da plataforma, abrir Entra ID → App registrations → New registration. Registrar um aplicativo para múltiplos diretórios organizacionais, configurar o retorno acima como plataforma **Web**, adicionar somente as permissões delegadas listadas abaixo e criar a credencial do servidor com prazo e responsável pela rotação. Não habilitar fluxo público/implícito. Conferir a identidade do editor e as políticas de consentimento antes de oferecer aos clientes. [Registro de aplicativos Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
2. **Google Drive:** selecionar o projeto Google Cloud da plataforma, habilitar a Drive API, configurar marca/contato/domínios e público externo no Google Auth Platform; criar cliente OAuth de aplicação Web com o retorno acima. O escopo `drive.metadata.readonly` é **restrito**: a documentação exige verificação e, quando os dados são armazenados ou transmitidos por servidores, avaliação de segurança. O Akuris armazena metadados; portanto, concluir esse processo é um requisito de liberação externa, não apenas mudar o aplicativo de teste para produção. Não trocar silenciosamente por `drive.file`, pois isso altera as permissões e exige adaptar a seleção de arquivos. [Requisitos do Google Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
3. **GitHub:** na conta/organização proprietária, abrir Settings → Developer settings → GitHub Apps → New GitHub App. Configurar a página inicial `https://akuris.pt`, o retorno acima, Metadata/Contents somente leitura e instalação em outras contas. Manter expiração dos tokens de usuário; desativar webhooks porque esta implementação não os recebe. Não habilitar autorização automática durante instalação: o Akuris inicia a autorização com estado de segurança próprio depois da instalação. Guardar o Client ID, segredo e slug; não substituir por OAuth App clássico. [Cadastro de GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app).
4. **AWS:** na conta da plataforma, preparar uma identidade dedicada capaz apenas de assumir as funções de integração autorizadas. Cada cliente aprova o modelo `aws-read-only.json` em sua própria conta; a confiança deve exigir o principal correto e o External ID exclusivo gerado pelo Akuris. Na homologação, confirmar que assumir a função sem External ID ou com outro valor falha. Não usar conta raiz nem chaves permanentes de clientes. [Acesso entre contas AWS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html).

O administrador deve confirmar os registros, permissões, consentimentos e criação de credenciais nas contas corretas. Guardar os valores exclusivamente nos secrets do backend; não enviar senhas ou segredos em mensagens.

### Conferência de produção em 08/09/2026

- O proprietário indicado pelo usuário é `mathews@akuris.com.br`. O titular concluiu as etapas pessoais de criação/acesso das contas durante a configuração. Nenhum registro foi criado ou alterado no diretório do cliente `ORIGOENERGIA.onmicrosoft.com`.
- **Microsoft:** a conta pessoal está acessível, com o nome Akuris Client. O Entra/Azure retorna `AADSTS16000`: a identidade `live.com` não pertence ao diretório Microsoft Services. Esse diretório não pertence à Akuris e não deve receber convites ou alterações. É necessário disponibilizar um diretório empresarial da Akuris/Nexure e seu administrador; criar uma conta pessoal não conclui o registro do aplicativo multitenant. Nenhum aplicativo ou secret Microsoft foi criado.
- **Início do cadastro Microsoft:** o titular confirmou que não existe ambiente Microsoft empresarial da Akuris. Aberto o fluxo oficial de conta gratuita do Azure em `https://signup.azure.com/signup`, conectado com `mathews@akuris.com.br`. Na etapa 1 de 3, formulário em português, selecionado uso ligado a uma organização e preparado o nome Akuris. O campo de e-mail de notificações não reteve o preenchimento automatizado; deve ser preenchido pelo titular com o contato autorizado. O formulário trouxe automaticamente o nome pessoal “Akuris Client”; o titular deve substituí-lo pelos dados reais do responsável, conferir país/endereço de cobrança e preencher cargo/telefone. A inscrição não foi enviada nem concluída; não foi criado tenant, aplicativo, assinatura paga ou recurso Azure. Verificações pessoais e dados de pagamento ficam com o titular. A oferta informa proteção contra cobrança automática enquanto não houver mudança para pagamento conforme o uso; pode haver autorização temporária de cartão para verificação. [Criação de diretório Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-create-new-tenant), [oferta oficial Azure](https://azure.microsoft.com/en-us/free/).
- **GitHub:** criado o aplicativo público [Akuris Integrations](https://github.com/apps/akuris-integrations), proprietário `akuris-client`, App ID `4876945`, Client ID `Iv23li5dUXj2fi5XQIIa`. Callback exato acima; setup em `https://akuris.pt/configuracoes?tab=integracoes`; Contents/Metadata em leitura, sem permissões de organização/conta/enterprise, sem webhooks, Device Flow ou wildcard de retorno. A autorização durante a instalação ficou desligada; a expiração de tokens foi mantida. Logotipo `public/icons/akuris-512.png` enviado e conferido na página pública. Os três secrets GitHub foram salvos no Supabase às 19:55:48 UTC. O coletor não lê código, embora a permissão Contents tecnicamente permita leitura de conteúdo nos repositórios autorizados.
- **Pendências GitHub:** o fornecedor exibiu `Install is prohibited` para a conta `akuris-client`; o link público de instalação retornou 404. Não foi contornado esse bloqueio nem instalada a aplicação em outra conta. Foi gerada uma chave privada exigida pelo cadastro, mas o navegador bloqueou o download (`ERR_BLOCKED_BY_CLIENT`); não há confirmação de custódia do PEM. Fingerprint público da chave: `SHA256:zK5JloI7pJv/mS+mYYToHFHvGvBEoi3ISpa9ck36nK0=`. Antes da liberação, o titular deve gerar/guardar uma substituta em seu cofre e revogar essa chave sem custódia confirmada. A chave privada não é usada pelo coletor OAuth atual e não foi colocada no código ou no backend. Não gerar sucessivas chaves para tentar contornar o bloqueio de download.
- **Google:** criado o projeto `akuris-integrations` (Akuris Integrations) na organização `akuris.com.br`, com Drive API ativada. Criado o cliente Web `Akuris Integrations - servidor de producao`, ID `590441258150-t7n3ep36d1m4f9ar4r6srlgkrs5jgksb.apps.googleusercontent.com`, apenas com o callback do servidor, sem origens JavaScript adicionais. Os dois secrets Google foram guardados no Supabase às 20:12:01 UTC. Público externo em **testes**, apenas `mathews@akuris.com.br` na lista de teste e apenas `drive.metadata.readonly` nos escopos. Marca salva com logotipo Akuris, página inicial `https://akuris.pt`, política `https://akuris.pt/politica-privacidade` e domínios `akuris.pt`/`lnlkahtugwmkznasapfd.supabase.co`. O usuário autorizou explicitamente tornar seu e-mail o contato público de suporte. Não houve envio para verificação nem publicação do app Google.
- **Pendências Google:** concluir a verificação de marca/domínios e o processo exigido para escopo restrito, incluindo avaliação de segurança aplicável ao armazenamento de metadados. A inclusão de um domínio no formulário não comprova sua propriedade; validar especialmente o domínio de retorno Supabase com o Google e preparar domínio próprio se exigido. Revisar a divulgação de acesso, retenção, exclusão e uso limitado de dados Google na política e no produto antes de liberar a clientes. Não foi localizado um endereço público específico de Termos de Serviço e esse campo opcional não foi inventado. O console apresentou erros transitórios, mas a criação do cliente e os salvamentos de escopo, usuário de teste e marca foram confirmados.
- **AWS:** o titular concluiu o cadastro e abriu a conta Akuris Integrations `414096416368`. Criado `arn:aws:iam::414096416368:user/akuris-integration-collector`, sem senha/login no console, sem privilégios administrativos. A política em linha `AkurisAssumeCustomerReadOnlyRoles` permite somente `sts:AssumeRole` para `arn:aws:iam::*:role/AkurisReadOnly-????????`, exigindo HTTPS, nome de sessão `AkurisReadOnly` e External ID de 43 caracteres (formato gerado pelo Akuris). O wildcard de conta atende instalações de clientes distintos; a função em cada conta ainda precisa confiar explicitamente nesse principal e exigir o External ID exato daquela conexão. Não há concessão automática de acesso a clientes. Política validada pelo editor AWS sem erros/avisos; cópia reproduzível em `docs/integrations/aws-platform-assume-role-policy.json`. Os três secrets AWS foram guardados no Supabase às 20:18:40 UTC. Não foram criadas chaves da conta raiz nem recursos computacionais.
- **Pendências AWS:** o painel informou que a conta raiz ainda não tem MFA. O titular precisa cadastrar seu autenticador antes do uso em produção. Falta executar a instalação e coleta em uma conta de homologação, incluindo testes negativos de External ID. Não foi escolhido/contratado plano de cobrança pelo agente; as etapas de plano, pagamento e confirmação ficaram com o titular.
- A listagem inicial de secrets não continha as credenciais dos novos conectores. Nesta rodada foram adicionados somente os oito secrets GitHub/Google/AWS citados acima. `INTEGRATIONS_APP_URL`, `INTEGRATION_WORKER_TOKEN` e a configuração correspondente do agendador ainda não foram preparados; preservar a chave de criptografia existente. Verificações de armazenamento utilizaram nomes/digests, sem divulgar valores de credenciais.
- A simulação de publicação do banco identificou apenas as duas migrações `20260909100000` e `20260909101000` abaixo como pendentes. A simulação não aplicou migrações.
- A publicação do código, migrações, funções e ativação das integrações permanece pendente. Os secrets salvos em produção não significam que os conectores já estejam operacionais. Nenhum consentimento de acesso a dados de clientes, coleta real ou alteração de autenticação/MFA do Akuris foi realizado nesta conferência.

Configurar apenas como secrets das funções, nunca em variáveis `VITE_*`, arquivos públicos ou commits:

| Fornecedor | Secrets / configuração |
| --- | --- |
| Microsoft | `MICROSOFT_INTEGRATION_CLIENT_ID`, `MICROSOFT_INTEGRATION_CLIENT_SECRET`; aplicativo multitenant para contas organizacionais |
| Google | `GOOGLE_INTEGRATION_CLIENT_ID`, `GOOGLE_INTEGRATION_CLIENT_SECRET`; Drive API e tela de consentimento configuradas |
| GitHub | `GITHUB_INTEGRATION_CLIENT_ID`, `GITHUB_INTEGRATION_CLIENT_SECRET`, `GITHUB_INTEGRATION_APP_SLUG`; GitHub App instalável nas organizações |
| AWS | `AWS_INTEGRATION_ACCESS_KEY_ID`, `AWS_INTEGRATION_SECRET_ACCESS_KEY`, `AWS_INTEGRATION_PRINCIPAL_ARN`; principal dedicado com permissão de assumir somente as funções de integração previstas |
| Aplicação | `INTEGRATIONS_APP_URL` com a origem oficial do Akuris, sem parâmetros de redirecionamento fornecidos por usuários |
| Processamento | `INTEGRATION_WORKER_TOKEN`, aleatório com pelo menos 32 caracteres |

Permissões Microsoft delegadas: `User.Read`; para diretório, `User.Read.All`, `RoleManagement.Read.Directory`, `GroupMember.Read.All`, `AuditLog.Read.All`; para dispositivos, `DeviceManagementManagedDevices.Read.All`; SharePoint, `Sites.Read.All`; OneDrive, `Files.Read.All`. Cada conector solicita somente seu grupo de permissões, além de `offline_access`. Verificar consentimento administrativo, políticas do tenant e licenças para os relatórios. Explicação do fluxo: [documentação Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).

Google solicita `https://www.googleapis.com/auth/drive.metadata.readonly`, com acesso offline. Confirmar os requisitos de verificação do aplicativo antes de disponibilizá-lo externamente; não assumir que um aplicativo em modo de testes está pronto para clientes. [Escopos do Google Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

GitHub App: Metadata e Contents em leitura para consultar repositórios e detalhes de branches. O administrador instala o aplicativo e seleciona os repositórios; depois autoriza sua conta. Não é solicitado o escopo amplo `repo` de aplicativos OAuth clássicos. Validar a instalação e políticas da organização em uma conta de homologação. [Permissões de GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

AWS: publicar `public/integrations/aws-read-only.json` na origem configurada. O cliente informa a conta e abre o assistente CloudFormation; deve revisar/aprovar a função de leitura. A confiança contém o principal específico da plataforma e um External ID exclusivo por conexão. As permissões são IAM GetAccountSummary, S3 ListAllMyBuckets/GetBucketPublicAccessBlock e CloudTrail DescribeTrails/GetTrailStatus. O coletor assume a função com credenciais temporárias. O principal da plataforma continua exigindo rotação/proteção de suas próprias credenciais. [External ID na AWS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html).

## Banco, funções e agendamento

Aplicar, pela esteira normal e com backup, as migrações:

1. `20260909100000_integration_collection_platform.sql`.
2. `20260909101000_integration_collection_operations.sql`.

Dependências existentes: MFA vinculado à sessão, limitador `consume_security_rate_limit` da migração `20260904233000_pentest_owasp_acesso_e_segredos.sql`, criptografia de credenciais via Vault, Biblioteca de Evidências e seu bucket privado, `pg_cron` e `pg_net`. Preservar a chave existente `credenciais_integracao_key`: não regenerá-la se já houver credenciais cifradas. Publicar `integration-connect`, `integration-worker` e a correção do conector legado `azure-integration` antes de habilitar o frontend.

No Vault, configurar `integration_worker_url` como a URL HTTPS da função `integration-worker` e `integration_worker_token` com o mesmo valor do secret `INTEGRATION_WORKER_TOKEN`. O disparador roda a cada cinco minutos. As frequências diária/semanal só ficam disponíveis quando URL, token e tarefa ativa conferem; isso não substitui testar a execução real do agendador.

Sem agendador pronto, a coleta manual funciona; uma falha transitória termina com erro recuperável pelo usuário, sem deixar uma repetição presa na fila. Com agendador, há até quatro tentativas, espera progressiva e recuperação de concessões de execução expiradas. Execuções simultâneas da mesma conexão são impedidas no banco.

Credenciais ficam cifradas e inacessíveis ao navegador. Acesso e ações são restritos à empresa, ao administrador ativo e ao MFA da sessão atual. OAuth usa estado aleatório de uso único, prazo de dez minutos e PKCE. Resultados ausentes são desconhecidos, não aprovados. O arquivo de evidência só é publicado na biblioteca junto com a conclusão da tentativa válida; tentativas antigas não podem sobrescrevê-lo.

## Limites conhecidos e aceite antes de produção

- Coletas são limitadas por páginas, aproximadamente 80 segundos de chamadas e, nos conectores HTTP, 100 requisições/10.000 recursos. AWS tem limites próprios para buckets. Volumes além do limite retornam coleta parcial; esta versão não faz varredura ilimitada retomável.
- Descoberta guarda metadados acessíveis para permitir a escolha de recursos; apenas os selecionados compõem o pacote de evidências. Não são copiados conteúdos de documentos nem de repositórios.
- Downloads privados expiram em cinco minutos. JSON de tentativas interrompidas pode permanecer no armazenamento sem entrada na biblioteca; incluir esses objetos provisórios na política operacional de retenção, sem apagar evidências publicadas.
- Não houve teste ponta a ponta com tenants Microsoft/Google, instalação GitHub ou conta AWS reais nesta etapa. Executar autorização, descoberta, escopo, coleta, renovação, revogação e erro de permissão em contas de homologação antes do rollout.
- Validação visual autenticada concluída para o catálogo com as oito marcas, aviso de preparação do fornecedor e NIST CSF 2.0: abertura, 106 requisitos e detalhe de GV.OC-01. Nenhuma resposta de avaliação foi alterada. Os fluxos de autorização/coleta real continuam dependentes dos aplicativos de homologação.

## Correções complementares

- Frameworks sem assistente de escopo (incluindo NIST) deixaram de acessar `perguntas` de um objeto inexistente. Não foram alterados requisitos nem respostas dos clientes.
- O conector Azure legado passou a executar realmente a sincronização de usuários quando selecionada, verificar falhas de gravação e apresentar sua frequência manual real. A conformidade Intune não reclassifica criticidade nem estado operacional dos ativos.

## Validação reproduzível

`npm run typecheck`; `npm test`; `npm run build`; lint dos componentes novos.

Testes dos coletores: Deno com `--no-config --node-modules-dir=none --no-lock`, arquivo `supabase/functions/_shared/integration-collection.test.ts`. Não usar instalação automática de dependências Deno na pasta `node_modules` do frontend.

Banco local: `scripts/qa/integration-isolation.sql`, que cria dados de teste dentro de transação e executa rollback. Verifica criptografia, MFA, isolamento de empresas, idempotência, bloqueio de alterações durante execução, recuperação de concessão, publicação atômica de evidência e desconexão sem apagar histórico. Nunca executar esse ensaio como operação de produção.

Resultados desta rodada: 178 arquivos de teste / 997 testes frontend aprovados, dez testes Deno de coletores aprovados, verificação de tipos frontend/funções aprovada e build concluído. A primeira rodada concorrente teve timeout interno do executor; a repetição com `--maxWorkers=2` terminou sem erros. Permanecem os avisos já existentes de tamanho de alguns pacotes do build.

### Acesso de desenvolvimento, sem dispensar MFA

A credencial histórica foi encontrada e autenticou. O banco local ainda usava o modelo antigo de MFA; foi alinhado à migração existente `20260904183000_mfa_vinculado_a_sessao.sql`, invalidando uma confiança local antiga sem vínculo de sessão. Foi instalado localmente o trecho canônico do limitador de requisições que também faltava. Nenhum desses ajustes foi aplicado em produção nesta etapa.

Para validar a interface, o envio de e-mail foi direcionado ao Mailpit do Docker local. A emissão do código, hash, limite de tentativas e verificação da sessão mantiveram a implementação do Akuris. Não houve inserção manual de sessão confiável nem alteração de senha.

Os auxiliares são exclusivamente locais e ignorados pelo Git: `.tmp/vite-local-mfa.config.ts` e `supabase/functions/.tmp/local-preview/`. O primeiro desliga o atalho de preview para exigir o fluxo completo de MFA, sem mudar o código do produto. O segundo contém uma cópia do emissor com apenas o transporte de e-mail substituído pelo Mailpit. O projeto Supabase local aponta somente `send-mfa-code` para essa cópia. Não publicar esses auxiliares ou reutilizar seu arquivo de ambiente em produção. Regenerar a cópia a partir do emissor canônico ao modificar autenticação.

Para retomar esta sessão de desenvolvimento, o servidor local usa a configuração Vite acima e as funções são servidas pelo projeto `akuris-local` com `functions.env.local` desse diretório temporário. O MFA chega à caixa local em `http://127.0.0.1:54324`; a produção mantém seu provedor de e-mail original.
