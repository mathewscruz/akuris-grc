import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Shield, Lock, Scale, Building2 } from 'lucide-react';
import { FrameworkCard } from './FrameworkCard';
import { useLanguage } from '@/contexts/LanguageContext';

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
  seguranca: { labelKey: 'gapAnalysis.catalog.category.seguranca', icon: Shield, color: 'text-blue-600 bg-blue-100 border-blue-200' },
  privacidade: { labelKey: 'gapAnalysis.catalog.category.privacidade', icon: Lock, color: 'text-emerald-600 bg-emerald-100 border-emerald-200' },
  qualidade: { labelKey: 'gapAnalysis.catalog.category.qualidade', icon: Scale, color: 'text-amber-600 bg-amber-100 border-amber-200' },
  governanca: { labelKey: 'gapAnalysis.catalog.category.governanca', icon: Building2, color: 'text-purple-600 bg-purple-100 border-purple-200' },
};

function getCategory(tipo: string): string {
  const t = tipo?.toLowerCase() || '';
  if (t.includes('privacidade') || t.includes('privacy') || t.includes('lgpd') || t.includes('gdpr')) return 'privacidade';
  if (t.includes('governanca') || t.includes('governance') || t.includes('cobit') || t.includes('sox')) return 'governanca';
  if (t.includes('qualidade') || t.includes('quality') || t.includes('iso 9') || t.includes('itil')) return 'qualidade';
  return 'seguranca';
}

export function FrameworkCatalog({ frameworks, requirementCounts, onFrameworkClick }: FrameworkCatalogProps) {
  const { t } = useLanguage();
  const [openCategories, setOpenCategories] = useState<string[]>(['seguranca', 'privacidade', 'governanca', 'qualidade']);

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

  const categoryOrder = ['seguranca', 'privacidade', 'governanca', 'qualidade'];

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
                    <div className={`p-1.5 rounded-md border ${cfg.color}`}>
                      <Icon className="h-4 w-4" strokeWidth={1.5}/>
                    </div>
                    <span className="font-semibold text-sm">{t(cfg.labelKey)}</span>
                    <Badge variant="secondary" className="text-xs">{fws.length}</Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
                        variant="available"
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

export { getCategory, CATEGORY_CONFIG };
