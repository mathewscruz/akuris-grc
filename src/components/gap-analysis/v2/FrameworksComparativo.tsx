import { useMemo, useState } from 'react';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';
import { seloDoFramework } from '@/components/frameworks/framework-seal-icon';
import { resolveFrameworkBrand } from '@/lib/framework-brand';
import { OwnerCell } from '@/components/ui/owner-cell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { getFwCategory } from './fw-utils';

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
  responsavel?: { nome: string; foto?: string | null } | null;
  tendencia?: number[];
}

type Ordem = 'score-desc' | 'score-asc' | 'naoConformes-desc' | 'criticos-desc' | 'marco-asc';

/** Cor do framework = a mesma do seu selo. */
export function corDoFramework(nome: string, versao?: string) {
  const selo = seloDoFramework(nome, resolveFrameworkBrand(nome, versao));
  return `hsl(var(${selo.cor}))`;
}

function Anel({ valor }: { valor: number }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle
          cx="80" cy="80" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-1000"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, valor)) / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-foreground">{valor}%</span>
      </div>
    </div>
  );
}

function Spark({ pontos, cor }: { pontos?: number[]; cor: string }) {
  if (!pontos || pontos.length < 2) return <span className="text-muted-foreground">—</span>;
  const min = Math.min(...pontos), max = Math.max(...pontos);
  const span = max - min || 1;
  const d = pontos.map((v, i) => `${(i / (pontos.length - 1)) * 80},${22 - ((v - min) / span) * 18}`).join(' ');
  return (
    <svg viewBox="0 0 80 26" className="h-6 w-20" aria-hidden="true">
      <polyline points={d} fill="none" stroke={cor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FrameworksComparativo({
  linhas, onOpen, aderenciaGeral,
}: { linhas: LinhaComparativo[]; onOpen: (id: string) => void; aderenciaGeral: number }) {
  const { t, locale } = useLanguage();
  const [ordem, setOrdem] = useState<Ordem>('score-desc');

  const ordenadas = useMemo(() => {
    const [campo, dir] = ordem.split('-') as [string, 'asc' | 'desc'];
    const v = (l: LinhaComparativo) =>
      campo === 'marco' ? (l.marco ? new Date(l.marco).getTime() : Number.MAX_SAFE_INTEGER) : (l as any)[campo] as number;
    return [...linhas].sort((a, b) => (dir === 'desc' ? v(b) - v(a) : v(a) - v(b)));
  }, [linhas, ordem]);

  const fmtData = (d?: string | null) =>
    d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(locale === 'en' ? 'en-US' : locale) : null;
  const cat = (tipo?: string | null) => t(`gapV2.fwCategory.${getFwCategory(tipo ?? '')}`);

  return (
    <div className="space-y-5">
      {/* Aderência + comparativo */}
      <div className="rounded-lg border bg-card p-6 flex flex-col sm:flex-row items-center gap-8">
        <div className="flex flex-col items-center gap-1 sm:pr-8 sm:border-r border-border">
          <Anel valor={aderenciaGeral} />
          <span className="text-xs text-muted-foreground -mt-1">{t('gapAnalysis.frameworks.comparativo.geral')}</span>
        </div>
        <div className="flex-1 w-full min-w-0">
          <h3 className="text-sm font-semibold mb-4">{t('gapAnalysis.frameworks.comparativo.title')}</h3>
          <div className="space-y-3.5">
            {linhas.map((l) => (
              <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="grid w-full grid-cols-[minmax(80px,140px)_1fr_44px] items-center gap-4 text-left group">
                <span className="truncate text-sm group-hover:text-primary">{l.nome}</span>
                <span className="h-2 rounded-full bg-muted overflow-hidden">
                  <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${l.total > 0 ? l.score : 0}%`, background: corDoFramework(l.nome, l.versao) }} />
                </span>
                <span className="text-xs tabular-nums text-right text-muted-foreground">{l.total > 0 ? `${l.score}%` : '—'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-muted/30">
          <span className="text-sm text-foreground/80">{t('gapAnalysis.frameworks.tabela.count', { count: linhas.length })}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{t('gapAnalysis.frameworks.tabela.ordenarPor')}</span>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent px-2 text-xs font-medium text-foreground shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['score-desc', 'score-asc', 'naoConformes-desc', 'criticos-desc', 'marco-asc'] as Ordem[]).map((o) => (
                  <SelectItem key={o} value={o} className="text-xs">{t(`gapAnalysis.frameworks.tabela.ordem.${o}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {['framework', 'aderencia', 'naoConformes', 'criticos', 'marco', 'responsavel', 'tendencia', 'acoes'].map((k) => (
                  <th key={k} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {t(`gapAnalysis.frameworks.tabela.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((l) => {
                const cor = corDoFramework(l.nome, l.versao);
                return (
                  <tr key={l.id} onClick={() => onOpen(l.id)} className="border-b last:border-0 cursor-pointer hover:bg-accent">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <FrameworkBadge name={l.nome} versao={l.versao} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{l.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">{cat(l.tipo_framework)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 min-w-[130px]">
                      <div className="tabular-nums text-xs">{l.total > 0 ? `${l.score}%` : '—'}</div>
                      <div className="mt-1 h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${l.total > 0 ? l.score : 0}%`, background: cor }} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-destructive font-medium">{l.naoConformes}</td>
                    <td className="px-4 py-3.5 tabular-nums text-destructive font-medium">{l.criticos}</td>
                    <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap text-xs">{fmtData(l.marco) ?? t('gapAnalysis.frameworks.tabela.definir')}</td>
                    <td className="px-4 py-3.5">
                      <OwnerCell name={l.responsavel?.nome} photo={l.responsavel?.foto} emptyLabel={t('gapAnalysis.frameworks.tabela.naoAtribuido')} />
                    </td>
                    <td className="px-4 py-3.5"><Spark pontos={l.tendencia} cor={cor} /></td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-primary text-xs font-medium whitespace-nowrap">{t('gapAnalysis.frameworks.tabela.verDetalhes')} →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Celular */}
        <div className="md:hidden divide-y">
          {ordenadas.map((l) => (
            <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="w-full p-4 text-left">
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
    </div>
  );
}
