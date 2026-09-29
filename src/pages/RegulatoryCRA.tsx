import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useRegulatoryWorkspace,
  useRegulatoryAssessment,
} from "@/hooks/useRegulatory";
import { useEvidenceLibrary } from "@/hooks/useEvidenceLibrary";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { QueryError } from "@/components/ui/query-error";
import { ModuleLoadingSkeleton } from "@/components/ui/module-loading-skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ProductDialog,
  ProductVersionDialog,
} from "@/components/regulatory/ProductDialog";
import { AssessmentWizard } from "@/components/regulatory/AssessmentWizard";
import { RequirementDialog } from "@/components/regulatory/RequirementDialog";
import { FindingDialog } from "@/components/regulatory/FindingDialog";
import { ReportingPanel } from "@/components/regulatory/ReportingPanel";
import { SbomPanel } from "@/components/regulatory/SbomPanel";
import { ReportButton } from "@/components/regulatory/ReportButton";
import { ScopePanel } from "@/components/regulatory/ScopePanel";
import { useCraText } from "@/hooks/useRegulatoryText";
import { LocalizedText } from "@/components/regulatory/shared";
import type { Product, ProductVersion } from "@/lib/regulatory/types";
import { regulatoryMetrics } from "@/lib/regulatory/metrics";
import { readinessDisclaimer } from "@/lib/regulatory/presentation";
import { formatDateOnly } from "@/lib/date-utils";
import { matchesRegulatorySearch } from "@/lib/regulatory/search";

