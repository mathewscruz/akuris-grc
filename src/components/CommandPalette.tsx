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
import { MODULE_ICON } from '@/lib/module-icons';

const MODULES = [
  { key: 'moduleDashboard', path: '/dashboard', icon: MODULE_ICON['/dashboard'], keywords: ['inicio', 'home', 'painel'] },
  { key: 'moduleRisks', path: '/riscos', icon: MODULE_ICON['/riscos'], keywords: ['risco', 'ameaca', 'vulnerabilidade'] },
  { key: 'moduleGovernance', path: '/governanca', icon: MODULE_ICON['/governanca'], keywords: ['controle', 'auditoria', 'compliance'] },
  { key: 'moduleGapAnalysis', path: '/gap-analysis', icon: MODULE_ICON['/gap-analysis'], keywords: ['framework', 'conformidade', 'iso', 'nist', 'lgpd'] },
  { key: 'moduleFrameworks', path: '/gap-analysis/frameworks', icon: MODULE_ICON['/gap-analysis/frameworks'], keywords: ['iso 27001', 'nist', 'lgpd', 'sox'] },
  { key: 'moduleAssets', path: '/ativos', icon: MODULE_ICON['/ativos'], keywords: ['ativo', 'dispositivo', 'hardware', 'software'] },
  { key: 'moduleLicenses', path: '/ativos/licencas', icon: MODULE_ICON['/ativos/licencas'], keywords: ['licenca', 'software', 'renovacao'] },
  { key: 'moduleCryptoKeys', path: '/ativos/chaves', icon: MODULE_ICON['/ativos/chaves'], keywords: ['chave', 'criptografia', 'certificado'] },
  { key: 'moduleDocuments', path: '/documentos', icon: MODULE_ICON['/documentos'], keywords: ['documento', 'politica', 'procedimento'] },
  { key: 'moduleContracts', path: '/contratos', icon: MODULE_ICON['/contratos'], keywords: ['contrato', 'fornecedor', 'sla'] },
  { key: 'moduleIncidents', path: '/incidentes', icon: MODULE_ICON['/incidentes'], keywords: ['incidente', 'seguranca', 'breach'] },
  { key: 'modulePrivacy', path: '/privacidade', icon: MODULE_ICON['/privacidade'], keywords: ['lgpd', 'dados', 'ropa', 'titular'] },
  { key: 'modulePrivilegedAccounts', path: '/contas-privilegiadas', icon: MODULE_ICON['/contas-privilegiadas'], keywords: ['conta', 'privilegio', 'admin', 'acesso'] },
  { key: 'moduleAccessReviews', path: '/revisao-acessos', icon: MODULE_ICON['/revisao-acessos'], keywords: ['revisao', 'acesso', 'review'] },
  { key: 'moduleDueDiligence', path: '/due-diligence', icon: MODULE_ICON['/due-diligence'], keywords: ['due diligence', 'fornecedor', 'terceiro'] },
  { key: 'moduleWhistleblowing', path: '/denuncia', icon: MODULE_ICON['/denuncia'], keywords: ['denuncia', 'canal', 'ouvidoria'] },
  { key: 'moduleActionPlans', path: '/planos-acao', icon: MODULE_ICON['/planos-acao'], keywords: ['plano', 'acao', 'tarefa'] },
  { key: 'moduleReports', path: '/relatorios', icon: MODULE_ICON['/relatorios'], keywords: ['relatorio', 'report', 'exportar'] },
  { key: 'moduleSettings', path: '/configuracoes', icon: MODULE_ICON['/configuracoes'], keywords: ['config', 'empresa', 'usuario', 'integracao'] },
];

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
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden h-8 w-8"
        onClick={() => setOpen(true)}
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
  const { groups, isSearching, ativo } = useGlobalSearch(deferredQuery, open);

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

  const semResultados = ativo && !isSearching && groups.length === 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      {/* shouldFilter=false: o filtro real acontece em useGlobalSearch (sem acentos, AND). */}
      <CommandInput
        placeholder={t('buscaGlobal.placeholder')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
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
            {group.total > group.rows.length && (
              <CommandItem
                value={`${group.key}-mais`}
                disabled
                className="text-xs text-muted-foreground"
              >
                {t('buscaGlobal.moreResults', { count: group.total - group.rows.length })}
              </CommandItem>
            )}
          </CommandGroup>
        ))}

        {groups.length > 0 && <CommandSeparator />}

        <CommandGroup heading={t('commandPalette.modules')}>
          {MODULES.filter((module) => {
            const q = query.trim().toLowerCase();
            if (!q) return true;
            const alvo = `${t(`commandPalette.${module.key}`)} ${module.keywords.join(' ')}`
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            return q
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .split(/\s+/).filter(Boolean)
              .every((token) => alvo.includes(token));
          }).map((module) => (
            <CommandItem
              key={module.path}
              value={`modulo-${module.path}`}
              onSelect={() => handleSelect(module.path)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <module.icon className="h-4 w-4 text-muted-foreground" />
              <span>{t(`commandPalette.${module.key}`)}</span>
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
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-micro font-medium text-muted-foreground">⌘K</kbd>
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
