import { localizePtDictionary } from "@/lib/pt-variants";
import type { AppLocale } from "@/lib/i18n-locale";
export const regulatoryLabels: Record<string, [string, string]> = {
  yes: ["Sim", "Yes"],
  no: ["Não", "No"],
  unknown: ["Não sei / a confirmar", "Unknown / to confirm"],
  likely_applicable: ["Provavelmente aplicável", "Likely applicable"],
  potentially_applicable: [
    "Potencialmente aplicável",
    "Potentially applicable",
  ],
  likely_not_applicable: [
    "Provavelmente não aplicável",
    "Likely not applicable",
  ],
  legal_review_required: [
    "Revisão jurídica necessária",
    "Legal review required",
  ],
  default: [
    "Padrão / outros produtos digitais",
    "Default / other digital products",
  ],
  important_class_i: [
    "Produto importante — classe I",
    "Important product — class I",
  ],
  important_class_ii: [
    "Produto importante — classe II",
    "Important product — class II",
  ],
  critical: ["Crítico", "Critical"],
  review_required: [
    "Classificação a revisar",
    "Classification review required",
  ],
  manufacturer: ["Fabricante", "Manufacturer"],
  importer: ["Importador", "Importer"],
  distributor: ["Distribuidor", "Distributor"],
  authorised_representative: [
    "Representante autorizado",
    "Authorised representative",
  ],
  conforme: ["Conforme", "Compliant"],
  parcial: ["Parcialmente conforme", "Partially compliant"],
  nao_conforme: ["Não conforme", "Non-compliant"],
  nao_aplicavel: ["Não aplicável", "Not applicable"],
  nao_avaliado: ["Não avaliado", "Not assessed"],
  high: ["Alto", "High"],
  medium: ["Médio", "Medium"],
  low: ["Baixo", "Low"],
  active: ["Ativo", "Active"],
  archived: ["Arquivado", "Archived"],
  software: ["Software", "Software"],
  hardware: ["Hardware", "Hardware"],
  combined: ["Software e hardware", "Software and hardware"],
  other: ["Outro", "Other"],
  cloud: ["Nuvem", "Cloud"],
  on_premise: ["Local", "On premises"],
  hybrid: ["Híbrido", "Hybrid"],
  embedded: ["Embarcado", "Embedded"],
  mobile: ["Mobile", "Mobile"],
  development: ["Em desenvolvimento", "In development"],
  released: ["Lançada", "Released"],
  end_of_support: ["Suporte encerrado", "End of support"],
  in_progress: ["Em andamento", "In progress"],
  review_ready: ["Pronto para revisão", "Ready for review"],
  open: ["Aberto", "Open"],
  planned: ["Planejado", "Planned"],
  pending_evidence: ["Aguardando evidência", "Pending evidence"],
  ready_for_review: ["Pronto para revisão", "Ready for review"],
  completed: ["Ação concluída", "Action completed"],
  risk_accepted: ["Risco aceito", "Risk accepted"],
  resolved: ["Resolvido por reavaliação", "Resolved by reassessment"],
  unreviewed: ["Aguardando revisão", "Awaiting review"],
  accepted: ["Aceita no escopo", "Accepted in scope"],
  rejected: ["Não aceita", "Rejected"],
  uploaded: ["Importado", "Uploaded"],
  reviewed: ["Revisado", "Reviewed"],
  superseded: ["Substituído", "Superseded"],
  exploited_vulnerability: [
    "Vulnerabilidade ativamente explorada",
    "Actively exploited vulnerability",
  ],
  severe_incident: ["Incidente grave", "Severe incident"],
  pendente: ["Pendente", "Pending"],
  em_andamento: ["Em andamento", "In progress"],
  concluido: ["Concluído", "Completed"],
  cancelado: ["Cancelado", "Cancelled"],
  atrasado: ["Atrasado", "Overdue"],
};
export function regulatoryText(locale: AppLocale, pt: string, en: string) {
  return locale === "en"
    ? en
    : (localizePtDictionary({ value: pt }, locale).value as string);
}
export function regulatoryLabel(locale: AppLocale, key: string) {
  const [pt, en] = regulatoryLabels[key] ?? [key, key];
  return regulatoryText(locale, pt, en);
}
export const readinessDisclaimer = [
  "Avaliação de prontidão baseada no escopo e nas evidências revisadas. Não é certificação, parecer jurídico ou garantia de conformidade. O catálogo inicial não esgota todas as obrigações e exceções do CRA.",
  "Readiness assessment based on scope and reviewed evidence. Not certification, legal advice or a guarantee of compliance. The initial catalog does not exhaust all CRA obligations and exceptions.",
] as const;
