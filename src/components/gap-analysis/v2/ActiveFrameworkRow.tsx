/**
 * ActiveFrameworkRow — linha editorial full-width de framework ativo.
 * Substitui o card grid para frameworks ativos: foco em densidade e progressão.
 * Identidade Akuris (DM Sans, tokens semânticos).
 */
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FwMono } from './FwMono';
import { StackBar, type StackSegment } from './StackBar';
import { getMaturityLevel } from './MaturityScale';
import { deriveFwMono, getFwCategory, FW_CATEGORY_LABEL } from './fw-utils';

interface ActiveFrameworkRowProps {
  nome: string;
  versao: string;
  tipo_framework: string;
  totalRequirements: number;
  evaluatedRequirements: number;
  averageScore: number;
  segments: StackSegment[];
  onClick: () => void;
}

export function ActiveFrameworkRow({
  nome,
  versao,
  tipo_framework,
  totalRequirements,
  evaluatedRequirements,
  averageScore,
  segments,
  onClick,
}: ActiveFrameworkRowProps) {
  const mono = deriveFwMono(nome);
  const cat = getFwCategory(tipo_framework);
  const coverage = totalRequirements > 0
    ? Math.round((evaluatedRequirements / totalRequirements) * 100)
    : 0;
  const maturity = getMaturityLevel(averageScore);
  const scoreTone =
    averageScore >= 80 ? 'text-success' :
    averageScore >= 60 ? 'text-primary' :
    averageScore >= 40 ? 'text-warning' :
    'text-destructive';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-elegant transition-all duration-300 p-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-[auto_1.4fr_1.6fr_auto] gap-5 items-center">
        {/* Selo + identidade */}
        <div className="flex items-center gap-3 min-w-0">
          <FwMono l1={mono.l1} l2={mono.l2} size="lg" />
          <div className="min-w-0">
            <div className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
              {FW_CATEGORY_LABEL[cat]}
            </div>
            <div className="font-semibold text-base text-foreground group-hover:text-primary transition-colors truncate">
              {nome}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {versao} · {totalRequirements} requisitos
            </div>
          </div>
        </div>

        {/* Score + maturidade */}
        <div className="flex items-baseline gap-3">
          <span className={`text-5xl font-semibold tabular-nums tracking-tight ${scoreTone} leading-none`}>
            {averageScore}
          </span>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground tabular-nums">/ 100</span>
            <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground mt-1">
              Nível {maturity.id} · {maturity.label}
            </span>
          </div>
        </div>

        {/* Distribuição */}
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-sans uppercase tracking-wider text-muted-foreground">
            <span>Distribuição</span>
            <span className="tabular-nums">
              {evaluatedRequirements}/{totalRequirements} · {coverage}%
            </span>
          </div>
          <StackBar segments={segments} height={8} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
            {segments
              .filter(s => s.count > 0)
              .map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${SEG_DOT[s.kind]}`} />
                  <span className="text-foreground font-medium tabular-nums">{s.count}</span>
                  {SEG_LABEL_SHORT[s.kind]}
                </span>
              ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs group-hover:text-primary group-hover:bg-primary/5"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            Abrir
            <ArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </button>
  );
}

const SEG_DOT: Record<string, string> = {
  conforme: 'bg-success',
  parcial: 'bg-warning',
  nao_conforme: 'bg-destructive',
  nao_aplicavel: 'bg-info',
  nao_avaliado: 'bg-muted-foreground/40',
};

const SEG_LABEL_SHORT: Record<string, string> = {
  conforme: 'Conforme',
  parcial: 'Parcial',
  nao_conforme: 'Não Conforme',
  nao_aplicavel: 'N/A',
  nao_avaliado: 'Pendente',
};
