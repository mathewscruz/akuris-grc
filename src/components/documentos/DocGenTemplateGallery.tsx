import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, FilePlus2 } from 'lucide-react';
import {
  DOCGEN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type DocGenTemplate,
} from '@/lib/docgen-templates';
import { cn } from '@/lib/utils';

interface DocGenTemplateGalleryProps {
  onPickTemplate: (template: DocGenTemplate) => void;
  onStartBlank: () => void;
}

const ALL_CATEGORY = 'todos';

export const DocGenTemplateGallery: React.FC<DocGenTemplateGalleryProps> = ({
  onPickTemplate,
  onStartBlank,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return DOCGEN_TEMPLATES.filter((tpl) => {
      const matchesCategory =
        activeCategory === ALL_CATEGORY || tpl.category === activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        tpl.label.toLowerCase().includes(term) ||
        tpl.description.toLowerCase().includes(term) ||
        tpl.briefingDefaults.frameworks.some((f) =>
          f.toLowerCase().includes(term),
        )
      );
    });
  }, [search, activeCategory]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Passo 1 de 3 · Começar a partir de
            </p>
            <h3 className="text-lg font-semibold mt-1">
              Escolha um modelo ou comece do zero
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cada modelo já vem com tipo, escopo e frameworks pré-preenchidos —
              você ainda revisa antes de gerar.
            </p>
          </div>
          <Button variant="outline" onClick={onStartBlank} className="gap-2 shrink-0">
            <FilePlus2 className="h-4 w-4" strokeWidth={1.5} />
            Começar do zero
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, descrição ou framework (ex.: ISO 27001, LGPD)"
            className="pl-9"
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory(ALL_CATEGORY)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              activeCategory === ALL_CATEGORY
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-primary/30',
            )}
          >
            Todos
          </button>
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-primary/30',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum modelo encontrado para sua busca.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <Card
                  key={tpl.id}
                  className="group cursor-pointer transition-all hover:border-primary/40 hover:shadow-elegant"
                  onClick={() => onPickTemplate(tpl)}
                >
                  <CardContent className="p-4 flex flex-col h-full gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold leading-tight">
                          {tpl.label}
                        </h4>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      {tpl.description}
                    </p>
                    {tpl.briefingDefaults.frameworks.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tpl.briefingDefaults.frameworks.map((fw) => (
                          <Badge key={fw} variant="secondary" className="text-[10px] py-0 h-4">
                            {fw}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-end text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Usar este modelo
                      <ArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocGenTemplateGallery;
