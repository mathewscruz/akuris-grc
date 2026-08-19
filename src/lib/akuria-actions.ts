/**
 * Parser e dispatcher de ações executáveis emitidas pela AkurIA.
 *
 * A IA é instruída a embutir tags do tipo:
 *   [ACTION:navigate:/riscos]
 *   [ACTION:open:risco:UUID]
 *   [ACTION:create:risco]
 *   [ACTION:create:incidente]
 *
 * O frontend faz parse, remove a tag do texto exibido e renderiza um botão
 * que dispara um CustomEvent global que módulos podem escutar.
 */

export type AkurIAActionType = "navigate" | "open" | "create";

export interface AkurIAAction {
  type: AkurIAActionType;
  /** Para `navigate`: rota. Para `open`/`create`: módulo (ex: "risco"). */
  target: string;
  /** Para `open`: id do registro. Para `create`: payload opcional pré-preenchido. */
  payload?: string;
  /** Texto humano para o botão. */
  label: string;
  /** Tag bruta original (para remoção do texto). */
  raw: string;
}

const ACTION_REGEX = /\[ACTION:(navigate|open|create):([^\]:]+)(?::([^\]]+))?\]/g;

const MODULE_LABELS: Record<string, string> = {
  risco: "risco",
  riscos: "Riscos",
  controle: "controle",
  controles: "Controles",
  incidente: "incidente",
  incidentes: "Incidentes",
  plano_acao: "plano de ação",
  planos_acao: "Planos de Ação",
  documento: "documento",
  documentos: "Documentos",
  contrato: "contrato",
  contratos: "Contratos",
  ativo: "ativo",
  ativos: "Ativos",
  denuncia: "denúncia",
  denuncias: "Denúncias",
  auditoria: "auditoria",
  auditorias: "Auditorias",
  fornecedor: "fornecedor",
  fornecedores: "Fornecedores",
  dados_pessoais: "Dados Pessoais",
  contas_privilegiadas: "Contas Privilegiadas",
  continuidade: "Continuidade de Negócios",
  gap_analysis: "Gap Analysis",
};

const MODULE_ROUTES: Record<string, string> = {
  risco: "/riscos",
  riscos: "/riscos",
  controle: "/governanca/controles",
  controles: "/governanca/controles",
  incidente: "/incidentes",
  incidentes: "/incidentes",
  plano_acao: "/planos-acao",
  planos_acao: "/planos-acao",
  documento: "/documentos",
  documentos: "/documentos",
  contrato: "/contratos",
  contratos: "/contratos",
  ativo: "/ativos",
  ativos: "/ativos",
  denuncia: "/denuncia",
  denuncias: "/denuncia",
  auditoria: "/governanca/auditorias",
  auditorias: "/governanca/auditorias",
  fornecedor: "/due-diligence",
  fornecedores: "/due-diligence",
  dados_pessoais: "/privacidade",
  contas_privilegiadas: "/contas-privilegiadas",
  continuidade: "/continuidade",
  gap_analysis: "/gap-analysis-frameworks",
};

function moduleLabel(key: string) {
  return MODULE_LABELS[key.toLowerCase()] || key;
}

export function parseAkurIAActions(content: string): {
  cleanContent: string;
  actions: AkurIAAction[];
} {
  const actions: AkurIAAction[] = [];
  let match: RegExpExecArray | null;
  ACTION_REGEX.lastIndex = 0;

  while ((match = ACTION_REGEX.exec(content)) !== null) {
    const [raw, type, target, payload] = match;
    let label = "";

    if (type === "navigate") {
      label = `Abrir ${target}`;
    } else if (type === "open") {
      label = `Ver este ${moduleLabel(target)}`;
    } else if (type === "create") {
      label = `Criar ${moduleLabel(target)}`;
    }

    actions.push({
      type: type as AkurIAActionType,
      target,
      payload,
      label,
      raw,
    });
  }

  // Remove tags do texto exibido
  const cleanContent = content.replace(ACTION_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();

  return { cleanContent, actions };
}

/**
 * Dispara a ação. Para `navigate`, retorna a rota (consumidor faz navigate).
 * Para `open`/`create`, emite CustomEvent global que módulos escutam.
 */
export function getNavigateRoute(action: AkurIAAction): string | null {
  if (action.type === "navigate") {
    // Permite tanto rota raw (/riscos) quanto chave de módulo (riscos)
    if (action.target.startsWith("/")) return action.target;
    return MODULE_ROUTES[action.target.toLowerCase()] || null;
  }
  if (action.type === "open") {
    const base = MODULE_ROUTES[action.target.toLowerCase()];
    return base || null;
  }
  return null;
}

export function dispatchAkurIAAction(action: AkurIAAction) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("akuria:action", {
      detail: action,
    })
  );
}
