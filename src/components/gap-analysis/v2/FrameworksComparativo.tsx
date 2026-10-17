import { useMemo, useState } from 'react';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategory } from '@/lib/gap-analysis-tokens';
import { getOperationalScoreColor } from '@/lib/operational-score-color';
import { IconChevronDown } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface LinhaComparativo {
  id: string;
  nome: string;
  versao?: string;
  tipo_framework?: string | null;
  score: number;
  total: number;
  avaliados: number;
  naoConformes: number;
  criticos: number;
  atrasados: number;
  marco?: string | null;
}

type Ordem = 'score' | 'naoConformes' | 'criticos' | 'marco';

const cor = (s: number, total: number) => (total > 0 ? getOperationalScoreColor(s) : 'hsl(var(--muted-foreground))');

export function FrameworksComparativo({ linhas, onOpen }: { linhas: LinhaComparativo[]; onOpen: (id: string) => void }) {
  const { t, locale } = useLanguage();
  const [ordem, setOrdem] = useState<Ordem>('score');
  const [desc, setDesc] = useState(true);

  const ordenadas = useMemo(() => {
    const v = (l: LinhaComparativo) =>
      ordem === 'marco' ? (l.marco ? new Date(l.marco).getTime() : Number.MAX_SAFE_INTEGER) : l[ordem];
    return [...linhas].sort((a, b) => (desc ? v(b) - v(a) : v(a) - v(b)));
  }, [linhas, ordem, desc]);

  const ordenarPor = (o: Ordem) => {
    if (o === ordem) setDesc(!desc);
    else { setOrdem(o); setDesc(o !== 'marco'); }
  };

  const Th = ({ o, children }: { o?: Ordem; children: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
      {o ? (
        <button type="button" onClick={() => ordenarPor(o)} className="inline-flex items-center gap-1 hover:text-foreground">
          {children}
          <IconChevronDown className={cn('h-3 w-3 transition-transform', ordem === o ? 'opacity-100' : 'opacity-0', ordem === o && !desc && 'rotate-180')} />
        </button>
      ) : children}
    </th>
  );

  const fmtData = (d?: string | null) =>
    d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(locale === 'en' ? 'en-US' : locale) : null;
  const cat = (tipo?: string | null) => t(`gapV2.fwCategory.${getCategory(tipo ?? '')}`);

  return (
    <div className="space-y-4">
      {/* Comparativo */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">{t('gapAnalysis.frameworks.comparativo.title')}</h3>
        <div className="space-y-3">
          {linhas.map((l) => (
            <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="grid w-full grid-cols-[minmax(90px,160px)_1fr_48px] items-center gap-4 text-left group">
              <span className="truncate text-sm group-hover:text-primary">{l.nome}</span>
              <span className="h-2.5 rounded-full bg-muted overflow-hidden">
                <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${l.total > 0 ? l.score : 0}%`, background: cor(l.score, l.total) }} />
              </span>
              <span className="text-sm tabular-nums text-right">{l.total > 0 ? `${l.score}%` : '—'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabela (desktop) */}
      <div className="hidden md:block rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <Th>{t('gapAnalysis.frameworks.tabela.framework')}</Th>
              <Th o="score">{t('gapAnalysis.frameworks.tabela.aderencia')}</Th>
              <Th o="naoConformes">{t('gapAnalysis.frameworks.tabela.naoConformes')}</Th>
              <Th o="criticos">{t('gapAnalysis.frameworks.tabela.criticos')}</Th>
              <Th o="marco">{t('gapAnalysis.frameworks.tabela.marco')}</Th>
              <Th>{t('gapAnalysis.frameworks.tabela.avaliados')}</Th>
              <Th><span className="sr-only">{t('gapAnalysis.frameworks.tabela.acoes')}</span></Th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.id} onClick={() => onOpen(l.id)} className="border-b last:border-0 cursor-pointer hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FrameworkBadge name={l.nome} versao={l.versao} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{l.nome}</div>
                      <div className="text-xs text-muted-foreground truncate">{cat(l.tipo_framework)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 min-w-[140px]">
                  <div className="tabular-nums font-medium">{l.total > 0 ? `${l.score}%` : '—'}</div>
                  <div className="mt-1 h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${l.total > 0 ? l.score : 0}%`, background: cor(l.score, l.total) }} />
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-destructive">{l.naoConformes}</td>
                <td className="px-4 py-3 tabular-nums">{l.criticos > 0 ? <span className="text-destructive font-medium">{l.criticos}</span> : '0'}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtData(l.marco) ?? t('gapAnalysis.frameworks.tabela.definir')}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.avaliados}/{l.total}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-primary text-sm whitespace-nowrap">{t('gapAnalysis.frameworks.tabela.verDetalhes')} →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartões (celular) */}
      <div className="md:hidden space-y-3">
        {ordenadas.map((l) => (
          <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="w-full rounded-xl border bg-card p-4 text-left">
            <div className="flex items-center gap-3">
              <FrameworkBadge name={l.nome} versao={l.versao} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{l.nome}</div>
                <div className="text-xs text-muted-foreground">{cat(l.tipo_framework)}</div>
              </div>
              <span className="text-lg font-semibold tabular-nums">{l.total > 0 ? `${l.score}%` : '—'}</span>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span><b className="text-destructive">{l.naoConformes}</b> {t('gapAnalysis.frameworks.tabela.naoConformes')}</span>
              <span>{fmtData(l.marco) ?? t('gapAnalysis.frameworks.tabela.definir')}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
