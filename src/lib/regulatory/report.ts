import type { DocGenDocument, DocxLabels } from "@/lib/docgen-docx";
import type { AppLocale } from "@/lib/i18n-locale";
import type {
  Product,
  ProductVersion,
  Assessment,
  AssessmentItem,
  EvidenceLink,
  Finding,
  Sbom,
  ReportingWorkflow,
} from "./types";
import type { EvidenceLibraryItem } from "@/hooks/useEvidenceLibrary";
import { regulatoryMetrics } from "./metrics";
import {
  regulatoryLabel,
  regulatoryText,
  readinessDisclaimer,
} from "./presentation";
import { formatarDiaParaDB } from "@/lib/date-utils";
export interface RegulatoryReportData {
  assessment: Assessment;
  items: AssessmentItem[];
  links: EvidenceLink[];
  findings: Finding[];
  sboms: Sbom[];
  reporting: ReportingWorkflow[];
}
const plain = (value: unknown) =>
  String(value ?? "—")
    .replace(/[|\r\n]+/g, " ")
    .replace(/[[\]<>*`#]/g, "")
    .trim();
const table = (head: string[], rows: unknown[][]) =>
  `| ${head.map(plain).join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n${rows.map((r) => `| ${r.map(plain).join(" | ")} |`).join("\n")}`;
export function buildRegulatoryReport({
  data,
  product,
  version,
  evidence,
  locale,
  company,
  people,
  actions,
}: {
  data: RegulatoryReportData;
  product: Product;
  version: ProductVersion;
  evidence: EvidenceLibraryItem[];
  locale: AppLocale;
  company: string;
  people: { id: string; nome: string }[];
  actions: {
    id: string;
    titulo: string;
    status: string;
    prazo: string | null;
  }[];
}) {
  const t = (pt: string, en: string) => regulatoryText(locale, pt, en);
  const label = (v: string) => regulatoryLabel(locale, v);
  const a = data.assessment;
  const metrics = regulatoryMetrics(
    data.items,
    data.links,
    data.findings,
    new Map(evidence.map((e) => [e.id, e.valido_ate])),
  );
  const pct = (v: number | null) =>
    v === null
      ? t(
          "Não calculável (sem respostas avaliadas)",
          "Not calculable (no assessed answers)",
        )
      : `${v.toLocaleString(locale)}%`;
  const owner = (id: string | null) =>
    people.find((p) => p.id === id)?.nome ??
    t("Não atribuído / histórico", "Unassigned / historical");
  const title = (item: AssessmentItem) =>
    locale === "en" ? item.snapshot.title_en : item.snapshot.title;
  const document: DocGenDocument = {
    titulo: "Cyber Resilience Act — CRA Readiness Report",
    versao: "1.0",
    data_criacao: formatarDiaParaDB(new Date()),
    metadados: { classificacao: t("Confidencial", "Confidential") },
    secoes: [
      {
        nome: t("Resumo executivo", "Executive summary"),
        conteudo: `${plain(company)} · ${plain(product.name)} · ${plain(version.version)}\n\n${plain(a.name)}\n\n${t("Prontidão", "Readiness")}: **${pct(metrics.score.score)}**. ${t("Cobertura da avaliação", "Assessment coverage")}: ${pct(metrics.score.assessmentCoverage)}. ${metrics.score.pending} ${t("requisitos pendentes", "pending requirements")}.\n\n${t(...readinessDisclaimer)}\n\n${t("Base de prontidão inicial: não substitui uma avaliação jurídica de todas as obrigações. Nenhum resultado representa autorização para marcação CE ou colocação do produto no mercado.", "Initial readiness baseline: not a substitute for legal assessment of all obligations. No result authorizes CE marking or placing a product on the market.")}`,
      },
      {
        nome: t("Produto e ciclo de vida", "Product and lifecycle"),
        conteudo: table(
          [t("Campo", "Field"), t("Informação", "Information")],
          [
            ["Produto / Product", product.name],
            ["ID", product.id],
            [t("Descrição", "Description"), product.description],
            [t("Versão", "Version"), version.version],
            [t("Tipo", "Type"), label(product.product_type)],
            [t("Implantação", "Deployment"), label(product.deployment_model)],
            [t("Mercados", "Markets"), product.markets.join(", ")],
            [
              t("Disponibilidade UE", "EU availability"),
              label(product.eu_availability),
            ],
            [
              t("Responsável pelo produto", "Product owner"),
              owner(product.product_owner_id),
            ],
            [
              t("Responsável por segurança", "Security owner"),
              owner(product.security_owner_id),
            ],
            [t("Equipe", "Team"), product.development_team],
            [t("Lançamento", "Release"), version.release_date],
            [t("Fim do suporte", "Support ends"), version.support_ends_on],
            [
              t("Justificativa de suporte", "Support rationale"),
              version.support_rationale,
            ],
          ],
        ),
      },
      {
        nome: t(
          "Aplicabilidade e classificação",
          "Applicability and classification",
        ),
        conteudo: `${a.roles.map(label).join(", ")}\n\n${label(a.applicability)} · ${label(a.classification)}\n\n${plain(a.decision_rationale)}\n\n${t("Resultado preliminar", "Preliminary result")}: ${label(a.preliminary.applicability)} · ${label(a.preliminary.classification)}\n\n${t("Método de triagem", "Screening method")}: ${plain(a.preliminary.rules_version)}\n\n${t("Avaliação", "Assessment")}: ${a.id}\n${t("Versão do catálogo (ID)", "Catalog version (ID)")}: ${a.framework_version_id}\n${t("Revisão humana registrada em", "Human review recorded at")}: ${new Date(a.reviewed_at).toLocaleString(locale)}`,
      },
      {
        nome: t("Método e scores por domínio", "Method and domain scores"),
        conteudo: `${t("Método assessed_weighted_v1: Conforme=100, Parcial=50, Não conforme=0. Pesos preservados no escopo. Não aplicáveis e não avaliados são excluídos do denominador do score. A cobertura usa todos os requisitos não marcados N/A. Sem respostas avaliadas, não existe score.", "Method assessed_weighted_v1: Compliant=100, Partial=50, Non-compliant=0. Weights are preserved in scope. Non-applicable and unassessed items are excluded from the score denominator. Coverage uses all requirements not marked N/A. Without assessed answers, there is no score.")}\n\n${table(
          [
            t("Domínio", "Domain"),
            t("Prontidão", "Readiness"),
            t("Avaliados", "Assessed"),
            t("Pendentes", "Pending"),
            "N/A",
          ],
          metrics.score.domains.map((d) => {
            const s = data.items.find(
              (i) => i.snapshot.domain === d.domain,
            )!.snapshot;
            return [
              locale === "en" ? s.domain_name_en : s.domain_name,
              pct(d.score),
              d.assessed,
              d.pending,
              d.notApplicable,
            ];
          }),
        )}`,
      },
      {
        nome: t(
          "Gaps por risco e remediação",
          "Findings by risk and remediation",
        ),
        conteudo: `${table(
          [t("Risco", "Risk"), t("Gaps não resolvidos", "Unresolved findings")],
          Object.entries(metrics.riskCounts).map(([r, c]) => [label(r), c]),
        )}\n\n${t("Remediações concluídas", "Completed remediations")}: ${metrics.remediationCompleted}/${metrics.remediationTotal}. ${t("Riscos aceitos", "Accepted risks")}: ${metrics.acceptedRisks}.\n\n${t("Conclusão de ação e aceite de risco não alteram o status do requisito nem conferem conformidade legal.", "Action completion and risk acceptance do not change the requirement status or confer legal compliance.")}`,
      },
      ...[...data.findings]
        .sort(
          (x, y) =>
            ["critical", "high", "medium", "low"].indexOf(x.risk) -
            ["critical", "high", "medium", "low"].indexOf(y.risk),
        )
        .map((f) => ({
          nome: `${label(f.risk)} · ${plain(f.title)}`,
          conteudo: `ID: ${f.id}\n\n${plain(f.description)}\n\n**${t("Impacto", "Impact")}:** ${plain(f.impact)}\n\n**${t("Recomendação", "Recommendation")}:** ${plain(f.recommendation)}\n\n**${t("Evidências faltantes", "Missing evidence")}:** ${plain(f.missing_evidence)}\n\n${owner(f.owner_id)} · ${plain(f.department)} · ${plain(f.due_on)} · ${label(f.status)}\n\n${plain(f.decision_note)}\n\n${t("Plano vinculado", "Linked plan")}: ${plain(f.action_plan_id)} ${f.action_plan_id ? label(actions.find((p) => p.id === f.action_plan_id)?.status ?? t("Não acessível a esta conta", "Not accessible to this account")) : ""}`,
        })),
      {
        nome: t("Avaliação dos requisitos", "Requirements assessment"),
        conteudo: table(
          [
            t("Requisito", "Requirement"),
            "Status",
            t("Peso", "Weight"),
            t("Justificativa", "Rationale"),
            t("Responsável", "Owner"),
          ],
          data.items.map((i) => [
            `${i.snapshot.code} · ${title(i)}`,
            label(i.status),
            i.snapshot.weight,
            i.notes,
            owner(i.owner_id),
          ]),
        ),
      },
      {
        nome: t(
          "Cobertura e revisão de evidências",
          "Evidence coverage and review",
        ),
        conteudo: `${pct(metrics.evidenceCoverage)} · ${metrics.evidenceCovered}/${metrics.score.applicable}\n\n${t("Considera evidências aceitas no escopo, não removidas, cuja validade local e da biblioteca não estejam vencidas. Sem prazo definido não significa garantia de atualidade.", "Includes evidence accepted in scope, not unlinked and not expired either locally or in the library. An unspecified expiry is not a guarantee of currency.")}\n\n${table(
          [
            t("Requisito", "Requirement"),
            t("Evidência", "Evidence"),
            t("Revisão", "Review"),
            t("Data", "Date"),
            t("Validade", "Expiry"),
            t("Comentário", "Comment"),
          ],
          data.links.map((l) => [
            data.items.find((i) => i.id === l.item_id)?.snapshot.code,
            evidence.find((e) => e.id === l.evidence_id)?.nome ??
              t("Indisponível", "Unavailable"),
            label(l.review_status),
            l.evidence_date,
            l.valid_until ??
              evidence.find((e) => e.id === l.evidence_id)?.valido_ate,
            l.comment,
          ]),
        )}`,
      },
      {
        nome: "SBOM",
        conteudo:
          table(
            [
              t("Formato", "Format"),
              t("Componentes", "Components"),
              t("Ferramenta", "Tool"),
              t("Data de geração", "Generated"),
              "Status",
            ],
            data.sboms.map((s) => [
              `${s.format} ${s.spec_version}`,
              s.component_count,
              s.tool,
              s.generated_at,
              label(s.status),
            ]),
          ) +
          `\n\n${t("Validação de estrutura e metadados; sem varredura de vulnerabilidades ou certificação do formato completo.", "Structure and metadata validation; no vulnerability scanning or full format certification.")}`,
      },
      ...data.reporting.map((r) => ({
        nome: `Reporting · ${label(r.event_type)}`,
        conteudo: `${t("Equipe", "Team")}: ${plain(r.responsible_team)}\nPSIRT: ${plain(r.psirt)}\n${t("Jurídico", "Legal")}: ${plain(r.legal_contact)}\n${t("Gestão", "Management")}: ${plain(r.management_contact)}\n\n**24h:** ${plain(r.initial_procedure)}\n\n**72h:** ${plain(r.detailed_procedure)}\n\n**${t("Final", "Final")}:** ${plain(r.final_procedure)}\n\n${t("Último exercício", "Last exercise")}: ${plain(r.last_exercise_on)}\n${plain(r.notes)}\n\n${t("Prazos do artigo 14: alertas sem demora injustificada em até 24h/72h do conhecimento; final de vulnerabilidade em até 14 dias da disponibilização da medida corretiva/mitigadora; final de incidente em até um mês da notificação detalhada, com regra específica se ainda estiver em curso. Nenhum envio automático a autoridades.", "Article 14 timing: without undue delay, within 24h/72h of awareness; vulnerability final within 14 days of corrective/mitigating measure availability; incident final within one month of detailed notification, with a specific rule when ongoing. No automatic submissions to authorities.")}`,
      })),
      {
        nome: t(
          "Conformity readiness e limitações",
          "Conformity readiness and limitations",
        ),
        conteudo: `${t("A rota de avaliação de conformidade depende da classe, função principal e regras aplicáveis. Requisitos de documentação e conformidade constam na avaliação; seu preenchimento não constitui declaração UE de conformidade, avaliação por organismo notificado nem certificação.", "The conformity assessment route depends on class, core functionality and applicable rules. Documentation and conformity requirements are included in the assessment; their completion is not an EU declaration of conformity, notified-body assessment or certification.")}\n\n${t(...readinessDisclaimer)}\n\n${t("Fonte primária: Regulamento (UE) 2024/2847", "Primary source: Regulation (EU) 2024/2847")}\nhttps://eur-lex.europa.eu/eli/reg/2024/2847/oj`,
      },
    ],
  };
  const labels: DocxLabels = {
    summary: t("Sumário", "Contents"),
    section: t("Seção", "Section"),
    versaoText: `${t("Versão", "Version")}: 1.0`,
    emissionDateText: `${t("Emissão", "Issued")}: ${new Date().toLocaleDateString(locale)}`,
    classificationText: `${t("Classificação", "Classification")}: ${t("Confidencial", "Confidential")}`,
    footerPage: t("Página", "Page"),
    of: t("de", "of"),
    glossary: t("Glossário", "Glossary"),
    glossaryTerm: t("Termo", "Term"),
    glossaryDefinition: t("Definição", "Definition"),
    versionHistory: t("Histórico", "History"),
    versionCol: t("Versão", "Version"),
    dateCol: t("Data", "Date"),
    authorCol: t("Autor", "Author"),
    descriptionCol: t("Descrição", "Description"),
    coverage: t("Cobertura", "Coverage"),
    requirementCol: t("Requisito", "Requirement"),
    sectionsCol: t("Seções", "Sections"),
    evidenceCol: t("Evidência", "Evidence"),
  };
  return { document, options: { empresaNome: company, labels } };
}
