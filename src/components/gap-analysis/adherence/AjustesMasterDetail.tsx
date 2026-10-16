import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconSuccess } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Acao } from './ajustes';

type Item = { acao: Acao; idx: number; essencial: boolean };

interface Props {
  essenciais: { acao: Acao; idx: number }[];
  recomendados: { acao: Acao; idx: number }[];
  planosCriados: Set<number>;
  criandoPlano: number | null;
  onCriarPlano: (acao: Acao, idx: number) => void;
}

/** Lista compacta de ajustes à esquerda + detalhe do selecionado à direita. */
export function AjustesMasterDetail({ essenciais, recomendados, planosCriados, criandoPlano, onCriarPlano }: Props) {
  const { t } = useLanguage();
  const g = (s: string, p?: Record<string, string | number>) => t(`gapAnalysis.adherenceUi.verdict.guide.${s}`, p);
  const u = (s: string, p?: Record<string, string | number>) => t(`gapAnalysis.adherenceUi.verdict.ui.${s}`, p);
  const itens: Item[] = [
    ...essenciais.map(e => ({ ...e, essencial: true })),
    ...recomendados.map(e => ({ ...e, essencial: false })),
  ];
  const [sel, setSel] = useState(0);
  const [mobileDetalhe, setMobileDetalhe] = useState(false);
  useEffect(() => { if (sel >= itens.length) setSel(0); }, [itens.length, sel]);

  if (!itens.length) return <p className="py-8 text-center text-sm text-muted-foreground">{u('noAdjust')}</p>;
  const atual = itens[sel] ?? itens[0];
  const a = atual.acao;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(a.texto_sugerido || ''); toast.success(g('copied')); }
    catch { toast.error(g('copyError')); }
  };

  const Linha = ({ it, i }: { it: Item; i: number }) => {
    const ativo = i === sel;
    const feito = planosCriados.has(it.idx);
    return (
      <button
        type="button"
        onClick={() => { setSel(i); setMobileDetalhe(true); }}
        className={cn(
          'relative flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
          ativo ? 'bg-accent' : 'hover:bg-accent/60',
        )}
        aria-current={ativo}
      >
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', it.essencial ? 'bg-destructive' : 'bg-warning')} />
        <span className="min-w-0 flex-1">
          <span className={cn('line-clamp-2 text-sm', ativo ? 'font-semibold text-foreground' : 'text-foreground')}>{it.acao.titulo}</span>
          {it.acao.requisito_codigo && <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{it.acao.requisito_codigo}</span>}
        </span>
        {feito && <IconSuccess className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={1.5} />}
      </button>
    );
  };

  const Grupo = ({ titulo, de, ate }: { titulo: string; de: number; ate: number }) => ate > de ? (
    <div className="space-y-1">
      <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo} · {ate - de}</p>
      {itens.slice(de, ate).map((it, j) => <Linha key={it.idx} it={it} i={de + j} />)}
    </div>
  ) : null;

  const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section className="space-y-1.5">
      <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h5>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(240px,320px)_1fr]">
      <nav className={cn('rounded-lg border bg-card p-1.5 md:sticky md:top-16 md:max-h-[70vh] md:overflow-y-auto', mobileDetalhe && 'hidden md:block')}>
        <Grupo titulo={u('essentials')} de={0} ate={essenciais.length} />
        <Grupo titulo={u('recommended')} de={essenciais.length} ate={itens.length} />
      </nav>

      <article key={atual.idx} className={cn('min-w-0 rounded-lg border bg-card animate-in fade-in slide-in-from-right-2 duration-300', !mobileDetalhe && 'hidden md:block')}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
          <div className="min-w-0 max-w-[720px] space-y-2">
            <button type="button" className="text-xs text-primary md:hidden" onClick={() => setMobileDetalhe(false)}>← {u('tabAdjust')}</button>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={atual.essencial ? 'destructive' : 'warning'}>{atual.essencial ? u('essentials') : u('recommended')}</Chip>
              {a.requisito_codigo && <Chip>{t('gapAnalysis.adherenceUi.verdict.requirement', { codigo: a.requisito_codigo })}</Chip>}
              <span className="text-xs text-muted-foreground">{u('itemOf', { n: sel + 1, total: itens.length })}</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground">{a.titulo}</h4>
            {a.descricao && <p className="text-sm text-muted-foreground">{a.descricao}</p>}
          </div>
          <Button size="sm" variant={planosCriados.has(atual.idx) ? 'ghost' : 'default'} disabled={planosCriados.has(atual.idx) || criandoPlano === atual.idx} onClick={() => onCriarPlano(a, atual.idx)}>
            {criandoPlano === atual.idx && <AkurisPulse size={14} className="mr-2" />}
            {planosCriados.has(atual.idx) && <IconSuccess className="mr-1.5 h-4 w-4 text-success" strokeWidth={1.5} />}
            {planosCriados.has(atual.idx) ? t('gapAnalysis.adherenceUi.verdict.planExists') : t('gapAnalysis.adherenceUi.verdict.createPlan')}
          </Button>
        </header>

        <div className="max-w-[760px] space-y-5 p-5">
          {a.exigencia_norma && <Secao titulo={g('requires')}>{a.exigencia_norma}</Secao>}
          {a.evidencia_documento && (
            <Secao titulo={g('found')}>
              <blockquote className="rounded-r-md border-l-2 border-border bg-muted/30 px-3 py-2 italic text-muted-foreground">{a.evidencia_documento}</blockquote>
            </Secao>
          )}
          {a.impacto && <Secao titulo={g('why')}>{a.impacto}</Secao>}
          {a.passos && a.passos.length > 0 && (
            <Secao titulo={g('steps')}>
              <ol className="space-y-2">
                {a.passos.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            </Secao>
          )}
          {a.texto_sugerido && (
            <Secao titulo={g('suggested')}>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="whitespace-pre-wrap text-sm">{a.texto_sugerido}</p>
                <Button size="sm" variant="ghost" className="mt-2" onClick={copiar}>{g('copy')}</Button>
              </div>
            </Secao>
          )}
        </div>

        <footer className="flex items-center justify-between border-t px-5 py-3">
          <Button size="sm" variant="ghost" disabled={sel === 0} onClick={() => setSel(s => s - 1)}>← {u('prev')}</Button>
          <Button size="sm" variant="ghost" disabled={sel >= itens.length - 1} onClick={() => setSel(s => s + 1)}>{u('next')} →</Button>
        </footer>
      </article>
    </div>
  );
}
