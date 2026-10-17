/**
 * Topo do framework (modelo aprovado): selo + nome + descrição + etiquetas |
 * anel de conformidade geral | etapas Diagnosticar → Adequar → Comprovar,
 * que também servem de navegação entre as abas.
 */
import type { ReactNode } from 'react';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { IconCheck } from '@/components/icons';
import { formatStatus } from '@/lib/text-utils';

type Etapa = 'diagnostico' | 'adequacao' | 'evidencias';
const ETAPAS: { id: Etapa; titulo: string; desc: string }[] = [
  { id: 'diagnostico', titulo: 'gapAnalysis.detail.tabs.diagnosis', desc: 'gapUi.topo.diagnoseDesc' },
  { id: 'adequacao', titulo: 'gapAnalysis.detail.tabs.adaptation', desc: 'gapUi.topo.adaptDesc' },
  { id: 'evidencias', titulo: 'gapAnalysis.detail.tabs.evidence', desc: 'gapUi.topo.proveDesc' },
];

export function FrameworkTopo({ framework, descricao, score, etapa, onEtapa, concluidas, acoes }: {
  framework: { nome: string; versao?: string | null; tipo_framework?: string | null; tipo?: string | null };
  descricao: string;
  score: number | null | undefined;
  etapa: string;
  onEtapa: (e: string) => void;
  concluidas: Record<Etapa, boolean>;
  acoes?: ReactNode;
}) {
  const { t } = useLanguage();
  const v = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const r = 34, c = 2 * Math.PI * r;
  const tags = Array.from(new Set([framework.tipo_framework, framework.tipo].filter(Boolean))) as string[];
  const idxAtual = Math.max(0, ETAPAS.findIndex((e) => e.id === etapa));

  return (
    <header className="space-y-4">
      {acoes && <div className="flex justify-end">{acoes}</div>}
      <div className="grid gap-6 items-center xl:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.6fr)]">
        <div className="flex items-center gap-4 min-w-0">
          <FrameworkBadge name={framework.nome} versao={framework.versao ?? undefined} size="md" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground leading-tight">{framework.nome} {framework.versao}</h1>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{descricao}</p>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tg) => <span key={tg} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground/80">{formatStatus(tg)}</span>)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 xl:border-l xl:border-r border-border xl:px-8">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
              <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
              <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-700"
                strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-base font-semibold tabular-nums text-foreground">{v}%</span>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums text-foreground leading-none">{v}%</p>
            <p className="text-sm text-muted-foreground mt-1">{t('gapUi.topo.overall')}</p>
          </div>
        </div>

        <ol className="grid grid-cols-3 gap-2" aria-label={t('gapUi.topo.etapas')}>
          {ETAPAS.map((e, i) => {
            const ativa = e.id === etapa;
            const feita = concluidas[e.id] && !ativa;
            return (
              <li key={e.id} className="relative">
                {i < ETAPAS.length - 1 && (
                  <span aria-hidden className={cn('absolute top-4 left-9 right-0 h-0.5 rounded-full', i < idxAtual || feita ? 'bg-primary' : 'bg-border')} />
                )}
                <button type="button" onClick={() => onEtapa(e.id)} aria-current={ativa ? 'step' : undefined} className="relative text-left group">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums border-2 bg-background transition-colors',
                    feita ? 'border-primary bg-primary text-primary-foreground' : ativa ? 'border-primary text-primary' : 'border-border text-muted-foreground group-hover:border-primary/50')}>
                    {feita ? <IconCheck className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={cn('mt-2 block text-sm font-semibold', ativa ? 'text-primary' : 'text-foreground')}>{i + 1}. {t(e.titulo)}</span>
                  <span className="block text-xs text-muted-foreground">{t(e.desc)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </header>
  );
}
