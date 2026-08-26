import { matchesSearch } from '@/lib/search-utils';
import { IconSearch, IconArrowRight, IconAdd } from '@/components/icons';
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DOCGEN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type DocGenTemplate,
} from '@/lib/docgen-templates';
import { cn } from '@/lib/utils';
import { rowOpenProps, CARD_HOVER } from '@/lib/row-interaction';
import { useLanguage } from '@/contexts/LanguageContext';

interface DocGenTemplateGalleryProps {
  onPickTemplate: (template: DocGenTemplate) => void;
  onStartBlank: () => void;
}

const ALL_CATEGORY = 'todos';

export const DocGenTemplateGallery: React.FC<DocGenTemplateGalleryProps> = ({
  onPickTemplate,
  onStartBlank,
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);

  const filtered = useMemo(() => {
    return DOCGEN_TEMPLATES.filter((tpl) => {
      const matchesCategory =
        activeCategory === ALL_CATEGORY || tpl.category === activeCategory;
      if (!matchesCategory) return false;
      return matchesSearch(
        search,
        tpl.label,
        tpl.description,
        tpl.briefingDefaults.frameworks.join(' '),
      );
    });
  }, [search, activeCategory]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground font-semibold">
              {t('docgen.templateGallery.startFrom')}
            </p>
            <h3 className="text-lg font-semibold mt-1">
              {t('docgen.templateGallery.title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('docgen.templateGallery.description')}
            </p>
          </div>
          <Button variant="outline" onClick={onStartBlank} className="gap-2 shrink-0">
            <IconAdd className="h-4 w-4" strokeWidth={1.5} />
            {t('docgen.templateGallery.startBlank')}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <IconSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('docgen.templateGallery.searchPlaceholder')}
            className="pl-9"
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory(ALL_CATEGORY)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors border',
              activeCategory === ALL_CATEGORY
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-primary/30',
            )}
          >
            {t('docgen.templateGallery.all')}
          </button>
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors border',
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
            {t('docgen.templateGallery.noResults')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((tpl) => {
              const Icon = tpl.icon;
              const abrir = rowOpenProps(() => onPickTemplate(tpl), tpl.label, CARD_HOVER);
              return (
                /*
                  `rowOpenProps`: o cartão abre com clique, Enter e barra de
                  espaço, e mostra o foco a quem navega por teclado.

                  Era uma `<div>` com `onClick` e mais nada: sem `tabIndex`,
                  sem `onKeyDown`, sem papel. Quem não usa rato não conseguia
                  escolher modelo nenhum — e esta é a porta de entrada do
                  DocGen. A regra do clique em cartão já existia no repositório,
                  em `lib/row-interaction`; faltava aqui.
                */
                <Card
                  key={tpl.id}
                  {...abrir}
                  className={cn(
                    'group transition-ui hover:border-primary/40 hover:shadow-elegant',
                    abrir.className,
                  )}
                >
                  <CardContent className="p-4 flex flex-col h-full gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 flex items-center justify-center shrink-0">
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
                          <Badge key={fw} variant="secondary" className="text-micro py-0 h-4">
                            {fw}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* `md:opacity-0`: no toque não há hover, e esta era a
                        única pista de que o cartão faz alguma coisa. */}
                    <div className="flex items-center justify-end text-xs text-primary md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {t('docgen.templateGallery.useTemplate')}
                      <IconArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
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

