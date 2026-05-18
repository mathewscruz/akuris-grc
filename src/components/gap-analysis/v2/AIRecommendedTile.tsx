/**
 * AIRecommendedTile — tile editorial de framework recomendado pela IA.
 * Mostra selo FwMono, nome, overlap % (reuso com base atual) e CTA.
 */
import { ArrowRight } from 'lucide-react';
import { FwMono } from './FwMono';
import { AIBadge } from './AIBadge';
import { deriveFwMono, getFwCategory, FW_CATEGORY_LABEL } from './fw-utils';

interface AIRecommendedTileProps {
  nome: string;
  versao: string;
  tipo_framework: string;
  descricao?: string;
  /** Overlap estimado com a base atual de evidências (0-100). */
  overlapPercent: number;
  /** Número de requisitos do framework. */
  requirementCount: number;
  onClick: () => void;
}

export function AIRecommendedTile({
  nome,
  versao,
  tipo_framework,
  descricao,
  overlapPercent,
  requirementCount,
  onClick,
}: AIRecommendedTileProps) {
  const mono = deriveFwMono(nome);
  const cat = getFwCategory(tipo_framework);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-elegant transition-all duration-300 p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <FwMono l1={mono.l1} l2={mono.l2} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <AIBadge>Recomendado</AIBadge>
          </div>
          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
            {nome} <span className="text-xs font-normal text-muted-foreground">{versao}</span>
          </h3>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            {FW_CATEGORY_LABEL[cat]}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
        {descricao || 'Framework de conformidade organizacional.'}
      </p>

      {/* Overlap row */}
      <div className="space-y-1.5 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <span>Reuso estimado</span>
          <span className="tabular-nums text-foreground font-semibold">{overlapPercent}%</span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, overlapPercent))}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {requirementCount} requisitos
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Iniciar
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </span>
      </div>
    </button>
  );
}
