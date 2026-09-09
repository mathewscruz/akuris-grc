export const integrationPlatform = {
  pt: {
    entidades: { sistema: "Sistema" },
    collectionHub: {
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
        authorized: "Autorizada · falta coletar",
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
      provider: {
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
        authorized: "Authorized · collection pending",
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
      provider: {
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
