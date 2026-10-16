import { useEffect, useRef, useState } from 'react';
import { IconSuccess, IconInfo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import type { FaseAnalise, ProgressoAnalise } from './progresso';

interface Props {
  progresso: ProgressoAnalise;
  isError?: boolean;
  errorMessage?: string;
  documentName?: string;
  normaName?: string;
  veredito?: 'em_compliance' | 'com_ressalvas' | 'nao_compliance' | null;
}

const FASES: Exclude<FaseAnalise, 'concluido'>[] = ['preparando', 'entendendo', 'lendo', 'avaliando', 'montando'];
const TOM = { em_compliance: 'success', com_ressalvas: 'warning', nao_compliance: 'destructive' } as const;

/** Número que conta até o alvo e, enquanto a fase trabalha, avança devagar até o teto dela. */
function useNumeroAnimado(alvo: number, teto: number, ativo: boolean) {
  const [v, setV] = useState(alvo);
  const vRef = useRef(alvo);
  useEffect(() => {
    const reduz = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduz) { vRef.current = Math.max(vRef.current, alvo); setV(vRef.current); return; }
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      let atual = vRef.current;
      if (atual < alvo) atual = Math.min(alvo, atual + Math.max(0.4, (alvo - atual) * 4 * dt * 10) * dt * 6);
      else if (ativo && atual < teto) atual = Math.min(teto, atual + 0.08 * dt * 10 * Math.max(0.1, (teto - atual) / 20));
      if (atual !== vRef.current) { vRef.current = atual; setV(atual); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, teto, ativo]);
  return v;
}

export function AdherenceAnalysisProgress({ progresso, isError = false, errorMessage, documentName, normaName, veredito }: Props) {
  const { t } = useLanguage();
  const k = (s: string, p?: Record<string, string | number>) => t(`gapAnalysis.adherenceUi.verdict.live.${s}`, p);
  const done = progresso.fase === 'concluido' && !isError;
  const [elapsed, setElapsed] = useState(0);
  const [parado, setParado] = useState(false);
  const ultimoAvanco = useRef({ pct: progresso.pct, em: Date.now() });

  useEffect(() => {
    if (done || isError) return;
    const i = setInterval(() => {
      setElapsed(p => p + 1);
      setParado(Date.now() - ultimoAvanco.current.em > 60000);
    }, 1000);
    return () => clearInterval(i);
  }, [done, isError]);
  useEffect(() => {
    if (progresso.pct !== ultimoAvanco.current.pct) { ultimoAvanco.current = { pct: progresso.pct, em: Date.now() }; setParado(false); }
  }, [progresso.pct]);

  const shown = useNumeroAnimado(done ? 100 : progresso.pct, done ? 100 : progresso.teto, !done && !isError);
  const pct = Math.floor(shown);
  const R = 52, C = 2 * Math.PI * R;
  const faseIdx = done ? FASES.length : FASES.indexOf(progresso.fase as never);

  const detalheFase = (f: string) => {
    if (f === 'lendo' && progresso.partes) return k('readingPart', { done: progresso.partes.feitas, total: progresso.partes.total });
    if (f === 'avaliando' && progresso.requisitos) return k('evaluatingPoints', { done: progresso.requisitos.feitos, total: progresso.requisitos.total });
    return k(`${f}_d`);
  };

  const descobertas = [
    progresso.tema && { l: k('foundTheme'), v: progresso.tema },
    progresso.escopo && { l: k('foundScope'), v: k('ofTotal', { a: progresso.escopo.aplicaveis, b: progresso.escopo.total }) },
    progresso.partes && { l: k('foundParts'), v: k('ofTotal', { a: progresso.partes.feitas, b: progresso.partes.total }) },
    progresso.requisitos && { l: k('foundPoints'), v: k('ofTotal', { a: progresso.requisitos.feitos, b: progresso.requisitos.total }) },
  ].filter(Boolean) as { l: string; v: string }[];

  const fmt = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

  return (
    <div className="space-y-5 py-1">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} className="fill-none stroke-muted" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={R} strokeWidth="8" strokeLinecap="round"
              className={cn('fill-none transition-colors duration-500', isError ? 'stroke-destructive' : done ? 'stroke-success' : 'stroke-primary')}
              strokeDasharray={C} strokeDashoffset={C - (shown / 100) * C}
            />
          </svg>
          {!done && !isError && (
            <div className="pointer-events-none absolute inset-0 animate-spin rounded-full motion-reduce:hidden" style={{ animationDuration: '2.4s' }}>
              <span className="absolute left-1/2 top-[2px] h-2 w-2 -translate-x-1/2 rounded-full bg-primary/60 blur-[2px]" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            {done ? <IconSuccess className="h-10 w-10 text-success animate-in zoom-in-50 duration-500" strokeWidth={1.5} />
              : isError ? <IconInfo className="h-10 w-10 text-destructive" strokeWidth={1.5} />
              : <span className="text-3xl font-bold tabular-nums text-foreground">{pct}%</span>}
          </div>
        </div>
        <div className="space-y-0.5">
          {normaName && <p className="text-sm font-semibold text-foreground">{normaName}</p>}
          {documentName && <p className="max-w-[360px] truncate text-xs text-muted-foreground">{documentName}</p>}
        </div>
        {done && (
          <div className="flex flex-col items-center gap-2 animate-in fade-in duration-500">
            <p className="text-sm font-medium text-foreground">{k('completed')}</p>
            {veredito && <StatusBadge tone={TOM[veredito]}>{t(`gapAnalysis.adherenceUi.verdict.${veredito}`)}</StatusBadge>}
          </div>
        )}
        {isError && <p className="text-sm text-destructive">{errorMessage || t('gapAnalysis.adherenceUi.progress.errorDefault')}</p>}
        {!done && !isError && (
          <p className="text-xs tabular-nums text-muted-foreground">{k('elapsed')}: {fmt(elapsed)}</p>
        )}
        {parado && !done && !isError && (
          <p className="text-xs text-muted-foreground animate-in fade-in">{k('stillWorking')}</p>
        )}
      </div>

      {descobertas.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{k('discovered')}</p>
          <dl className="space-y-1.5">
            {descobertas.map(d => (
              <div key={d.l} className="flex items-baseline justify-between gap-3 text-sm animate-in fade-in slide-in-from-left-1 duration-300">
                <dt className="text-muted-foreground">{d.l}</dt>
                <dd className="truncate text-right font-medium tabular-nums text-foreground">{d.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <ol className="space-y-1">
        {FASES.map((f, i) => {
          const status = isError && i === faseIdx ? 'error' : i < faseIdx ? 'completed' : i === faseIdx ? 'active' : 'pending';
          return (
            <li key={f} className={cn('flex items-start gap-3 rounded-lg px-3 py-2 transition-colors duration-500',
              status === 'active' && 'bg-primary/5 ring-1 ring-primary/20',
              status === 'pending' && 'opacity-50',
              status === 'error' && 'bg-destructive/5 ring-1 ring-destructive/20')}>
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {status === 'completed' && <IconSuccess className="h-5 w-5 text-success animate-in zoom-in-50 duration-300" strokeWidth={1.5} />}
                {status === 'active' && <AkurisPulse size={18} />}
                {status === 'pending' && <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
                {status === 'error' && <IconInfo className="h-5 w-5 text-destructive" strokeWidth={1.5} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', status === 'active' ? 'text-foreground' : 'text-muted-foreground')}>{k(f)}</p>
                <p key={status === 'active' ? detalheFase(f) : f} className="mt-0.5 text-xs text-muted-foreground animate-in fade-in duration-300">
                  {status === 'active' ? detalheFase(f) : k(`${f}_d`)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {!done && !isError && <p className="text-center text-xs text-muted-foreground">{t('gapAnalysis.adherenceUi.verdict.ui.canClose')}</p>}
    </div>
  );
}
