/**
 * Visuais compartilhados do risco (drawer e perfil completo): anel de score,
 * bloco de nível, tile de contexto e metadado de cabeçalho. Fonte única para
 * não duplicar entre as duas telas.
 */
import * as React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import type { Severity } from '@/components/riscos/risk-utils';

export const SEV_VAR: Record<Severity, string> = {
  critico: 'hsl(var(--destructive))',
  alto: 'hsl(var(--warning))',
  medio: 'hsl(var(--warning))',
  baixo: 'hsl(var(--success))',
};

/** Anel de score circular colorido por severidade (score/25 → %). */
export function ScoreRing({ score, sev, size = 68 }: { score: number; sev: Severity; size?: number }) {
  const color = SEV_VAR[sev];
  const pct = Math.max(4, Math.min(100, (score / 25) * 100));
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular-nums leading-none" style={{ color, fontSize: size * 0.29 }}>{score || '—'}</span>
        <span className="text-[8px] uppercase tracking-[1px] text-muted-foreground mt-0.5">score</span>
      </div>
    </div>
  );
}

/** Bloco de nível (Inerente/Residual) com badge, score e P×I. */
export function ScoreBlock({ label, nivel, score, p, i, emptyLabel }: { label: string; nivel?: string | null; score: number; p?: string; i?: string; emptyLabel?: string }) {
  return (
    <div className="flex-1 min-w-0 bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {nivel ? (
          <StatusBadge size="sm" {...resolveNivelRiscoTone(nivel)}>{formatStatus(nivel)}</StatusBadge>
        ) : (
          <StatusBadge size="sm" tone="neutral">{emptyLabel || '—'}</StatusBadge>
        )}
        <span className="text-lg font-semibold tabular-nums">{score || '—'}</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">P {p || '—'} × I {i || '—'}</div>
    </div>
  );
}

/** Tile compacto de contexto (exposição, tratamentos, controles). */
export function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground [&_svg]:h-3 [&_svg]:w-3">
        {icon}{label}
      </span>
      <span className="text-base font-semibold tabular-nums truncate">{value}</span>
    </div>
  );
}

/** Metadado com ícone + rótulo + valor. */
export function HeaderMeta({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-muted-foreground [&_svg]:h-3 [&_svg]:w-3">
        {icon}{label}
      </div>
      <div className="text-xs text-foreground mt-1 truncate">{value}</div>
    </div>
  );
}
