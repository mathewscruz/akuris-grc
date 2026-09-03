import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FrameworkLogo } from "./FrameworkLogos";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconArrowRight } from '@/components/icons';

interface FrameworkCardProps {
  id: string;
  nome: string;
  versao: string;
  tipo_framework: string;
  descricao?: string;
  requirementCount: number;
  onClick: () => void;
}

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
  const audience = FRAMEWORK_AUDIENCE_KEYS[nome];

  return (
    <Card
      className="group hover:shadow-elegant hover:border-primary/30 transition-ui duration-200 cursor-pointer h-full flex flex-col"
      onClick={onClick}
    >
      <div className="flex justify-center pt-4 pb-2">
        <FrameworkLogo nome={nome} tipo={tipo_framework} className="h-14 w-14" />
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
