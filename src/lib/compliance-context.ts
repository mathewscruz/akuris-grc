export interface ContextSignal {
  key: string;
  rule:
    | "contract_assessment"
    | "risk_personal_data"
    | "access_revocation_pending"
    | "recovery_not_demonstrated";
  title: string;
  priority: "high" | "medium";
  facts: Record<string, string | number | null>;
  sources: { label: string; path: string }[];
}
export function contextAction(signal: ContextSignal) {
  const id = signal.key.split(":")[1];
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return null;
  const module = {
    contract_assessment: "contratos",
    risk_personal_data: "riscos",
    access_revocation_pending: "manual",
    recovery_not_demonstrated: "manual",
  }[signal.rule];
  return module
    ? {
      modulo: module,
      registroId: module === "manual" ? "" : id,
      registroTitulo: signal.title,
      prioridade: signal.priority === "high" ? "alta" as const : "media" as const,
    }
    : null;
}
export function safeContextPath(value: string) {
  return /^\/(contratos|due-diligence|riscos|dados|ativos|sistemas|revisao-acessos|continuidade)(\?[^\\]*)?$/
      .test(value)
    ? value
    : null;
}
