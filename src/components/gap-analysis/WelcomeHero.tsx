import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FrameworkLogo } from './FrameworkLogos';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconArrowRight } from '@/components/icons';

interface SuggestedFramework {
  id: string;
  nome: string;
  versao: string;
  descricao?: string;
  tipo_framework: string;
}

interface WelcomeHeroProps {
  onFrameworkClick: (id: string) => void;
  onShowCatalog: () => void;
  suggestedFrameworks: SuggestedFramework[];
}

const FRAMEWORK_AUDIENCE_KEYS: Record<string, string> = {
  'ISO 27001': 'iso27001',
  'LGPD': 'lgpd',
  'NIST CSF 2.0': 'nistCsf',
  'ISO 27701': 'iso27701',
  'PCI DSS': 'pciDss',
  'SOC 2': 'soc2',
  'NIST SP 800-82': 'nistSp80082',
  'DORA': 'dora',
  'ISO/IEC 62443': 'iso62443',
};

export function WelcomeHero({ onFrameworkClick, onShowCatalog, suggestedFrameworks }: WelcomeHeroProps) {
  const { t } = useLanguage();
  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-xs">{t('gapAnalysis.welcome.badge')}</Badge>
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-2">
          {t('gapAnalysis.welcome.title')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xl">
          {t('gapAnalysis.welcome.description')}
        </p>

        {/* Frameworks recomendados — destaque principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {suggestedFrameworks.slice(0, 3).map((fw) => (
            <Card
              key={fw.id}
              className="group p-4 cursor-pointer hover:shadow-sm hover:border-primary/40 transition-ui bg-background"
              onClick={() => onFrameworkClick(fw.id)}
            >
              <div className="flex items-start gap-3">
                <FrameworkLogo nome={fw.nome} tipo={fw.tipo_framework} className="h-10 w-10 shrink-0 mt-0.5"/>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                    {fw.nome}
                  </h3>
                  <span className="text-xs text-muted-foreground">{fw.versao}</span>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {(FRAMEWORK_AUDIENCE_KEYS[fw.nome] && t(`gapAnalysis.frameworkAudience.${FRAMEWORK_AUDIENCE_KEYS[fw.nome]}`)) || fw.descricao || t('gapAnalysis.genericComplianceFramework')}
                  </p>
                </div>
                <IconArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" strokeWidth={1.5}/>
              </div>
            </Card>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={onShowCatalog}>
          {t('gapAnalysis.welcome.viewAll')}
          <IconArrowRight className="h-4 w-4 ml-1" strokeWidth={1.5}/>
        </Button>
      </div>
    </Card>
  );
}
