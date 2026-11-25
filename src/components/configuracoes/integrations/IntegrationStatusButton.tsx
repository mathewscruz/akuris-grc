import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export type IntegrationState = "disconnected" | "connected" | "attention" | "error" | "unavailable";

const DOT: Record<string, string> = {
  connected: "bg-success",
  attention: "bg-warning",
  error: "bg-destructive",
};

/** The single place a card shows its connection status: label and dot follow the state. */
export function IntegrationStatusButton({
  state, name, onClick, title,
}: { state: IntegrationState; name: string; onClick?: () => void; title?: string }) {
  const { t } = useLanguage();
  const label = {
    disconnected: t("collectionHub.connect"),
    connected: t("collectionHub.conectadas.conectado"),
    attention: t("collectionHub.btnReview"),
    error: t("collectionHub.btnFix"),
    unavailable: t("collectionHub.comingSoon"),
  }[state];
  return (
    <Button
      variant={state === "unavailable" ? "secondary" : "outline"}
      size="sm"
      className={cn("self-start gap-2", state === "unavailable" && "disabled:opacity-100")}
      disabled={state === "unavailable"}
      onClick={onClick}
      title={title}
      aria-label={`${name}: ${label}`}
      data-state={state}
    >
      {DOT[state] && <span aria-hidden className={cn("h-2 w-2 rounded-full", DOT[state])} />}
      {label}
    </Button>
  );
}
