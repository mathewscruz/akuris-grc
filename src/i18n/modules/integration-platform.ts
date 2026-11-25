export const integrationPlatform = {
  pt: {
    entidades: { sistema: "Sistema" },
    collectionHub: {
      btnReview: "Revisar",
      cloudIdentity: {
        title: "Computadores (Cloud Identity) — opcional",
        help: "Para trazer computadores Windows/macOS/Linux, o Google exige uma conta de serviço com delegação em todo o domínio, só com o escopo cloud-identity.devices.readonly. A chave fica cifrada, ligada só a esta empresa e conexão, e nunca é mostrada.",
        file: "Arquivo JSON da conta de serviço",
        fileReady: "Arquivo carregado. O conteúdo não é exibido.",
        admin: "E-mail do administrador delegado",
        validate: "Validar e ativar",
        remove: "Remover credencial",
        account: "Conta de serviço",
        validated: "Validada em",
        active: "Ativa: computadores entram junto com celulares e ChromeOS.",
        activeShort: "Celulares, ChromeOS e computadores do Cloud Identity são coletados.",
        errorShort: "Celulares e ChromeOS são coletados. Computadores do Cloud Identity estão indisponíveis: reveja a credencial delegada.",
        saved: "Credencial validada e ativada",
        removed: "Credencial removida",
        err: {
          invalid_key_file: "O arquivo não é uma chave JSON válida de conta de serviço do Google.",
          invalid_admin: "Esse administrador não foi encontrado no Google Workspace conectado.",
          admin_required: "Esse usuário não é administrador ativo do Google Workspace.",
          organization_changed: "Esse administrador ou credencial pertence a outra organização Google.",
          delegation_missing: "Delegação não configurada: no Admin Console, autorize o Client ID da conta de serviço com o escopo cloud-identity.devices.readonly.",
          invalid_credential: "A chave foi recusada pelo Google (revogada ou incorreta). Gere uma nova chave e tente de novo.",
          license_or_permission: "O Google recusou a listagem de dispositivos: verifique a licença e o papel do administrador.",
          unexpected_scope: "O Google devolveu permissões além da leitura de dispositivos; a credencial foi recusada.",
          connection_not_authorized: "Conecte o Google Workspace antes de adicionar a credencial.",
          provider_unavailable: "O Google não respondeu. Tente de novo em alguns minutos.",
          generic: "Não foi possível validar a credencial. Tente de novo.",
        },
      },
      cardModules: "Módulos importados",
      cardLastRun: "Última coleta",
      cardNotConnected: "Não conectado",
      cardFailed: "Falhou",
      cardEdit: "Configurar",
      autoSyncOn: "Atualização automática ligada para esta conexão (só módulos importados). Ela só roda quando o agendador do Akuris estiver ativo.",
      autoSyncOff: "Atualização automática desligada para esta conexão. Para ligar, importe um módulo com o agendador ativo ou escolha diária/semanal.",
      schedulerInactive: "A atualização agendada ainda não está ativa: os dados das integrações só são atualizados quando você clica em Coletar agora.",
      btnFix: "Erro · Corrigir",
      conectadas: { titulo: "Conectadas", conectado: "Conectado", ultimoScan: "Último scan", recursos: "recursos encontrados", historico: "Últimos scans", nenhum: "Nenhum scan registrado", sucesso: "Concluído", falha: "Falhou" },
      tab: "Coleta de evidências",
      legacy: "Notificações e conectores existentes",
      title: "Suas ferramentas, conectadas à governança.",
      comingSoon: "Em breve",
      comingSoonIntro:
        "Estamos preparando estas integrações para conectar suas ferramentas às evidências do Akuris. Ainda não é possível autorizar conexões ou iniciar coletas. Os conectores existentes continuam disponíveis na outra aba.",
      intro:
        "Autorize a conexão, escolha os recursos e acompanhe as evidências. Sem alterar configurações nas ferramentas de origem.",
      search: "Buscar ferramenta ou conexão",
      catalog: "Adicionar conexão",
      connected: "Minhas conexões",
      attention: "Precisam de atenção",
      empty: "Nenhuma conexão nesta visão.",
      noMatch: "Nenhuma ferramenta encontrada.",
      connect: "Conectar",
      manage: "Gerenciar",
      setup: "Configuração da plataforma necessária",
      setupDetail:
        "O administrador do Akuris precisa registrar o aplicativo neste fornecedor uma única vez. Depois, cada empresa conecta sua própria conta com consentimento.",
      loadError:
        "Não foi possível consultar as conexões. Os conectores existentes continuam disponíveis na outra aba.",
      retry: "Tentar novamente",
      lastSuccess: "Última coleta completa",
      collectedAt: "Coletado em",
      never: "Ainda não coletado",
      newTitle: "Conectar ferramenta",
      name: "Nome desta conexão",
      nameHint: "Ex.: Microsoft 365 · Matriz",
      account: "ID da conta AWS (12 dígitos)",
      authorize: "Autorizar conexão",
      authorizedLink: "Continuar no fornecedor",
      connectedBack: "Conectado. Os módulos com dados disponíveis mostram o ícone para importar.",
      awsReturn:
        "Após criar a função de leitura na AWS, volte aqui e execute a descoberta para validar o acesso.",
      authReturn:
        "Você será direcionado ao fornecedor. A senha da sua conta não é compartilhada com o Akuris.",
      permissions: "O que será consultado",
      metadataOnly:
        "Documentos: coletamos metadados, versão atual e link de origem. Não copiamos o conteúdo dos arquivos nem concedemos acesso a eles.",
      caveat:
        "Sinais técnicos apoiam a avaliação; não comprovam conformidade por si só. MFA cadastrado não significa MFA obrigatório.",
      githubInstall:
        "Primeiro, instale o aplicativo Akuris na organização e escolha os repositórios permitidos. Depois volte a esta janela para autorizar sua conta.",
      install: "Instalar aplicativo no GitHub",
      region: "Região do CloudTrail",
      checksTitle: "Sinais técnicos",
      checkStatus: {
        pass: "Atendido",
        fail: "Não atendido",
        unknown: "Não verificado",
      },
      checks: {
        mfa_registered: "MFA cadastrado",
        device_compliant: "Conformidade reportada pelo Intune",
        branch_protected: "Branch padrão protegida",
        root_mfa: "MFA da conta raiz",
        public_access_blocked: "Quatro bloqueios públicos do bucket S3",
        logging_enabled: "Registro de eventos habilitado",
      },
      legacyManual:
        "Este conector utiliza sincronização manual. A coleta agendada com escopo e histórico estará disponível em breve.",
      legacySync: "{devices} dispositivos e {users} contas sincronizados.",
      steps: {
        authorize: "1. Autorizar",
        scope: "2. Escolher recursos",
        collect: "3. Coletar evidências",
      },
      scope: "Recursos acompanhados",
      scopeHelp:
        "A descoberta lista os recursos acessíveis. Só os selecionados entram nos próximos pacotes de evidências.",
      discover: "Descobrir recursos",
      collect: "Coletar agora",
      refresh: "Atualizar",
      save: "Salvar escopo",
      saved: "Configuração salva.",
      queued: "Coleta adicionada à fila.",
      selectPage: "Selecionar esta página",
      clearPage: "Limpar esta página",
      selected: "selecionados",
      scopeAll: "Todos os itens dos módulos importados",
      resources: "recursos",
      noResources:
        "Execute a descoberta para listar os recursos acessíveis à conta autorizada.",
      frequency: "Frequência",
      manual: "Manual",
      daily: "Diária",
      weekly: "Semanal",
      schedulerMissing:
        "A coleta agendada depende da ativação do processamento automático pelo administrador do Akuris. A coleta manual continua disponível.",
      system: "Importar contas para o sistema",
      systemHelp:
        "Opcional. As contas selecionadas alimentam os usuários e a revisão de acessos deste sistema. Permissões não identificadas exigem revisão; contas ausentes não são excluídas automaticamente.",
      history: "Histórico e evidências",
      historyEmpty: "Nenhuma coleta executada.",
      discoveryOnly: "Descoberta · sem pacote de evidências",
      evidence: "Baixar evidência",
      evidenceHelp:
        "Os pacotes ficam na Biblioteca de Evidências e podem ser vinculados aos requisitos do Gap Analysis. Nenhum status de conformidade é alterado automaticamente.",
      pause: "Pausar",
      resume: "Retomar",
      reconnect: "Autorizar novamente",
      addComputers: "Adicionar computadores (opcional)",
      disconnect: "Desconectar",
      disconnectTitle: "Desconectar esta ferramenta?",
      disconnectHelp:
        "O Akuris removerá as credenciais e interromperá as próximas coletas. As evidências anteriores serão preservadas. Para revogar o consentimento também no fornecedor, remova o aplicativo na conta de origem.",
      cancel: "Cancelar",
      close: "Fechar",
      previous: "Anterior",
      next: "Próxima",
      page: "Página",
      source: "Abrir origem",
      unknown: "Não informado",
      stale: "Coleta desatualizada",
      status: {
        pending: "Aguardando autorização",
        authorized: "Conectado",
        connected: "Coleta completa",
        partial: "Coleta parcial",
        error: "Precisa de atenção",
        paused: "Pausada",
        queued: "Na fila",
        running: "Coletando",
        success: "Concluída",
      },
      kind: {
        identity: "Conta",
        device: "Dispositivo",
        repository: "Repositório",
        document: "Documento",
        cloud: "Recurso de nuvem",
      },
      family: {
        identity: "Identidade",
        devices: "Dispositivos",
        cloud: "Nuvem",
        development: "Desenvolvimento",
        documents: "Documentos",
      },
      microsoft: {
        modulesTitle: "O que trazer da Microsoft",
        modulesHelp: "Ligue só o que a sua empresa quer usar no Akuris. O acesso é sempre só de leitura.",
        teams: "Avisos no Teams",
        purgeTitle: "Remover dados dos módulos desligados?",
        purgeHelp: "Os dados que vieram da Microsoft nesses módulos serão removidos. O que foi criado à mão fica.",
        purgeCounts: "{removidos} removido(s) · {arquivados} arquivado(s) por terem ligações",
        module: { intune: "Dispositivos do Intune", entra: "Usuários e grupos (Entra ID)", documentos: "Documentos (SharePoint)", usuarios: "Usuários, grupos e papéis", dispositivos: "Dispositivos (móveis, ChromeOS, computadores)", auditoria: "Auditoria de login", drive: "Metadados do Drive" },
        moduleDest: { intune: "Preenche a Gestão de Ativos", entra: "Alimenta a Revisão de acessos", documentos: "Vira evidência reutilizável", usuarios: "Alimenta a Revisão de acessos (MFA, suspenso, admins)", dispositivos: "Preenche a Gestão de Ativos", auditoria: "Último login e falhas nos últimos 30 dias (só logins explícitos/SAML)", drive: "Nome, link, datas e versão; o conteúdo não é lido" },
      },
      google: {
        modulesTitle: "O que trazer do Google Workspace",
      },
      provider: {
        google_workspace:
          "Um administrador do Google Workspace autoriza só leitura: usuários, MFA e papéis para revisão de acessos, dispositivos para Ativos, auditoria de login e metadados do Drive.",
        microsoft:
          "Um clique do administrador do seu tenant conecta tudo: dispositivos do Intune para Ativos, usuários do Entra ID para revisão de acessos e documentos do SharePoint como evidência.",
        microsoft365:
          "Visão conjunta de usuários, cadastro de MFA, atribuições de função e dispositivos gerenciados pelo Intune.",
        entra_id:
          "Usuários, cadastro de MFA e atribuições de função do diretório. Apoia a revisão de acessos.",
        intune:
          "Inventário de dispositivos, sistema operacional, responsável e estado de conformidade reportado pelo Intune.",
        aws: "MFA da conta raiz, bloqueios de acesso público dos buckets S3 e registro de eventos do CloudTrail na região configurada. Acesso entre contas somente de leitura.",
        github:
          "Repositórios acessíveis ao aplicativo e proteção da branch padrão nos repositórios escolhidos. Sem copiar código-fonte.",
        sharepoint:
          "Bibliotecas dos sites acessíveis à conta, metadados dos documentos, versão atual e link de origem.",
        onedrive:
          "Arquivos dos drives acessíveis à conta conectada, metadados, versão atual e link de origem.",
        google_drive:
          "Arquivos acessíveis à conta conectada, incluindo drives compartilhados, metadados, versão atual e link de origem.",
      },
      errors: {
        authorization_required:
          "Confirme sua sessão e o MFA antes de continuar.",
        authorization_expired:
          "A autorização expirou ou foi revogada. Autorize a conexão novamente.",
        platform_setup_required:
          "O aplicativo deste fornecedor ainda precisa ser configurado pelo administrador do Akuris.",
        scheduler_setup_required:
          "O processamento automático ainda não foi ativado. Escolha coleta manual.",
        permission_missing:
          "A conta não concedeu uma permissão necessária. Revise o consentimento com seu administrador.",
        consent_revoked: "O administrador do tenant retirou a autorização do Akuris. Conecte de novo.",
        incomplete_search: "O Google não conseguiu pesquisar todos os drives. A lista do Drive está incompleta.",
        members_partial: "Alguns grupos têm membros que não puderam ser listados; a lista fica em branco e o total vem do Google.",
        members_list_limit: "Grupos muito grandes: a lista guardada mostra só os primeiros 500 membros, mas o total está correto.",
        cloud_identity_pending: "Celulares e ChromeOS são coletados. Computadores do Cloud Identity estão indisponíveis: exigem uma credencial delegada que ainda não foi configurada.",
        scopes_missing: "Nem todas as permissões de leitura foram aceitas. Clique em Reautorizar e aceite todas.",
        organization_changed: "Essa conta é de outra organização Google. Reconecte com uma conta da mesma organização ou crie uma nova conexão.",
        system_required: "Escolha o sistema de destino nas configurações da conexão antes de importar os usuários.",
        consent_denied:
          "A autorização não foi concluída. Você pode tentar novamente.",
        mfa_permission_missing:
          "O fornecedor não permitiu consultar o cadastro de MFA. Este sinal permanece desconhecido.",
        roles_permission_missing:
          "Não foi possível consultar atribuições de função. Revise os privilégios antes de importar contas.",
        intune_permission_missing:
          "A consulta do Intune não foi autorizada. Usuários podem ter sido coletados, mas dispositivos não.",
        branch_unavailable:
          "A proteção de algumas branches não pôde ser consultada.",
        bucket_policy_unavailable:
          "Algumas configurações de buckets não puderam ser consultadas.",
        collection_limit:
          "Esta coleta atingiu o limite de processamento e está parcial. Revise o escopo ou divida a conexão.",
        scope_unavailable:
          "Alguns recursos selecionados não foram retornados. Verifique acesso e existência na origem.",
        lease_exhausted:
          "A coleta não terminou após as tentativas automáticas. Verifique a conexão e tente novamente.",
        provider_query_failed:
          "A ferramenta recusou a consulta de leitura. Confirme a delegação e o administrador informado e tente novamente.",
        rate_limited:
          "O limite temporário de consultas foi atingido. Aguarde antes de tentar novamente.",
        invalid_aws_account: "Informe os 12 dígitos do ID da conta AWS.",
        aws_assume_role_failed:
          "Não foi possível assumir a função de leitura na AWS. Verifique a criação da função e a confiança entre as contas.",
        aws_role_required: "Conclua a criação da função de leitura na AWS.",
        storage_write_failed:
          "Não foi possível salvar todos os dados. A coleta não foi marcada como concluída.",
        service_unavailable:
          "O serviço de integrações está indisponível ou ainda não foi publicado neste ambiente.",
        worker_not_ready:
          "O processamento de coletas ainda não foi ativado neste ambiente.",
        connection_busy:
          "Há uma coleta em andamento. Aguarde a conclusão antes de alterar o escopo ou desconectar.",
        collection_failed:
          "Não foi possível concluir a operação. Revise a conexão e tente novamente.",
      },
    },
  },
  en: {
    entidades: { sistema: "System" },
    collectionHub: {
      btnReview: "Review",
      cloudIdentity: {
        title: "Computers (Cloud Identity) — optional",
        help: "To bring Windows/macOS/Linux computers, Google requires a service account with domain-wide delegation, limited to cloud-identity.devices.readonly. The key is stored encrypted, tied only to this company and connection, and is never shown.",
        file: "Service account JSON file",
        fileReady: "File loaded. Its content is not displayed.",
        admin: "Delegated administrator e-mail",
        validate: "Validate and enable",
        remove: "Remove credential",
        account: "Service account",
        validated: "Validated on",
        active: "Active: computers are collected with mobile and ChromeOS devices.",
        activeShort: "Mobile, ChromeOS and Cloud Identity computers are collected.",
        errorShort: "Mobile and ChromeOS devices are collected. Cloud Identity computers are unavailable: review the delegated credential.",
        saved: "Credential validated and enabled",
        removed: "Credential removed",
        err: {
          invalid_key_file: "The file is not a valid Google service account JSON key.",
          invalid_admin: "That administrator was not found in the connected Google Workspace.",
          admin_required: "That user is not an active Google Workspace administrator.",
          organization_changed: "That administrator or credential belongs to another Google organisation.",
          delegation_missing: "Delegation not set up: in the Admin Console, authorise the service account Client ID with the cloud-identity.devices.readonly scope.",
          invalid_credential: "Google rejected the key (revoked or wrong). Create a new key and try again.",
          license_or_permission: "Google refused to list devices: check the licence and the administrator's role.",
          unexpected_scope: "Google returned permissions beyond reading devices; the credential was rejected.",
          connection_not_authorized: "Connect Google Workspace before adding the credential.",
          provider_unavailable: "Google did not respond. Try again in a few minutes.",
          generic: "Could not validate the credential. Try again.",
        },
      },
      cardModules: "Imported modules",
      cardLastRun: "Last collection",
      cardNotConnected: "Not connected",
      cardFailed: "Failed",
      cardEdit: "Configure",
      autoSyncOn: "Automatic refresh is on for this connection (imported modules only). It runs only while the Akuris scheduler is active.",
      autoSyncOff: "Automatic refresh is off for this connection. To turn it on, import a module while the scheduler is active or choose daily/weekly.",
      schedulerInactive: "Scheduled refresh is not active yet: integration data is refreshed only when you click Collect now.",
      btnFix: "Error · Fix",
      conectadas: { titulo: "Connected", conectado: "Connected", ultimoScan: "Last scan", recursos: "resources found", historico: "Recent scans", nenhum: "No scans recorded", sucesso: "Completed", falha: "Failed" },
      tab: "Evidence collection",
      legacy: "Notifications and existing connectors",
      title: "Your tools, connected to governance.",
      comingSoon: "Coming soon",
      comingSoonIntro:
        "We are preparing these integrations to connect your tools to Akuris evidence. Connections and collections are not available yet. Existing connectors remain available on the other tab.",
      intro:
        "Authorize a connection, choose resources and track evidence. Source tool settings stay unchanged.",
      search: "Search tools or connections",
      catalog: "Add connection",
      connected: "My connections",
      attention: "Need attention",
      empty: "No connections in this view.",
      noMatch: "No tools found.",
      connect: "Connect",
      manage: "Manage",
      setup: "Platform setup required",
      setupDetail:
        "An Akuris administrator must register the provider application once. Each company can then connect its own account through consent.",
      loadError:
        "Unable to load connections. Existing connectors remain available on the other tab.",
      retry: "Try again",
      lastSuccess: "Last complete collection",
      collectedAt: "Collected at",
      never: "Not collected yet",
      newTitle: "Connect tool",
      name: "Connection name",
      nameHint: "E.g. Microsoft 365 · Headquarters",
      account: "AWS account ID (12 digits)",
      authorize: "Authorize connection",
      authorizedLink: "Continue to provider",
      connectedBack: "Connected. Modules with data available show the icon to import.",
      awsReturn:
        "After creating the read-only role in AWS, return here and run discovery to validate access.",
      authReturn:
        "You will be redirected to the provider. Your account password is not shared with Akuris.",
      permissions: "What will be read",
      metadataOnly:
        "Documents: we collect metadata, the current version and the source link. We do not copy file contents or grant access to them.",
      caveat:
        "Technical signals support assessment; they do not prove compliance on their own. Registered MFA does not mean enforced MFA.",
      githubInstall:
        "First install the Akuris app in your organization and select permitted repositories. Then return to this window to authorize your account.",
      install: "Install app on GitHub",
      region: "CloudTrail region",
      checksTitle: "Technical signals",
      checkStatus: { pass: "Met", fail: "Not met", unknown: "Not verified" },
      checks: {
        mfa_registered: "MFA registered",
        device_compliant: "Intune-reported compliance",
        branch_protected: "Default branch protected",
        root_mfa: "Root account MFA",
        public_access_blocked: "Four S3 bucket public access blocks",
        logging_enabled: "Event logging enabled",
      },
      legacyManual:
        "This connector uses manual synchronization. Scheduled collection with scope and history is coming soon.",
      legacySync: "{devices} devices and {users} accounts synchronized.",
      steps: {
        authorize: "1. Authorize",
        scope: "2. Choose resources",
        collect: "3. Collect evidence",
      },
      scope: "Tracked resources",
      scopeHelp:
        "Discovery lists accessible resources. Only selected resources are included in subsequent evidence packages.",
      discover: "Discover resources",
      collect: "Collect now",
      refresh: "Refresh",
      save: "Save scope",
      saved: "Configuration saved.",
      queued: "Collection queued.",
      selectPage: "Select this page",
      clearPage: "Clear this page",
      selected: "selected",
      scopeAll: "All items of the imported modules",
      resources: "resources",
      noResources:
        "Run discovery to list resources accessible to the authorized account.",
      frequency: "Frequency",
      manual: "Manual",
      daily: "Daily",
      weekly: "Weekly",
      schedulerMissing:
        "Scheduled collection requires an Akuris administrator to activate automatic processing. Manual collection remains available.",
      system: "Import accounts into system",
      systemHelp:
        "Optional. Selected accounts feed this system’s users and access reviews. Unidentified privileges require review; missing accounts are not automatically deleted.",
      history: "History and evidence",
      historyEmpty: "No collections yet.",
      discoveryOnly: "Discovery · no evidence package",
      evidence: "Download evidence",
      evidenceHelp:
        "Packages are stored in the Evidence Library and can be linked to Gap Analysis requirements. No compliance status is automatically changed.",
      pause: "Pause",
      resume: "Resume",
      reconnect: "Authorize again",
      addComputers: "Add computers (optional)",
      disconnect: "Disconnect",
      disconnectTitle: "Disconnect this tool?",
      disconnectHelp:
        "Akuris will remove credentials and stop future collections. Existing evidence is preserved. To revoke provider consent as well, remove the application in your source account.",
      cancel: "Cancel",
      close: "Close",
      previous: "Previous",
      next: "Next",
      page: "Page",
      source: "Open source",
      unknown: "Not reported",
      stale: "Outdated collection",
      status: {
        pending: "Awaiting authorization",
        authorized: "Connected",
        connected: "Complete collection",
        partial: "Partial collection",
        error: "Needs attention",
        paused: "Paused",
        queued: "Queued",
        running: "Collecting",
        success: "Completed",
      },
      kind: {
        identity: "Account",
        device: "Device",
        repository: "Repository",
        document: "Document",
        cloud: "Cloud resource",
      },
      family: {
        identity: "Identity",
        devices: "Devices",
        cloud: "Cloud",
        development: "Development",
        documents: "Documents",
      },
      microsoft: {
        modulesTitle: "What to bring from Microsoft",
        purgeTitle: "Remove data from disabled modules?",
        purgeHelp: "Data that came from Microsoft in these modules will be removed. Anything created manually stays.",
        purgeCounts: "{removidos} removed · {arquivados} archived because they are linked",
        modulesHelp: "Turn on only what your company wants to use in Akuris. Access is always read-only.",
        teams: "Teams notifications",
        module: { intune: "Intune devices", entra: "Users and groups (Entra ID)", documentos: "Documents (SharePoint)", usuarios: "Users, groups and roles", dispositivos: "Devices (mobile, ChromeOS, computers)", auditoria: "Login audit", drive: "Drive metadata" },
        moduleDest: { intune: "Fills Asset Management", entra: "Feeds access reviews", documentos: "Becomes reusable evidence", usuarios: "Feeds access reviews (MFA, suspended, admins)", dispositivos: "Fills Asset Management", auditoria: "Last login and failures in the last 30 days (explicit/SAML logins only)", drive: "Name, link, dates and version; content is not read" },
      },
      google: {
        modulesTitle: "What to bring from Google Workspace",
      },
      provider: {
        google_workspace:
          "A Google Workspace admin grants read-only access: users, MFA and roles for access reviews, devices for Assets, login audit and Drive metadata.",
        microsoft:
          "One click from your tenant admin connects everything: Intune devices to Assets, Entra ID users to access reviews and SharePoint documents as evidence.",
        microsoft365:
          "Combined view of users, MFA registration, directory role assignments and Intune-managed devices.",
        entra_id:
          "Directory users, MFA registration and role assignments. Supports access reviews.",
        intune:
          "Device inventory, operating system, owner and the compliance state reported by Intune.",
        aws: "Root account MFA, S3 bucket public access blocks and CloudTrail event logging in the configured region. Read-only cross-account access.",
        github:
          "Repositories accessible to the app and default branch protection for selected repositories. No source code is copied.",
        sharepoint:
          "Libraries in accessible sites, document metadata, current version and source link.",
        onedrive:
          "Files in drives accessible to the connected account, metadata, current version and source link.",
        google_drive:
          "Files accessible to the connected account, including shared drives, metadata, current version and source link.",
      },
      errors: {
        authorization_required:
          "Confirm your session and MFA before continuing.",
        authorization_expired:
          "Authorization expired or was revoked. Authorize the connection again.",
        platform_setup_required:
          "An Akuris administrator must configure this provider application first.",
        scheduler_setup_required:
          "Automatic processing is not active yet. Choose manual collection.",
        permission_missing:
          "A required permission was not granted. Review consent with your administrator.",
        consent_revoked: "Your tenant admin removed Akuris authorization. Connect again.",
        incomplete_search: "Google could not search every drive. The Drive list is incomplete.",
        members_partial: "Some groups have members that could not be listed; the list stays empty and the total comes from Google.",
        members_list_limit: "Very large groups: the stored list shows only the first 500 members, but the total is correct.",
        cloud_identity_pending: "Mobile and ChromeOS devices are collected. Cloud Identity computers are unavailable: they need a delegated credential that has not been set up yet.",
        scopes_missing: "Not all read permissions were accepted. Click Reauthorize and accept them all.",
        organization_changed: "This account belongs to another Google organisation. Reconnect with an account from the same organisation or create a new connection.",
        system_required: "Choose the target system in the connection settings before importing users.",
        consent_denied: "Authorization was not completed. You can try again.",
        mfa_permission_missing:
          "The provider did not allow reading MFA registration. This signal remains unknown.",
        roles_permission_missing:
          "Role assignments could not be read. Review privileges before importing accounts.",
        intune_permission_missing:
          "Intune access was not authorized. Users may have been collected, but devices were not.",
        branch_unavailable:
          "Some branch protection settings could not be read.",
        bucket_policy_unavailable: "Some bucket settings could not be read.",
        collection_limit:
          "This collection reached the processing limit and is partial. Review the scope or split the connection.",
        scope_unavailable:
          "Some selected resources were not returned. Check access and existence at the source.",
        lease_exhausted:
          "Collection did not finish after automatic retries. Check the connection and try again.",
        provider_query_failed:
          "The tool rejected the read query. Check the delegation and the admin account, then try again.",
        rate_limited:
          "A temporary request limit was reached. Wait before retrying.",
        invalid_aws_account: "Enter the 12-digit AWS account ID.",
        aws_assume_role_failed:
          "Unable to assume the AWS read-only role. Check role creation and cross-account trust.",
        aws_role_required: "Finish creating the AWS read-only role.",
        storage_write_failed:
          "Not all data could be saved. The collection was not marked complete.",
        service_unavailable:
          "The integration service is unavailable or not deployed in this environment.",
        worker_not_ready:
          "Collection processing is not activated in this environment yet.",
        connection_busy:
          "A collection is in progress. Wait before changing scope or disconnecting.",
        collection_failed:
          "Unable to complete the operation. Review the connection and try again.",
      },
    },
  },
};
