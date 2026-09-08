import {
  type EmailLocale,
  type EmailTone,
  notificationEmail,
} from "./email-brand.ts";

type Data = Record<string, string | number | null | undefined>;
export type OperationalEmailKind =
  | "audit"
  | "control"
  | "controlMention"
  | "risk"
  | "acceptance"
  | "review"
  | "approval"
  | "incident"
  | "contract"
  | "key"
  | "license"
  | "report"
  | "dueDiligence";

/** Presentation only: recipients, preferences, authentication and delivery stay in the caller. */
export function operationalEmail(
  kind: OperationalEmailKind,
  data: Data,
  locale: EmailLocale = "pt",
): string {
  const text = (pt: string, en: string) => locale === "en" ? en : pt;
  const value = (key: string) => String(data[key] ?? "");
  const field = (
    pt: string,
    en: string,
    key: string,
  ): readonly [string, unknown] => [text(pt, en), data[key]];
  const base = {
    name: value("name"),
    item: value("item"),
    code: value("code"),
    description: value("description"),
    locale,
  };
  const action = (pt: string, en: string) => ({
    label: text(pt, en),
    url: value("url"),
  });
  const tone = (value("tone") || "neutral") as EmailTone;
  switch (kind) {
    case "audit":
      return notificationEmail({
        ...base,
        title: text(
          "Um item de auditoria está com você",
          "An audit item is assigned to you",
        ),
        module: text("Auditorias", "Audits"),
        intro: text(
          "Você é responsável por verificar o item abaixo e reunir as evidências da avaliação.",
          "You are responsible for reviewing the item below and gathering supporting evidence.",
        ),
        fields: [
          field("Auditoria", "Audit", "audit"),
          field("Prazo de entrega", "Due date", "deadline"),
        ],
        next: text(
          "Confira os critérios do item, registre sua avaliação e anexe as evidências no Akuris.",
          "Review the item criteria, record your assessment and attach evidence in Akuris.",
        ),
        action: action("Abrir item de auditoria", "Open audit item"),
      });
    case "control":
      return notificationEmail({
        ...base,
        title: text(
          "Você é responsável por este controle",
          "This control is assigned to you",
        ),
        module: text("Controles internos", "Internal controls"),
        intro: text(
          "Um controle interno foi atribuído a você.",
          "An internal control has been assigned to you.",
        ),
        fields: [field("Próxima avaliação", "Next assessment", "deadline")],
        next: text(
          "Revise o controle e mantenha a avaliação e as evidências atualizadas.",
          "Review the control and keep its assessment and evidence up to date.",
        ),
        action: action("Acessar controle", "Open control"),
      });
    case "controlMention":
      return notificationEmail({
        ...base,
        title: text(
          "Você foi mencionado em um controle",
          "You were mentioned in a control",
        ),
        module: text("Controles internos", "Internal controls"),
        intro: text(
          `${value("author")} mencionou você em um comentário.`,
          `${value("author")} mentioned you in a comment.`,
        ),
        next: text(
          "Abra o controle para ler o contexto completo e responder ao comentário.",
          "Open the control to read the full context and reply to the comment.",
        ),
        action: action("Ver comentário", "View comment"),
      });
    case "risk":
      return notificationEmail({
        ...base,
        tone,
        title: text(
          "Um risco foi atribuído a você",
          "A risk is assigned to you",
        ),
        module: text("Gestão de riscos", "Risk management"),
        intro: text(
          "Você foi designado como responsável pelo risco abaixo.",
          "You have been assigned responsibility for the risk below.",
        ),
        fields: [
          field("Nível de risco", "Risk level", "level"),
          field("Probabilidade", "Likelihood", "probability"),
          field("Impacto", "Impact", "impact"),
          field("Categoria", "Category", "category"),
        ],
        next: text(
          "Avalie o risco, defina o tratamento e acompanhe as ações no sistema.",
          "Assess the risk, define its treatment and track actions in the system.",
        ),
        action: action("Gerenciar risco", "Manage risk"),
      });
    case "acceptance":
      return notificationEmail({
        ...base,
        title: value("heading"),
        module: text("Aceite de risco", "Risk acceptance"),
        intro: value("intro"),
        fields: [field("Empresa", "Company", "company")],
        action: { label: value("action"), url: value("url") },
      });
    case "review":
      return notificationEmail({
        ...base,
        title: text(
          "Uma revisão de acessos aguarda você",
          "An access review awaits you",
        ),
        module: text("Revisão de acessos", "Access reviews"),
        intro: text(
          "Revise os usuários e as contas incluídas nesta campanha.",
          "Review the users and accounts included in this campaign.",
        ),
        fields: [
          field("Sistema", "System", "system"),
          field("Contas para revisar", "Accounts to review", "count"),
          field("Prazo", "Due date", "deadline"),
        ],
        next: text(
          "Confira cada acesso e registre a decisão. Este link é pessoal: não o encaminhe.",
          "Check each access and record your decision. This link is personal: do not forward it.",
        ),
        action: action("Iniciar revisão", "Start review"),
      });
    case "approval":
      return notificationEmail({
        ...base,
        title: text(
          "Um documento aguarda sua aprovação",
          "A document awaits your approval",
        ),
        module: text("Documentos", "Documents"),
        intro: text(
          `${value("author")} solicitou sua avaliação do documento abaixo.`,
          `${value("author")} requested your review of the document below.`,
        ),
        fields: [field("Empresa", "Company", "company")],
        next: text(
          "Leia o documento e registre sua decisão no Akuris.",
          "Read the document and record your decision in Akuris.",
        ),
        action: action("Revisar documento", "Review document"),
      });
    case "incident":
      return notificationEmail({
        ...base,
        tone,
        title: text(
          "Um novo incidente foi registrado",
          "A new incident has been recorded",
        ),
        module: text("Incidentes", "Incidents"),
        intro: text(
          "Confira a gravidade e o contexto para organizar a resposta.",
          "Check the severity and context to coordinate the response.",
        ),
        fields: [
          field("Gravidade", "Severity", "severity"),
          field("Tipo", "Type", "type"),
          field("Responsável", "Owner", "owner"),
        ],
        next: text(
          "Avalie o incidente e registre as medidas de resposta no sistema.",
          "Assess the incident and record response measures in the system.",
        ),
        action: action("Ver incidente", "View incident"),
      });
    case "contract":
      return notificationEmail({
        ...base,
        tone,
        title: text(
          "Atenção ao vencimento do contrato",
          "Check the contract expiry date",
        ),
        module: text("Contratos", "Contracts"),
        intro: text(
          "Confira o prazo para planejar a renovação ou o encerramento.",
          "Check the deadline to plan renewal or closure.",
        ),
        fields: [
          field("Situação", "Status", "status"),
          field("Vencimento", "Expiry date", "deadline"),
          field("Fornecedor", "Supplier", "supplier"),
          field("Valor", "Value", "amount"),
          field("Gestor", "Manager", "owner"),
        ],
        next: text(
          "Verifique as condições do contrato e registre as providências necessárias.",
          "Check the contract terms and record the necessary actions.",
        ),
        action: action("Ver contrato", "View contract"),
      });
    case "key":
      return notificationEmail({
        ...base,
        tone,
        title: text("Confira a rotação desta chave", "Check this key rotation"),
        module: text("Chaves criptográficas", "Cryptographic keys"),
        intro: value("intro"),
        fields: [
          field("Tipo", "Type", "type"),
          field("Ambiente", "Environment", "environment"),
          field("Próxima rotação", "Next rotation", "deadline"),
          field("Localização", "Location", "location"),
          field("Criticidade", "Criticality", "criticality"),
        ],
        action: action("Gerenciar chave", "Manage key"),
      });
    case "license":
      return notificationEmail({
        ...base,
        tone,
        title: text(
          "Confira o vencimento desta licença",
          "Check this license expiry",
        ),
        module: text("Licenças", "Licenses"),
        intro: value("intro"),
        fields: [
          field("Tipo", "Type", "type"),
          field("Vencimento", "Expiry date", "deadline"),
          field("Fornecedor", "Supplier", "supplier"),
        ],
        action: action("Gerenciar licença", "Manage license"),
      });
    case "report":
      return notificationEmail({
        ...base,
        tone,
        title: text("Nova denúncia recebida", "New report received"),
        module: text("Canal de denúncias", "Whistleblowing channel"),
        intro: text(
          "Uma nova denúncia foi registrada e requer avaliação do comitê.",
          "A new report has been submitted and requires committee review.",
        ),
        fields: [
          field("Empresa", "Company", "company"),
          field("Gravidade", "Severity", "severity"),
          field("Tipo", "Type", "type"),
          field("Categoria", "Category", "category"),
          field("Recebida em", "Received on", "date"),
        ],
        next: text(
          "Acesse o canal para analisar o caso. Trate estas informações com confidencialidade.",
          "Open the channel to review the case. Treat this information confidentially.",
        ),
        action: action(
          "Acessar canal de denúncias",
          "Open whistleblowing channel",
        ),
      });
    case "dueDiligence": {
      const completed = data.status === "completed";
      const reminder = data.status === "reminder";
      return notificationEmail({
        ...base,
        tone: completed ? "success" : reminder ? "warning" : "neutral",
        title: completed
          ? text("Recebemos suas respostas", "We received your answers")
          : reminder
          ? text(
            "Seu questionário ainda está pendente",
            "Your questionnaire is still pending",
          )
          : text(
            "Você recebeu um questionário",
            "You received a questionnaire",
          ),
        module: "Due diligence",
        intro: completed
          ? text(
            "Obrigado pela colaboração. Suas respostas serão analisadas pela equipe responsável.",
            "Thank you for your collaboration. Your answers will be reviewed by the responsible team.",
          )
          : text(
            `Responda ao questionário solicitado por ${value("company")}.`,
            `Complete the questionnaire requested by ${value("company")}.`,
          ),
        fields: [field("Prazo", "Due date", "deadline")],
        ...(completed ? {} : {
          action: action("Responder questionário", "Answer questionnaire"),
        }),
      });
    }
  }
}
