import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconEdit } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IntegrationState } from "./IntegrationStatusButton";

const BAND: Record<IntegrationState, string> = {
  connected: "bg-success",
  attention: "bg-warning",
  error: "bg-destructive",
  disconnected: "bg-border",
  unavailable: "bg-border",
};

const DOT: Record<IntegrationState, string> = {
  connected: "bg-success",
  attention: "bg-warning",
  error: "bg-destructive",
  disconnected: "bg-muted-foreground/50",
  unavailable: "bg-muted-foreground/30",
};

/** Shared integration card: logo, name, category chip, status dot + text and a two-column footer. */
export function IntegrationCard({
  logo, name, category, description, state, modules, lastRun, onOpen, onEdit, extra,
}: {
  logo: ReactNode; name: string; category: string; description?: string; state: IntegrationState;
  modules?: string; lastRun?: string; onOpen?: () => void; onEdit?: () => void; extra?: ReactNode;
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
        "relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors dark:shadow-none",
        clickable && "cursor-pointer hover:border-primary/40",
        state === "unavailable" && "opacity-70",
      )}
      onClick={clickable ? onOpen : undefined}
    >
      <span aria-hidden className={cn("h-1 w-full", BAND[state])} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">{logo}</span>
          <div className="min-w-0 flex-1">
            <h4 className={cn("truncate font-semibold", onEdit && "pr-8")}>{name}</h4>
            {description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground" title={description}>{description}</p>}
          </div>
          {onEdit && (
            <button
              type="button"
              className="absolute right-4 top-5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`${name}: ${label}`}
              title={t("collectionHub.cardEdit")}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <IconEdit className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{category}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[state])} />
            <span className={cn(state === "error" && "text-destructive")}>{label}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t bg-muted/40 px-5 py-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t("collectionHub.cardLastRun")}</p>
          <p className="mt-0.5 truncate">{lastRun || "—"}</p>
        </div>
        {state === "unavailable" && (
          <Button size="sm" variant="outline" disabled>{t("collectionHub.comingSoon")}</Button>
        )}
        {!extra && state === "disconnected" && onOpen && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onOpen(); }}>{t("collectionHub.connect")}</Button>
        )}
        {extra && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>{extra}</div>}
      </div>
    </article>
  );
}

