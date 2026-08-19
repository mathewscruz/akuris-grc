import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FrameworkLogo } from "./FrameworkLogos";
import {
  CATEGORY_BADGE_CLASS,
  getEffortLevel,
  type FrameworkCategory,
} from "@/lib/gap-analysis-tokens";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconArrowRight, IconShield, IconLock, IconScale, IconOrg } from '@/components/icons';

interface FrameworkCardProps {
  id: string;
  nome: string;
  versao: string;
  tipo_framework: string;
  descricao?: string;
  requirementCount: number;
  onClick: () => void;
}

const CATEGORY_ICON: Record<FrameworkCategory, React.ElementType> = {
  seguranca: IconShield,
  privacidade: IconLock,
  governanca: IconOrg,
  qualidade: IconScale,
};

const FRAMEWORK_AUDIENCE_KEYS: Record<string, string> = {
  'ISO 27001': 'iso27001Short',
  'LGPD': 'lgpdShort',
  'NIST CSF 2.0': 'nistCsfShort',
  'ISO 27701': 'iso27701Short',
  'PCI DSS': 'pciDssShort',
  'SOC 2': 'soc2Short',
  'GDPR': 'gdprShort',
  'ISO 22301': 'iso22301Short',
  'COBIT': 'cobitShort',
  'CIS Controls': 'cisControlsShort',
  'ISO 9001': 'iso9001Short',
  'HIPAA': 'hipaaShort',
};

function getCategory(tipo: string): FrameworkCategory {
  const t = tipo?.toLowerCase() || '';
  if (t.includes('privacidade') || t.includes('privacy') || t.includes('lgpd') || t.includes('gdpr')) return 'privacidade';
  if (t.includes('governanca') || t.includes('governance') || t.includes('cobit') || t.includes('sox')) return 'governanca';
  if (t.includes('qualidade') || t.includes('quality') || t.includes('iso 9') || t.includes('itil')) return 'qualidade';
  return 'seguranca';
}

export const FrameworkCard: React.FC<FrameworkCardProps> = (props) => {
  const { t } = useLanguage();
  const {
  nome,
  versao,
  tipo_framework,
  descricao,
  requirementCount,
  onClick,
  } = props;
  // Available variant - compact card with category tag and effort
  const cat = getCategory(tipo_framework);
  const CategoryIcon = CATEGORY_ICON[cat];
  const effort = getEffortLevel(requirementCount);
  const audience = FRAMEWORK_AUDIENCE_KEYS[nome];

  return (
    <Card
      className="group hover:shadow-elegant hover:border-primary/30 transition-ui duration-200 cursor-pointer h-full flex flex-col"
      onClick={onClick}
    >
      <div className="p-3 pb-0">
        <Badge variant="outline" className={`text-micro px-1.5 py-0 inline-flex items-center gap-1 ${CATEGORY_BADGE_CLASS[cat]}`}>
          <CategoryIcon className="h-2.5 w-2.5" strokeWidth={1.5} />
          {t(`gapAnalysis.frameworks.category.${cat}`)}
        </Badge>
      </div>

      <div className="flex justify-center pt-3 pb-2">
        <FrameworkLogo nome={nome} className="h-10 w-10" />
      </div>

      <div className="text-center px-3 pb-1">
        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
          {nome}
        </h3>
        <span className="text-xs text-muted-foreground">{versao}</span>
      </div>

      <div className="flex-1 px-3 py-1">
        <p className="text-xs text-muted-foreground text-center line-clamp-2">
          {(audience && t(`gapAnalysis.frameworkAudienceShort.${audience}`)) || descricao || t('gapAnalysis.genericComplianceFramework')}
        </p>
      </div>

      <div className="px-3 py-2 flex items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground">{t('gapAnalysis.card.requirementsCount', { count: requirementCount })}</span>
        <span className="text-muted-foreground">·</span>
        <Badge variant={effort.variant} className="text-micro px-1.5 py-0">
          {t('gapAnalysis.card.effort', { label: effort.label })}
        </Badge>
      </div>

      <div className="flex justify-center p-3 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          {t('gapAnalysis.card.startAssessment')}
          <IconArrowRight className="h-4 w-4 ml-1" strokeWidth={1.5} />
        </Button>
      </div>
    </Card>
  );
};