export default function RegulatoryCRA() {
  const workspace = useRegulatoryWorkspace();
  const { assessmentId } = useParams();
  const { text } = useCraText();
  if (workspace.isPending) return <ModuleLoadingSkeleton />;
  if (workspace.isError || !workspace.data || !workspace.empresaId)
    return <QueryError onRetry={() => void workspace.refetch()} />;
  return (
    <div className="space-y-6">
      <Link
        to={assessmentId ? "/gap-analysis/cra" : "/gap-analysis/frameworks"}
        className="text-sm text-muted-foreground hover:text-primary"
      >
        ←{" "}
        {assessmentId
          ? text("regulatory.cra_assessments_220da7")
          : "Gap Analysis"}
      </Link>
      {assessmentId ? (
        <AssessmentView
          key={`${workspace.empresaId}:${assessmentId}`}
          assessmentId={assessmentId}
          workspace={workspace as Workspace}
        />
      ) : (
        <WorkspaceView workspace={workspace as Workspace} />
      )}
    </div>
  );
}
type Workspace = ReturnType<typeof useRegulatoryWorkspace> & {
  data: NonNullable<ReturnType<typeof useRegulatoryWorkspace>["data"]>;
  empresaId: string;
};
function WorkspaceView({ workspace: w }: { workspace: Workspace }) {
  const { text, label, locale } = useCraText();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const canCreate = permissions.canCreate("gap-analysis");
  const [tab, setTab] = useState("assessments");
  const [productDialog, setProductDialog] = useState<Product | "new" | null>(
    null,
  );
  const [versionDialog, setVersionDialog] = useState<{
    product: Product;
    version?: ProductVersion;
  } | null>(null);
  const [wizard, setWizard] = useState(false);
  const [search, setSearch] = useState("");
  const { products, versions, assessments, people, frameworkVersion } = w.data;
  const hasVersion = versions.some(
    (v) =>
      v.lifecycle_status !== "archived" &&
      products.some((p) => p.id === v.product_id && p.status === "active"),
  );
  const start = () => {
    if (!hasVersion) setTab("products");
    else setWizard(true);
  };
  return (
    <>
      <PageHeader
        title="Cyber Resilience Act"
        description={text(
          "regulatory.cra_readiness_assessment_product_and_version_sco_877744",
        )}
        actions={
          canCreate && (
            <Button disabled={!frameworkVersion} onClick={start}>
              {hasVersion
                ? text("regulatory.start_cra_assessment_abd375")
                : text("regulatory.set_up_product_and_version_1d834c")}
            </Button>
          )
        }
      />
      <section className="rounded-lg border bg-gradient-to-r from-primary/5 to-background p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {text("regulatory.registered_products_d12470")}
            </p>
            <p className="mt-1 text-2xl font-semibold">{products.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {text("regulatory.independent_assessments_6d0814")}
            </p>
            <p className="mt-1 text-2xl font-semibold">{assessments.length}</p>
          </div>
          <div>
            <p className="text-sm font-medium">
              {text("regulatory.applicability_evidence_remediation_f6e27b")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {text(
                "regulatory.organization_is_defined_by_the_active_workspace__71877d",
              )}
            </p>
          </div>
        </div>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          {text(...readinessDisclaimer)}
        </p>
      </section>
      {!frameworkVersion && (
        <p role="alert">
          {text(
            "regulatory.cra_catalog_unavailable_apply_the_migrations_bef_420edc",
          )}
        </p>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="assessments">
            {text("regulatory.assessments_780645")}
          </TabsTrigger>
          <TabsTrigger value="products">
            {text("regulatory.products_and_versions_86ae37")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assessments">
          <DataTable
            data={assessments
              .map((a) => ({
                ...a,
                product:
                  products.find((p) => p.id === a.product_id)?.name ?? "—",
                version:
                  versions.find((v) => v.id === a.product_version_id)
                    ?.version ?? "—",
              }))
              .filter((a) =>
                matchesRegulatorySearch(
                  search,
                  a.name,
                  a.product,
                  a.version,
                  label(a.classification),
                  label(a.status),
                ),
              )}
            searchValue={search}
            onSearchChange={setSearch}
            onRowClick={(a) => navigate(`/gap-analysis/cra/${a.id}`)}
            columns={[
              { key: "name", label: text("regulatory.assessment_f1fe28") },
              { key: "product", label: text("regulatory.product_61f803") },
              { key: "version", label: text("regulatory.version_894061") },
              {
                key: "classification",
                label: text("regulatory.classification_95a9bb"),
                render: (v) => label(v),
              },
              { key: "status", label: "Status", render: (v) => label(v) },
              {
                key: "updated_at",
                label: text("regulatory.updated_at_51f618"),
                render: (v) => new Date(v).toLocaleDateString(locale),
              },
            ]}
            emptyState={{
              title: text(
                "regulatory.start_with_the_product_you_want_to_assess_d8c5b3",
              ),
              description: text(
                "regulatory.add_a_version_and_review_scope_before_answering__024b7e",
              ),
              ...(canCreate
                ? {
                    action: {
                      label: hasVersion
                        ? text("regulatory.start_assessment_d3a619")
                        : text("regulatory.add_product_88d591"),
                      onClick: hasVersion ? start : () => setTab("products"),
                    },
                  }
                : {}),
            }}
          />
        </TabsContent>
        <TabsContent value="products" className="space-y-4">
          {canCreate && (
            <Button variant="outline" onClick={() => setProductDialog("new")}>
              {text("regulatory.add_product_88d591")}
            </Button>
          )}
          {products.length === 0 && (
            <p className="py-8 text-muted-foreground">
              {text("regulatory.add_the_product_then_its_first_version_4d8ed7")}
            </p>
          )}
          {products.map((product) => (
            <section key={product.id} className="rounded-lg border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{product.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {label(product.product_type)} · {label(product.status)} ·{" "}
                    {label(product.deployment_model)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {permissions.canUpdate("gap-analysis") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setProductDialog(product)}
                    >
                      {text("regulatory.edit_product_6ef595")}
                    </Button>
                  )}
                  {canCreate && product.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVersionDialog({ product })}
                    >
                      {text("regulatory.add_version_ee8811")}
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm text-muted-foreground">
                {product.description}
              </p>
              <div className="mt-4 divide-y">
                {versions
                  .filter((v) => v.product_id === product.id)
                  .map((version) => (
                    <div
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div>
                        <strong>{version.version}</strong>
                        <span className="ml-3 text-muted-foreground">
                          {label(version.lifecycle_status)}
                        </span>
                        <p className="mt-1 text-muted-foreground">
                          {text("regulatory.released_a26679")}:{" "}
                          {version.release_date
                            ? formatDateOnly(version.release_date)
                            : "—"}{" "}
                          · {text("regulatory.support_ends_2409e2")}:{" "}
                          {version.support_ends_on
                            ? formatDateOnly(version.support_ends_on)
                            : text("regulatory.not_set_1e77c0")}
                        </p>
                      </div>
                      {permissions.canUpdate("gap-analysis") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVersionDialog({ product, version })}
                        >
                          {text("regulatory.review_version_711265")}
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </TabsContent>
      </Tabs>
      {productDialog && (
        <ProductDialog
          empresaId={w.empresaId}
          product={productDialog === "new" ? undefined : productDialog}
          people={people}
          onClose={() => setProductDialog(null)}
          onSaved={w.refresh}
        />
      )}
      {versionDialog && (
        <ProductVersionDialog
          empresaId={w.empresaId}
          {...versionDialog}
          onClose={() => setVersionDialog(null)}
          onSaved={w.refresh}
        />
      )}
      {wizard && frameworkVersion && (
        <AssessmentWizard
          empresaId={w.empresaId}
          products={products}
          versions={versions}
          frameworkVersionId={frameworkVersion.id}
          onClose={() => setWizard(false)}
          onCreated={async (id) => {
            await w.refresh();
            setWizard(false);
            navigate(`/gap-analysis/cra/${id}`);
          }}
        />
      )}
    </>
  );
}
function AssessmentView({
  assessmentId,
  workspace: w,
}: {
  assessmentId: string;
  workspace: Workspace;
}) {
  const query = useRegulatoryAssessment(w.empresaId, assessmentId);
  const library = useEvidenceLibrary(w.empresaId);
  const { text, label, locale } = useCraText();
  const permissions = usePermissions();
  const [selected, setSelected] = useState<string | null>(null);
  const [findingId, setFindingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [domain, setDomain] = useState("all");
  if (query.isPending) return <ModuleLoadingSkeleton />;
  if (query.isError || !query.data)
    return <QueryError onRetry={() => void query.refetch()} />;
  const data = query.data;
  const a = data.assessment;
  const product = w.data.products.find((p) => p.id === a.product_id)!;
  const version = w.data.versions.find((v) => v.id === a.product_version_id)!;
  const writable =
    permissions.canUpdate("gap-analysis") && a.status !== "archived";
  const metrics = regulatoryMetrics(
    data.items,
    data.links,
    data.findings,
    new Map(library.items.map((e) => [e.id, e.valido_ate])),
  );
  const filtered = data.items.filter(
    (i) =>
      (status === "all" || i.status === status) &&
      (domain === "all" || i.snapshot.domain === domain) &&
      matchesRegulatorySearch(
        search,
        i.snapshot.code,
        i.snapshot.title,
        i.snapshot.title_en,
        i.snapshot.domain_name,
        i.snapshot.domain_name_en,
        label(i.status),
      ),
  );
  const item = data.items.find((i) => i.id === selected);
  const finding = data.findings.find((f) => f.id === findingId);
  const refresh = async () => {
    await w.refresh();
  };
  const percent = (value: number | null) =>
    value === null ? "—" : `${value.toLocaleString(locale)}%`;
  return (
    <>
      <PageHeader
        title={a.name}
        description={`${product?.name ?? "—"} · ${version?.version ?? "—"} · ${label(a.classification)}`}
        actions={
          <ReportButton
            data={data}
            product={product}
            version={version}
            library={library}
            people={w.data.people}
          />
        }
      />
      {a.status === "archived" && (
        <p className="rounded-md border p-3 text-sm">
          {text(
            "regulatory.archived_assessment_available_for_viewing_and_re_883125",
          )}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            text("regulatory.cra_readiness_score_2575b7"),
            percent(metrics.score.score),
            text(
              "regulatory.assessed_answers_only_weighted_by_criticality_f508d3",
            ),
          ],
          [
            text("regulatory.assessment_coverage_465d85"),
            percent(metrics.score.assessmentCoverage),
            `${metrics.score.assessed} ${text("regulatory.assessed_3c5a57")} · ${metrics.score.pending} ${text("regulatory.pending_964e50")} · ${metrics.score.notApplicable} N/A`,
          ],
          [
            text("regulatory.evidence_coverage_61d923"),
            library.loading || library.loadError
              ? "—"
              : percent(metrics.evidenceCoverage),
            text(
              "regulatory.requirements_with_accepted_non_expired_evidence_a6929e",
            ),
          ],
          [
            text("regulatory.completed_remediations_d53e89"),
            `${metrics.remediationCompleted}/${metrics.remediationTotal}`,
            `${metrics.acceptedRisks} ${text("regulatory.accepted_risks_not_compliance_207491")}`,
          ],
        ].map(([title, value, hint]) => (
          <section key={title} className="rounded-lg border bg-card p-5">
            <h2 className="text-sm text-muted-foreground">{title}</h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </section>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {text(...readinessDisclaimer)}{" "}
        {text(
          "regulatory.weights_and_wording_are_preserved_from_the_catal_a5f7d3",
        )}
      </p>
      <Tabs defaultValue="requirements">
        <div>
          <TabsList>
            <TabsTrigger value="requirements">
              {text("regulatory.requirements_fb3777")}
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              {text("regulatory.domains_and_gaps_cc2722")}
            </TabsTrigger>
            <TabsTrigger value="findings">
              {text("regulatory.findings_and_actions_b1e48e")} (
              {data.findings.length})
            </TabsTrigger>
            <TabsTrigger value="sbom">SBOM</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
            <TabsTrigger value="scope">
              {text("regulatory.scope_and_decision_c71198")}
            </TabsTrigger>
            <TabsTrigger value="history">
              {text("regulatory.history_0d881a")}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="requirements">
          <DataTable
            data={filtered.map((i) => ({
              ...i,
              code: i.snapshot.code,
              title: locale === "en" ? i.snapshot.title_en : i.snapshot.title,
              domain_name:
                locale === "en"
                  ? i.snapshot.domain_name_en
                  : i.snapshot.domain_name,
            }))}
            searchValue={search}
            onSearchChange={setSearch}
            onRowClick={(i) => setSelected(i.id)}
            filters={[
              {
                key: "status",
                label: "Status",
                value: status,
                onChange: setStatus,
                options: [
                  { value: "all", label: text("regulatory.all_e2ad09") },
                  ...[
                    "nao_avaliado",
                    "conforme",
                    "parcial",
                    "nao_conforme",
                    "nao_aplicavel",
                  ].map((v) => ({ value: v, label: label(v) })),
                ],
              },
              {
                key: "domain",
                label: text("regulatory.domain_88958d"),
                value: domain,
                onChange: setDomain,
                options: [
                  { value: "all", label: text("regulatory.all_e2ad09") },
                  ...metrics.score.domains.map((d) => ({
                    value: d.domain,
                    label:
                      locale === "en"
                        ? data.items.find(
                            (i) => i.snapshot.domain === d.domain,
                          )!.snapshot.domain_name_en
                        : data.items.find(
                            (i) => i.snapshot.domain === d.domain,
                          )!.snapshot.domain_name,
                  })),
                ],
              },
            ]}
            columns={[
              { key: "code", label: text("regulatory.code_2668cb") },
              { key: "title", label: text("regulatory.requirement_19f5b3") },
              { key: "domain_name", label: text("regulatory.domain_88958d") },
              { key: "status", label: "Status", render: (v) => label(v) },
              {
                key: "evidence",
                label: text("regulatory.evidence_5c535f"),
                sortAccessor: (i) =>
                  data.links.filter((l) => l.item_id === i.id).length,
                render: (_, i) =>
                  data.links.filter((l) => l.item_id === i.id).length,
              },
              {
                key: "owner_id",
                label: text("regulatory.owner_865f50"),
                render: (v) =>
                  w.data.people.find((p) => p.id === v)?.nome ?? "—",
              },
              {
                key: "due_on",
                label: text("regulatory.due_date_e9acd5"),
                render: (v) => (v ? formatDateOnly(v) : "—"),
              },
            ]}
            onRefresh={() => void refresh()}
            emptyState={{
              title: text(
                "regulatory.no_requirements_match_these_filters_9087f6",
              ),
            }}
          />
        </TabsContent>
        <TabsContent value="dashboard" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {text("regulatory.completed_linked_actions_3953f7")}:{" "}
            {
              data.actions.filter((action) => action.status === "concluido")
                .length
            }
            /{data.actions.length}.{" "}
            {text(
              "regulatory.status_read_from_action_plans_completing_an_acti_8ce5f0",
            )}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(metrics.riskCounts).map(([risk, count]) => (
              <div key={risk} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  {text("regulatory.unresolved_findings_464a7c")} ·{" "}
                  {label(risk)}
                </p>
                <p className="mt-1 text-2xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metrics.score.domains.map((d) => {
              const sample = data.items.find(
                (i) => i.snapshot.domain === d.domain,
              )!;
              return (
                <section key={d.domain} className="rounded-lg border p-5">
                  <h3 className="font-semibold">
                    <LocalizedText
                      pt={sample.snapshot.domain_name}
                      en={sample.snapshot.domain_name_en}
                    />
                  </h3>
                  <div className="my-3 flex justify-between text-sm">
                    <span>{text("regulatory.readiness_cb68ed")}</span>
                    <strong>{percent(d.score)}</strong>
                  </div>
                  <Progress
                    value={d.score ?? 0}
                    aria-label={text("regulatory.domain_readiness_aac3c6")}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    {d.assessed}/{d.applicable}{" "}
                    {text("regulatory.assessed_3c5a57")} · {d.pending}{" "}
                    {text("regulatory.pending_964e50")} · {d.notApplicable} N/A
                  </p>
                </section>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="findings">
          <DataTable
            data={data.findings}
            searchable={false}
            onRowClick={(f) => setFindingId(f.id)}
            columns={[
              { key: "title", label: text("regulatory.finding_f74419") },
              {
                key: "risk",
                label: text("regulatory.risk_9994f1"),
                render: (v) => label(v),
              },
              {
                key: "status",
                label: text("regulatory.stage_b12516"),
                render: (v) => label(v),
              },
              {
                key: "owner_id",
                label: text("regulatory.owner_865f50"),
                render: (v) =>
                  w.data.people.find((p) => p.id === v)?.nome ?? "—",
              },
              {
                key: "due_on",
                label: text("regulatory.due_date_e9acd5"),
                render: (v) => (v ? formatDateOnly(v) : "—"),
              },
              {
                key: "action_plan_id",
                label: text("regulatory.action_plan_90020b"),
                render: (v) =>
                  v ? (
                    <Link
                      className="text-primary underline"
                      to={`/planos-acao?plano=${v}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {text("regulatory.open_action_7ac64d")}
                      {data.actions.find((action) => action.id === v) && (
                        <>
                          {" "}
                          ·{" "}
                          {label(
                            data.actions.find((action) => action.id === v)!
                              .status,
                          )}
                        </>
                      )}
                    </Link>
                  ) : (
                    text("regulatory.not_created_4e0f40")
                  ),
              },
            ]}
            emptyState={{
              title: text("regulatory.no_findings_recorded_9db873"),
              description: text(
                "regulatory.partial_or_non_compliant_answers_create_findings_49e8fc",
              ),
            }}
          />
        </TabsContent>
        <TabsContent value="sbom">
          <SbomPanel
            assessment={a}
            sboms={data.sboms}
            library={library}
            writable={writable && permissions.canCreate("gap-analysis")}
            onSaved={refresh}
          />
        </TabsContent>
        <TabsContent value="reporting">
          <ReportingPanel
            workflows={data.reporting}
            writable={writable}
            onSaved={refresh}
          />
        </TabsContent>
        <TabsContent value="scope">
          <ScopePanel
            key={a.updated_at}
            assessment={a}
            writable={permissions.canUpdate("gap-analysis")}
            onSaved={refresh}
          />
        </TabsContent>
        <TabsContent value="history">
          <p className="mb-4 text-sm text-muted-foreground">
            {text(
              "regulatory.latest_100_events_for_this_product_including_oth_5b8455",
            )}
          </p>
          <DataTable
            data={data.history}
            searchable={false}
            columns={[
              {
                key: "created_at",
                label: text("regulatory.date_7dce99"),
                render: (v) => new Date(v).toLocaleString(locale),
              },
              { key: "entity_type", label: text("regulatory.record_8a96e6") },
              { key: "action", label: text("regulatory.operation_9d1ffc") },
              {
                key: "actor_id",
                label: text("regulatory.actor_146383"),
                render: (v) =>
                  w.data.people.find((p) => p.user_id === v)?.nome ??
                  text("regulatory.historical_user_system_3737d8"),
              },
              {
                key: "changed_fields",
                label: text("regulatory.changed_fields_242138"),
                render: (v) => v?.join(", ") || "—",
              },
            ]}
          />
        </TabsContent>
      </Tabs>
      {item && (
        <RequirementDialog
          key={item.id}
          item={item}
          links={data.links.filter((l) => l.item_id === item.id)}
          people={w.data.people}
          library={library}
          writable={writable}
          onClose={() => setSelected(null)}
          onSaved={refresh}
        />
      )}
      {finding && (
        <FindingDialog
          key={finding.id}
          finding={finding}
          people={w.data.people}
          writable={writable}
          canCreateAction={permissions.canCreate("planos-acao")}
          onClose={() => setFindingId(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
