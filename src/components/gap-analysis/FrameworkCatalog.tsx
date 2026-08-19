import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FrameworkCard } from './FrameworkCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategory, CATEGORIAS_DE_FRAMEWORK } from '@/lib/gap-analysis-tokens';
import { IconChevronDown, IconShield, IconLock, IconScale, IconOrg, IconWarning, IconChecklist, IconLeaf } from '@/components/icons';

interface Framework {
  id: string;
  nome: string;
  versao: string;
  tipo_framework: string;
  descricao?: string;
}

interface FrameworkCatalogProps {
  frameworks: Framework[];
  requirementCounts: Record<string, number>;
  onFrameworkClick: (fw: Framework) => void;
}

const CATEGORY_CONFIG: Record<string, { labelKey: string; icon: React.ElementType; color: string }> = {
  seguranca: { labelKey: 'gapAnalysis.catalog.category.seguranca', icon: IconShield, color: 'text-info' },
  privacidade: { labelKey: 'gapAnalysis.catalog.category.privacidade', icon: IconLock, color: 'text-success' },
  risco: { labelKey: 'gapAnalysis.catalog.category.risco', icon: IconWarning, color: 'text-warning' },
  governanca: { labelKey: 'gapAnalysis.catalog.category.governanca', icon: IconOrg, color: 'text-primary' },
  compliance: { labelKey: 'gapAnalysis.catalog.category.compliance', icon: IconScale, color: 'text-info' },
  qualidade: { labelKey: 'gapAnalysis.catalog.category.qualidade', icon: IconChecklist, color: 'text-warning' },
  ambiente: { labelKey: 'gapAnalysis.catalog.category.ambiente', icon: IconLeaf, color: 'text-success' },
};

export function FrameworkCatalog({ frameworks, requirementCounts, onFrameworkClick }: FrameworkCatalogProps) {
  const { t } = useLanguage();
  const [openCategories, setOpenCategories] = useState<string[]>([...CATEGORIAS_DE_FRAMEWORK]);

  const grouped = useMemo(() => {
    const groups: Record<string, Framework[]> = {};
    frameworks.forEach(fw => {
      const cat = getCategory(fw.tipo_framework);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(fw);
    });
    return groups;
  }, [frameworks]);

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const categoryOrder = CATEGORIAS_DE_FRAMEWORK;

  return (
    <div className="space-y-3">
      {categoryOrder.map(catKey => {
        const fws = grouped[catKey];
        if (!fws || fws.length === 0) return null;
        const cfg = CATEGORY_CONFIG[catKey];
        const Icon = cfg.icon;
        const isOpen = openCategories.includes(catKey);

        return (
          <Collapsible key={catKey} open={isOpen} onOpenChange={() => toggleCategory(catKey)}>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 px-4 hover:bg-accent/50 rounded-none"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} strokeWidth={1.5} />
                    <span className="font-semibold text-sm">{t(cfg.labelKey)}</span>
                    <Badge variant="secondary" className="text-xs">{fws.length}</Badge>
                  </div>
                  <IconChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/40 bg-muted/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                    {fws.map(fw => (
                      <FrameworkCard
                        key={fw.id}
                        id={fw.id}
                        nome={fw.nome}
                        versao={fw.versao}
                        tipo_framework={fw.tipo_framework}
                        descricao={fw.descricao}
                        requirementCount={requirementCounts[fw.id] || 0}
                        onClick={() => onFrameworkClick(fw)}
                      />
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

export { CATEGORY_CONFIG };
