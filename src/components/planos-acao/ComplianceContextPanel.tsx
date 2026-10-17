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
import { capitalizeText } from "@/lib/text-utils";
import { cn } from "@/lib/utils";
import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { IconRefresh, IconArrowRight } from "@/components/icons";
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
  const fmt = (value: unknown) =>
    value === null || value === undefined
      ? "—"
      : typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
      ? formatDateOnly(value)
      : typeof value === "string"
      ? capitalizeText(value.replace(/_/g, " "))
      : String(value);

  return (
    <section className="space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t("evidenceIntelligence.context")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("evidenceIntelligence.contextHint")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {query.data && (
            <span className="text-xs text-muted-foreground" title={query.data.rule_version}>
              {t("evidenceIntelligence.checkedAt").replace("{date}", formatDateOnly(query.data.checked_at))}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("evidenceIntelligence.refresh")}
            title={t("evidenceIntelligence.refresh")}
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <IconRefresh className={cn("h-4 w-4", query.isFetching && "opacity-50")} />
          </Button>
        </div>
      </header>

      {query.isPending ? (
        <div role="status" className="flex justify-center py-10"><AkurisPulse size={40} /></div>
      ) : query.isError ? (
        <p role="alert" className="border-t py-6 text-sm text-destructive">{t("evidenceIntelligence.readError")}</p>
      ) : (
        <>
          {!query.data.items.length && (
            <p className="border-t py-6 text-sm text-muted-foreground">{t("evidenceIntelligence.empty")}</p>
          )}
          <ul className="divide-y border-y">
            {query.data.items.map((item) => {
              const origin = contextAction(item);
              const explanation = t(`evidenceIntelligence.rules.${item.rule}`);
              const sources = item.sources.filter((s) => safeContextPath(s.path));
              const facts = Object.entries(item.facts);
              return (
                <li
                  key={item.key}
                  className={cn(
                    "grid gap-3 border-l-[3px] py-3.5 pl-4 pr-2 transition-colors hover:bg-accent md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-6",
                    origin?.prioridade === "alta" ? "border-l-warning" : "border-l-border",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate text-sm font-medium">{item.title}</h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground" title={explanation}>{explanation}</p>
                    {sources.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("evidenceIntelligence.sourcesLabel")}:{" "}
                        {sources.map((s, i) => (
                          <span key={i}>
                            {i > 0 && ", "}
                            <Link className="text-primary hover:underline" to={s.path}>{s.label}</Link>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:max-w-md md:justify-end">
                    {facts.map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <dt className="text-muted-foreground">{t(`evidenceIntelligence.facts.${key}`)}</dt>
                        <dd className="font-medium tabular-nums text-foreground">{fmt(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  {origin ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto justify-start gap-1 px-0 md:justify-end"
                      onClick={() =>
                        onDraft(origin, {
                          titulo: item.title,
                          prioridade: origin.prioridade,
                          descricao: `${explanation}\n\n${
                            facts.map(([k, v]) => `${t(`evidenceIntelligence.facts.${k}`)}: ${v ?? "—"}`).join("\n")
                          }\n\n${item.sources.map((s) => s.label).join(" · ")}\n${t("evidenceIntelligence.human")}`,
                        })}
                    >
                      {t("gapUi.detail.createActionPlan")}
                      <IconArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  ) : <span />}
                </li>
              );
            })}
          </ul>
          {query.data.limited && <p className="text-xs text-warning">{t("evidenceIntelligence.partial")}</p>}
        </>
      )}
    </section>
  );
}
