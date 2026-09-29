import { z } from "zod";

/** Mirrors regulatory_cra_triage; database parity is covered by SQL QA. */
export const CRA_TRIAGE_VERSION = "cra-triage-2026-09-29.1";
export const applicabilityQuestions = [
  [
    "digital",
    "O produto contém elementos digitais (software ou hardware)?",
    "Does the product contain digital elements (software or hardware)?",
  ],
  [
    "connected",
    "O uso previsto inclui conexão direta ou indireta a dispositivos ou redes?",
    "Does intended use include direct or indirect connection to devices or networks?",
  ],
  [
    "commercial",
    "É disponibilizado em atividade comercial, mesmo sem cobrança?",
    "Is it made available in a commercial activity, even free of charge?",
  ],
  [
    "eu_market",
    "É disponibilizado no mercado da União Europeia?",
    "Is it made available on the European Union market?",
  ],
  [
    "installed",
    "Existe software instalado no ambiente do cliente?",
    "Is software installed in the customer environment?",
  ],
  ["desktop", "Existe aplicativo desktop?", "Is there a desktop application?"],
  ["mobile", "Existe aplicativo mobile?", "Is there a mobile application?"],
  [
    "device",
    "Existe dispositivo físico conectado?",
    "Is there a connected physical device?",
  ],
  [
    "required_cloud",
    "Há processamento remoto necessário a uma função do produto, sob responsabilidade do fabricante?",
    "Is remote processing necessary for a product function and under the manufacturer’s responsibility?",
  ],
  [
    "cybersecurity",
    "O produto oferece funções de cibersegurança?",
    "Does the product provide cybersecurity functions?",
  ],
  [
    "authentication",
    "Realiza autenticação?",
    "Does it perform authentication?",
  ],
  [
    "iam",
    "Oferece gestão de identidades ou de acessos?",
    "Does it provide identity or access management?",
  ],
  [
    "endpoint",
    "Oferece proteção de endpoints?",
    "Does it provide endpoint protection?",
  ],
  [
    "monitoring",
    "Oferece monitoramento de segurança?",
    "Does it provide security monitoring?",
  ],
  [
    "networks",
    "Oferece funções relacionadas a redes?",
    "Does it provide network-related functions?",
  ],
  [
    "develops",
    "A organização desenvolve ou manda desenvolver o produto?",
    "Does the organization develop or commission the product?",
  ],
  [
    "imports",
    "A organização importa o produto para a UE?",
    "Does the organization import the product into the EU?",
  ],
  [
    "distributes",
    "A organização distribui o produto?",
    "Does the organization distribute the product?",
  ],
  [
    "represents",
    "A organização atua como representante autorizado com mandato escrito?",
    "Does the organization act as an authorised representative under a written mandate?",
  ],
  [
    "noncommercial_oss",
    "É software livre/open-source disponibilizado fora de atividade comercial?",
    "Is it free/open-source software made available outside a commercial activity?",
  ],
  [
    "steward",
    "A organização pode atuar como open-source software steward?",
    "Could the organization act as an open-source software steward?",
  ],
  [
    "sector_exclusion",
    "Pode haver exclusão setorial, de defesa ou outro regime específico?",
    "Could a sectoral, defence or other specific exclusion apply?",
  ],
  [
    "substantial_modification",
    "A organização realiza modificação substancial no produto?",
    "Does the organization substantially modify the product?",
  ],
  [
    "own_brand",
    "A organização coloca o produto no mercado sob seu próprio nome ou marca?",
    "Does the organization place the product on the market under its own name or trademark?",
  ],
] as const;
export type ApplicabilityQuestion = (typeof applicabilityQuestions)[number][0];
export type TriState = "yes" | "no" | "unknown";
export type ApplicabilityAnswers = Record<ApplicabilityQuestion, TriState> & {
  primary_category:
    "other" | "annex_iii_i" | "annex_iii_ii" | "annex_iv" | "unknown";
};
export const applicabilityStates = [
  "likely_applicable",
  "potentially_applicable",
  "likely_not_applicable",
  "legal_review_required",
] as const;
export const classificationStates = [
  "default",
  "important_class_i",
  "important_class_ii",
  "critical",
  "review_required",
] as const;
export const roles = [
  "manufacturer",
  "importer",
  "distributor",
  "authorised_representative",
] as const;
export const applicabilityAnswersSchema = z
  .object(
    Object.fromEntries(
      applicabilityQuestions.map(([key]) => [
        key,
        z.enum(["yes", "no", "unknown"]),
      ]),
    ) as Record<ApplicabilityQuestion, z.ZodEnum<["yes", "no", "unknown"]>>,
  )
  .extend({
    primary_category: z.enum([
      "other",
      "annex_iii_i",
      "annex_iii_ii",
      "annex_iv",
      "unknown",
    ]),
  })
  .strict();
export const initialApplicabilityAnswers = (): ApplicabilityAnswers =>
  ({
    ...Object.fromEntries(
      applicabilityQuestions.map(([key]) => [key, "unknown"]),
    ),
    primary_category: "unknown",
  }) as ApplicabilityAnswers;
export function evaluateApplicability(input: ApplicabilityAnswers) {
  const a = applicabilityAnswersSchema.parse(input);
  let applicability: (typeof applicabilityStates)[number];
  if (
    a.sector_exclusion !== "no" ||
    a.steward === "yes" ||
    (a.installed === "no" &&
      a.desktop === "no" &&
      a.mobile === "no" &&
      a.device === "no" &&
      a.required_cloud !== "yes")
  )
    applicability = "legal_review_required";
  else if (
    a.digital === "no" ||
    a.connected === "no" ||
    a.eu_market === "no" ||
    (a.noncommercial_oss === "yes" && a.commercial === "no")
  )
    applicability = "likely_not_applicable";
  else if (
    a.digital === "yes" &&
    a.connected === "yes" &&
    a.commercial === "yes" &&
    a.eu_market === "yes" &&
    a.noncommercial_oss !== "unknown"
  )
    applicability = "likely_applicable";
  else applicability = "potentially_applicable";
  const classification = {
    other: "default",
    annex_iii_i: "important_class_i",
    annex_iii_ii: "important_class_ii",
    annex_iv: "critical",
    unknown: "review_required",
  }[a.primary_category] as (typeof classificationStates)[number];
  return {
    rules_version: CRA_TRIAGE_VERSION,
    applicability,
    classification,
    manufacturer_review:
      a.own_brand === "yes" || a.substantial_modification === "yes",
    source: "https://eur-lex.europa.eu/eli/reg/2024/2847/oj",
  };
}
