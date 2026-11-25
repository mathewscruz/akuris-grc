import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconEdit } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { IntegrationState } from "./IntegrationStatusButton";

const DOT: Record<IntegrationState, string> = {
  connected: "bg-success",
  attention: "bg-warning",
  error: "bg-destructive",
  disconnected: "bg-muted-foreground/50",
  unavailable: "bg-muted-foreground/30",
};

/** Shared integration card: logo, name, category chip, status dot + text and a two-column footer. */
export function IntegrationCard({
  logo, name, category, description, state, modules, lastRun, onOpen, extra,
}: {
  logo: ReactNode; name: string; category: string; description?: string; state: IntegrationState;
  modules?: string; lastRun?: string; onOpen?: () => void; extra?: ReactNode;
}) {
  const { t } = useLanguage();
  const label = {
    connected: t("collectionHub.conectadas.conectado"),
    attention: t("collectionHub.btnReview"),
    error: t("collectionHub.cardFailed"),
    disconnected: t("collectionHub.cardNotConnected"),
    unavailable: t("collectionHub.comingSoon"),
  }[state];
  const clickable = state !== "unavailable" && !!onOpen;
  return (
    <article
      data-state={state}
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-5 transition-colors",
        clickable && "cursor-pointer hover:border-primary/40",
        state === "unavailable" && "opacity-70",
      )}
      onClick={clickable ? onOpen : undefined}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center">{logo}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h4 className="truncate pr-8 font-semibold" title={description}>{name}</h4>
          <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{category}</span>
          <p className="flex items-center gap-2 text-sm">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", DOT[state])} />
            <span className={cn(state === "error" && "text-destructive")}>{label}</span>
          </p>
        </div>
        {clickable && (
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`${name}: ${t("collectionHub.cardEdit")}`}
            onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
          >
            <IconEdit className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("collectionHub.cardModules")}</p>
          <p className="mt-1 truncate">{modules || "—"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("collectionHub.cardLastRun")}</p>
          <p className="mt-1 truncate">{lastRun || "—"}</p>
        </div>
      </div>
      {extra && <div className="mt-4" onClick={(e) => e.stopPropagation()}>{extra}</div>}
    </article>
  );
}
