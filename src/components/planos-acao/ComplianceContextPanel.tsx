import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  contextAction,
  type ContextSignal,
  safeContextPath,
} from "@/lib/compliance-context";
import { formatDateOnly } from "@/lib/date-utils";
export function ComplianceContextPanel(
  { onDraft }: {
    onDraft: (
      origin: NonNullable<ReturnType<typeof contextAction>>,
      draft: { titulo: string; descricao: string; prioridade: "alta" | "media" },
    ) => void;
  },
) {
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const query = useQuery({
    queryKey: ["compliance-module-context", empresaId],
    enabled: !!empresaId,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "compliance_module_context",
      );
      if (error || !data) throw error || new Error("missing_context");
      return data as unknown as {
        items: ContextSignal[];
        limited: boolean;
        checked_at: string;
        rule_version: string;
      };
    },
  });
  return (
    <section className="rounded-lg border bg-background p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {t("evidenceIntelligence.context")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("evidenceIntelligence.contextHint")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {t("evidenceIntelligence.refresh")}
        </Button>
      </div>
      {query.isPending
        ? <p role="status">…</p>
        : query.isError
        ? <p role="alert">{t("evidenceIntelligence.readError")}</p>
        : (
          <>
            <p className="text-xs text-muted-foreground">
              {formatDateOnly(query.data.checked_at)} ·{" "}
              {query.data.rule_version}
            </p>
            {!query.data.items.length && (
              <p className="py-6 text-sm text-muted-foreground">
                {t("evidenceIntelligence.empty")}
              </p>
            )}
            <div className="divide-y">
              {query.data.items.map((item) => {
                const origin = contextAction(item);
                const explanation = t(
                  `evidenceIntelligence.rules.${item.rule}`,
                );
                return (
                  <article key={item.key} className="py-4 space-y-2">
                    <h3 className="text-sm font-medium">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {explanation}
                    </p>
                    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                      {Object.entries(item.facts).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-muted-foreground">
                            {t(`evidenceIntelligence.facts.${key}`)}
                          </dt>
                          <dd className="mt-1">
                            {value === null ? "—" : typeof value === "string" &&
                                /^\d{4}-\d{2}-\d{2}/.test(value)
                              ? formatDateOnly(value)
                        : String(value).replace(/_/g, " ")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {item.sources.map((source, i) =>
                        safeContextPath(source.path) && (
                          <Link
                            key={i}
                            className="text-xs text-primary hover:underline"
                            to={source.path}
                          >
                            {source.label}
                          </Link>
                        )
                      )}
                      {origin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onDraft(origin, {
                              titulo: item.title,
                              prioridade: origin.prioridade,
                              descricao: `${explanation}\n\n${
                                Object.entries(item.facts).map(([k, v]) =>
                                  `${t(`evidenceIntelligence.facts.${k}`)}: ${
                                    v ?? "—"
                                  }`
                                ).join("\n")
                              }\n\n${
                                item.sources.map((s) => s.label).join(" · ")
                              }\n${t("evidenceIntelligence.human")}`,
                            })}
                        >
                          {t("gapUi.detail.createActionPlan")}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {query.data.limited && (
              <p className="text-xs text-warning">
                {t("evidenceIntelligence.partial")}
              </p>
            )}
          </>
        )}
    </section>
  );
}
