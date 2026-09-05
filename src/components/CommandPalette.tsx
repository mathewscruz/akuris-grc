import { useEffect, useState, useCallback, useDeferredValue } from 'react';
import { IconSearch, IconGrid } from '@/components/icons';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { routeForEntity, type EntityRow, type EntityKey } from '@/lib/entity-search';
import { formatStatus } from '@/lib/text-utils';
import { getSearchModules } from '@/lib/navigation';
import { usePermissions } from '@/hooks/usePermissions';


export function CommandPaletteButton() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:flex items-center gap-2 text-muted-foreground h-8 px-3 w-48 justify-start"
        onClick={() => setOpen(true)}
      >
        <IconSearch className="h-3.5 w-3.5" />
        <span className="text-xs">{t('commandPalette.searchButton')}</span>
        <kbd className="ml-auto text-micro text-muted-foreground">Ctrl K</kbd>
      </Button>
      {/* O gémeo de cima tem a palavra «Pesquisar» ao lado do ícone; este,
          que é o único que aparece no telemóvel, não tinha nome nenhum. */}
      <Button
        variant="ghost"
        size="icon-sm" className="sm:hidden"
        onClick={() => setOpen(true)}
        aria-label={t('commandPalette.searchButton')}
      >
        <IconSearch className="h-4 w-4" />
      </Button>
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function CommandPaletteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const { groups, isSearching, ativo, isError, retry, showMore } = useGlobalSearch(deferredQuery, open);
  const { canAccess } = usePermissions();

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const handleSelect = useCallback((path: string) => {
    onOpenChange(false);
    navigate(path);
  }, [navigate, onOpenChange]);

  const handleRecord = useCallback((key: EntityKey, row: EntityRow) => {
    handleSelect(routeForEntity(key, row));
  }, [handleSelect]);

  const semResultados = ativo && !isSearching && !isError && groups.length === 0;
  const searchShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl+K';

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      {/* shouldFilter=false: o filtro real acontece em useGlobalSearch (sem acentos, AND). */}
      <CommandInput
        placeholder={t('buscaGlobal.placeholder')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isError && <div role="alert" className="px-4 py-3 text-sm text-muted-foreground"><p>{t('experience.searchUnavailable')}</p><Button variant="outline" size="sm" className="mt-2" onClick={retry}>{t('experience.retry')}</Button></div>}
        {isSearching && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <AkurisPulse size={18} /> {t('buscaGlobal.searching')}
          </div>
        )}
        {semResultados && <CommandEmpty>{t('buscaGlobal.noRecords')}</CommandEmpty>}

        {groups.map((group) => (
          <CommandGroup key={group.key} heading={t(`entidades.${group.key}`)}>
            {group.rows.map((row) => (
              <CommandItem
                key={`${group.key}-${row.id}`}
                value={`${group.key}-${row.id}`}
                onSelect={() => handleRecord(group.key, row)}
                className="flex items-start gap-3 cursor-pointer"
              >
                <Badge variant="outline" className="font-mono text-micro mt-0.5">{row.codigo}</Badge>
                <span className="min-w-0 flex-1 line-clamp-2 break-words">{row.titulo}</span>
                {row.subtitulo && (
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{formatStatus(row.subtitulo)}</span>
                )}
              </CommandItem>
            ))}
            {group.hasMore && (
              <CommandItem
                value={`${group.key}-mais`}
                onSelect={() => showMore(group.key)}
                className="text-xs text-muted-foreground"
              >
                {t('experience.searchMore')}
              </CommandItem>
            )}
          </CommandGroup>
        ))}

        {groups.length > 0 && <CommandSeparator />}

        <CommandGroup heading={t('commandPalette.modules')}>
          {getSearchModules(t).filter((module) => {
            if (module.moduleName && !canAccess(module.moduleName)) return false;
            const q = query.trim().toLowerCase();
            if (!q) return true;
            const alvo = `${module.title} ${module.url}`
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            return q
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .split(/\s+/).filter(Boolean)
              .every((token) => alvo.includes(token));
          }).map((module) => (
            <CommandItem
              key={module.url}
              value={`modulo-${module.url}`}
              onSelect={() => handleSelect(module.url!)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <module.icon className="h-4 w-4 text-muted-foreground" />
              <span>{module.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {!query && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('commandPalette.keyboardShortcuts')}>
              <CommandItem className="flex items-center justify-between cursor-default" value="atalho-busca">
                <div className="flex items-center gap-3">
                  <IconGrid className="h-4 w-4 text-muted-foreground" />
                  <span>{t('commandPalette.quickSearch')}</span>
                </div>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-micro font-medium text-muted-foreground">{searchShortcut}</kbd>
              </CommandItem>
              <CommandItem className="flex items-center justify-between cursor-default" value="atalho-sidebar">
                <div className="flex items-center gap-3">
                  <IconGrid className="h-4 w-4 text-muted-foreground" />
                  <span>{t('commandPalette.toggleMenu')}</span>
                </div>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-micro font-medium text-muted-foreground">Ctrl+B</kbd>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down, true);
    return () => document.removeEventListener('keydown', down, true);
  }, []);

  return <CommandPaletteDialog open={open} onOpenChange={setOpen} />;
}
