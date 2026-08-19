import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';
import { useAiCredits } from '@/hooks/useAiCredits';

interface AiCostHintProps {
  /** "inline" — chip pequeno ao lado do botão. "block" — faixa para topo de seções. */
  variant?: 'inline' | 'block';
  /** Custo desta ação (default = 1). */
  cost?: number;
  /** Texto curto opcional sobre o que será gerado (ex.: "esta análise"). */
  action?: string;
  className?: string;
}

/**
 * Selo informativo "consome X crédito(s) de IA".
 * - Mostra o saldo atual no tooltip.
 * - Quando esgotado, vira aviso destrutivo orientando contato com o administrador.
 */
export function AiCostHint({ variant = 'inline', cost = 1, action, className }: AiCostHintProps) {
  const { restantes, franquia, esgotado, isSuperAdmin, loading } = useAiCredits();

  if (loading || franquia === 0) return null;

  const label = esgotado
    ? 'Créditos esgotados'
    : `${cost} crédito${cost > 1 ? 's' : ''} de IA`;

  const tooltip = esgotado
    ? isSuperAdmin
      ? 'Seu plano está sem créditos de IA. Adicione mais em Configurações → Créditos de IA.'
      : 'Os créditos de IA do seu plano acabaram. Para continuar usando, fale com o administrador da sua conta.'
    : `${action ? action.charAt(0).toUpperCase() + action.slice(1) + ' consome' : 'Esta ação consome'} ${cost} crédito${cost > 1 ? 's' : ''} do plano. Saldo atual: ${restantes} de ${franquia}.`;

  if (variant === 'block') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
          esgotado
            ? 'border-destructive/30 bg-destructive/5 text-destructive'
            : 'border-border/60 bg-muted/30 text-muted-foreground',
          className,
        )}
        role="note"
      >
        <span className="leading-tight">
          <strong className={esgotado ? '' : 'text-foreground font-semibold'}>{label}</strong>
          <span className="mx-1.5 opacity-50">·</span>
          {esgotado
            ? isSuperAdmin
              ? 'Adicione créditos em Configurações → Créditos de IA.'
              : 'Fale com o administrador para liberar mais.'
            : `Saldo: ${restantes} de ${franquia} disponível${restantes === 1 ? '' : 's'}.`}
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-micro font-medium select-none cursor-help',
              esgotado
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border/60 bg-muted/40 text-muted-foreground',
              className,
            )}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
