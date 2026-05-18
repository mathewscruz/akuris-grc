/**
 * BulkActionBar — barra dark sticky para ações em lote (Onda 5 SoA).
 * Aparece quando 1+ linhas selecionadas; oferece alterar status, atribuir,
 * definir prazo, criar plano em lote, gerar justificativa IA, limpar.
 */
import { useState } from 'react';
import { CheckSquare, X, Calendar, UserCircle2, Sparkles, ClipboardList, ChevronDown } from 'lucide-react';
import { AIBadge } from './AIBadge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Props {
  selectedCount: number;
  onClear: () => void;
  onStatusChange: (status: string) => void;
  onAssign?: () => void;
  onSetDeadline?: () => void;
  onCreatePlan?: () => void;
  onGenerateJustification?: () => void;
}

const STATUS_OPTIONS = [
  { v: 'conforme', label: 'Conforme' },
  { v: 'parcial', label: 'Parcial' },
  { v: 'nao_conforme', label: 'Não conforme' },
  { v: 'nao_aplicavel', label: 'N/A' },
];

export function BulkActionBar({
  selectedCount,
  onClear,
  onStatusChange,
  onAssign,
  onSetDeadline,
  onCreatePlan,
  onGenerateJustification,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto max-w-4xl">
      <div className="flex items-center gap-2 rounded-xl border border-foreground/20 bg-foreground text-background shadow-2xl px-4 py-2.5">
        <CheckSquare className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <span className="text-sm font-medium">
          {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
        </span>
        <span className="mx-2 h-4 w-px bg-background/20" />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-background/10 transition-colors">
            Alterar status
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUS_OPTIONS.map(o => (
              <DropdownMenuItem key={o.v} onClick={() => onStatusChange(o.v)}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {onAssign && (
          <button
            type="button"
            onClick={onAssign}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-background/10 transition-colors"
          >
            <UserCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Atribuir
          </button>
        )}
        {onSetDeadline && (
          <button
            type="button"
            onClick={onSetDeadline}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-background/10 transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} /> Prazo
          </button>
        )}
        {onCreatePlan && (
          <button
            type="button"
            onClick={onCreatePlan}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-background/10 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.5} /> Plano em lote
          </button>
        )}
        {onGenerateJustification && (
          <button
            type="button"
            onClick={onGenerateJustification}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            Justificativa
          </button>
        )}

        <span className="ml-auto" />
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar seleção"
          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-background/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
