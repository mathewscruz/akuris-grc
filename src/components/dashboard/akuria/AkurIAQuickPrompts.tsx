import { AkurisAIIcon, IconWarning, IconFile, IconShieldCheck, IconChart, IconBolt } from '@/components/icons';
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface QuickPrompt {
  icon: React.ComponentType<{ className?: string }>;
  /** Chave em dashWidgets.akuria.qp.* */
  key: string;
}

const PROMPTS_BY_ROUTE: Record<string, QuickPrompt[]> = {
  "/dashboard": [
    { icon: IconChart, key: "executiveSummary" },
    { icon: IconWarning, key: "criticalRisks" },
    { icon: IconShieldCheck, key: "complianceMaturity" },
    { icon: IconBolt, key: "topActions" },
  ],
  "/riscos": [
    { icon: IconWarning, key: "untreatedRisks" },
    { icon: IconChart, key: "riskDistribution" },
    { icon: AkurisAIIcon, key: "suggestTreatments" },
    { icon: IconBolt, key: "newRisk" },
  ],
  "/incidentes": [
    { icon: IconWarning, key: "openIncidents" },
    { icon: IconChart, key: "trends" },
    { icon: IconBolt, key: "newIncident" },
    { icon: IconShieldCheck, key: "lessonsLearned" },
  ],
  "/governanca": [
    { icon: IconShieldCheck, key: "controlsDue" },
    { icon: IconChart, key: "controlEffectiveness" },
    { icon: IconWarning, key: "pendingAudits" },
  ],
  "/documentos": [
    { icon: IconFile, key: "expiredDocs" },
    { icon: AkurisAIIcon, key: "docCoverage" },
  ],
  "/contratos": [
    { icon: IconFile, key: "expiringContracts" },
    { icon: IconChart, key: "contractValue" },
  ],
  "/planos-acao": [
    { icon: IconBolt, key: "latePlans" },
    { icon: IconWarning, key: "highPriorityPlans" },
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
            className="h-auto py-2 px-3 justify-start text-left whitespace-normal hover:border-primary/40 hover:bg-primary/5 transition-ui group"
          >
            <Icon className="h-3.5 w-3.5 text-primary shrink-0 mr-2" />
            <span className="text-xs leading-tight text-foreground">
              {t(`dashWidgets.akuria.qp.${p.key}.label`)}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
