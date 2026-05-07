/**
 * RiskCategoryBars — distribuição de riscos por categoria, com stack por severidade.
 */
import { useMemo } from 'react';
import { severityFromNivel, type Severity } from '@/components/riscos/risk-utils';

interface Risco {
  nivel_risco_inicial: string;
  nivel_risco_residual?: string | null;
  categoria?: { nome: string } | null;
}

interface Props {
  riscos: Risco[];
}

const SEV_BG: Record<Severity, string> = {
  critico: 'bg-destructive',
  alto: 'bg-warning',
  medio: 'bg-warning/60',
  baixo: 'bg-success',
};

export function RiskCategoryBars({ riscos }: Props) {
  const rows = useMemo(() => {
    const map = new Map<string, { nome: string; critico: number; alto: number; medio: number; baixo: number; total: number }>();
    riscos.forEach((r) => {
      const nome = r.categoria?.nome || 'Sem categoria';
      const sev = severityFromNivel(r.nivel_risco_residual || r.nivel_risco_inicial);
      const cur = map.get(nome) || { nome, critico: 0, alto: 0, medio: 0, baixo: 0, total: 0 };
      cur[sev] += 1;
      cur.total += 1;
      map.set(nome, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [riscos]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
        Distribuição por categoria
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Sem dados de categoria.</div>
      ) : (
        <div className="flex flex-col gap-3.5 mt-4">
          {rows.map((row) => (
            <div key={row.nome}>
              <div className="flex justify-between mb-1.5 text-xs">
                <span className="text-foreground/85 font-medium truncate">{row.nome}</span>
                <span className="text-muted-foreground tabular-nums">{row.total}</span>
              </div>
              <div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-muted/60">
                {row.critico > 0 && <div className={SEV_BG.critico} style={{ flex: row.critico }} />}
                {row.alto > 0 && <div className={SEV_BG.alto} style={{ flex: row.alto }} />}
                {row.medio > 0 && <div className={SEV_BG.medio} style={{ flex: row.medio }} />}
                {row.baixo > 0 && <div className={SEV_BG.baixo} style={{ flex: row.baixo }} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
