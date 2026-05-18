/**
 * CommandPalette — Cmd/Ctrl+K para busca rápida de requisitos no framework atual.
 * Selecionar abre o RequirementDrawer.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useRequirementDrawer } from './RequirementDrawerProvider';

interface RequirementRow {
  id: string;
  codigo: string | null;
  titulo: string;
  categoria: string | null;
  framework_id: string;
}

interface CommandPaletteProps {
  frameworkId: string;
  empresaId: string;
  onSaved?: () => void;
}

export function CommandPalette({ frameworkId, empresaId, onSaved }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [evalMap, setEvalMap] = useState<Record<string, string>>({});
  const { openRequirement } = useRequirementDrawer();

  // Atalho ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Carrega requisitos quando abre
  useEffect(() => {
    if (!open || !frameworkId || !empresaId) return;
    let cancelled = false;
    (async () => {
      try {
        const [reqsRes, evalsRes] = await Promise.all([
          supabase
            .from('gap_analysis_requirements')
            .select('id, codigo, titulo, categoria, framework_id')
            .eq('framework_id', frameworkId)
            .order('ordem', { ascending: true })
            .limit(500),
          supabase
            .from('gap_analysis_evaluations')
            .select('requirement_id, conformity_status')
            .eq('framework_id', frameworkId)
            .eq('empresa_id', empresaId),
        ]);
        if (cancelled) return;
        setRequirements(reqsRes.data || []);
        const m: Record<string, string> = {};
        (evalsRes.data || []).forEach(e => {
          if (e.conformity_status) m[e.requirement_id] = e.conformity_status;
        });
        setEvalMap(m);
      } catch (e) {
        logger.error('Erro ao carregar requisitos da palette', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [open, frameworkId, empresaId]);

  const grouped = useMemo(() => {
    const g: Record<string, RequirementRow[]> = {};
    requirements.forEach((r) => {
      const cat = r.categoria || 'Outros';
      if (!g[cat]) g[cat] = [];
      g[cat].push(r);
    });
    return g;
  }, [requirements]);

  const statusDot = (s: string | undefined) => {
    switch (s) {
      case 'conforme': return 'bg-success';
      case 'parcial': return 'bg-warning';
      case 'nao_conforme': return 'bg-destructive';
      case 'nao_aplicavel': return 'bg-info';
      default: return 'bg-muted-foreground/40';
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar requisito por código, título ou categoria..." />
      <CommandList>
        <CommandEmpty>Nenhum requisito encontrado.</CommandEmpty>
        {Object.entries(grouped).map(([cat, items]) => (
          <CommandGroup key={cat} heading={cat}>
            {items.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.codigo || ''} ${r.titulo} ${cat}`}
                onSelect={() => {
                  setOpen(false);
                  openRequirement({
                    requirementId: r.id,
                    empresaId,
                    onSaved,
                  });
                }}
              >
                <span className={`mr-2 inline-block h-2 w-2 shrink-0 rounded-full ${statusDot(evalMap[r.id])}`} />
                {r.codigo && (
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground mr-2 shrink-0">
                    {r.codigo}
                  </span>
                )}
                <span className="truncate">{r.titulo}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
