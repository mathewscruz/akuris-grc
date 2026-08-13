import { Sparkles, AlertTriangle, ShieldCheck, FileText, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface QuickPrompt {
  icon: React.ComponentType<{ className?: string }>;
  /** Chave em dashWidgets.akuria.qp.* */
  key: string;
}

const PROMPTS_BY_ROUTE: Record<string, QuickPrompt[]> = {
  "/dashboard": [
    { icon: BarChart3, key: "executiveSummary" },
    { icon: AlertTriangle, key: "criticalRisks" },
    { icon: ShieldCheck, key: "complianceMaturity" },
    { icon: Zap, key: "topActions" },
  ],
  "/riscos": [
    { icon: AlertTriangle, key: "untreatedRisks" },
    { icon: BarChart3, key: "riskDistribution" },
    { icon: Sparkles, key: "suggestTreatments" },
    { icon: Zap, key: "newRisk" },
  ],
  "/incidentes": [
    { icon: AlertTriangle, key: "openIncidents" },
    { icon: BarChart3, key: "trends" },
    { icon: Zap, key: "newIncident" },
    { icon: ShieldCheck, key: "lessonsLearned" },
  ],
  "/governanca": [
    { icon: ShieldCheck, key: "controlsDue" },
    { icon: BarChart3, key: "controlEffectiveness" },
    { icon: AlertTriangle, key: "pendingAudits" },
  ],
  "/documentos": [
    { icon: FileText, key: "expiredDocs" },
    { icon: Sparkles, key: "docCoverage" },
  ],
  "/contratos": [
    { icon: FileText, key: "expiringContracts" },
    { icon: BarChart3, key: "contractValue" },
  ],
  "/planos-acao": [
    { icon: Zap, key: "latePlans" },
    { icon: AlertTriangle, key: "highPriorityPlans" },
  ],
};

const FALLBACK: QuickPrompt[] = PROMPTS_BY_ROUTE["/dashboard"];

interface Props {
  route: string;
  onPick: (prompt: string) => void;
}

export function AkurIAQuickPrompts({ route, onPick }: Props) {
  const { t } = useLanguage();
  // Match por prefixo (ex: /riscos/123 -> /riscos)
  const matched = Object.keys(PROMPTS_BY_ROUTE).find((key) => route.startsWith(key));
  const prompts = matched ? PROMPTS_BY_ROUTE[matched] : FALLBACK;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
      {prompts.map((p, i) => {
        const Icon = p.icon;
        return (
          <Button
            key={i}
            variant="outline"
            size="sm"
            onClick={() => onPick(t(`dashWidgets.akuria.qp.${p.key}.prompt`))}
            className="h-auto py-2 px-3 justify-start text-left whitespace-normal hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <Icon className="h-3.5 w-3.5 text-primary shrink-0 mr-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs leading-tight text-foreground">
              {t(`dashWidgets.akuria.qp.${p.key}.label`)}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
