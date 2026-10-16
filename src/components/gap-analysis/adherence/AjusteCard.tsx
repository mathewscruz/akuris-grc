import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconSuccess } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { temInstrucao, type Acao } from './ajustes';

interface Props {
  acao: Acao;
  essencial: boolean;
  delay: number;
  planoCriado: boolean;
  criando: boolean;
  onCriarPlano: () => void;
  defaultOpen?: boolean;
}

export function AjusteCard({ acao, essencial, delay, planoCriado, criando, onCriarPlano, defaultOpen }: Props) {
  const { t } = useLanguage();
  const k = (s: string, p?: Record<string, string | number>) => t(`gapAnalysis.adherenceUi.verdict.guide.${s}`, p);
  const detalhado = temInstrucao(acao);
  const [aberto, setAberto] = useState(!!defaultOpen);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(acao.texto_sugerido || ''); toast.success(k('copied')); }
    catch { toast.error(k('copyError')); }
  };

  const Secao = ({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) => (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums text-muted-foreground">{n}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );

  let n = 0;
  return (
    <div
      className={cn('relative overflow-hidden rounded-lg border bg-card animate-in fade-in slide-in-from-bottom-1', planoCriado && 'opacity-80')}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', essencial ? 'bg-destructive' : 'bg-muted-foreground/40')} />
      <button
        type="button"
        onClick={() => detalhado && setAberto(v => !v)}
        className={cn('flex w-full flex-col gap-2 p-4 pl-5 text-left transition-colors', detalhado && 'hover:bg-accent')}
        aria-expanded={detalhado ? aberto : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold text-foreground">{acao.titulo}</h4>
          {detalhado && <span className="shrink-0 text-xs text-primary">{aberto ? k('hide') : k('howToFix')}</span>}
        </div>
        {acao.descricao && <p className="text-sm text-muted-foreground">{acao.descricao}</p>}
        {acao.requisito_codigo && <div><Chip>{t('gapAnalysis.adherenceUi.verdict.requirement', { codigo: acao.requisito_codigo })}</Chip></div>}
      </button>

      {detalhado && aberto && (
        <div className="space-y-4 border-t px-5 py-4 animate-in fade-in slide-in-from-top-1 duration-300">
          {acao.exigencia_norma && <Secao n={++n} titulo={k('requires')}>{acao.exigencia_norma}</Secao>}
          {acao.evidencia_documento && (
            <Secao n={++n} titulo={k('found')}>
              <blockquote className="rounded-r-md border-l-2 border-border bg-muted/30 px-3 py-1.5 italic text-muted-foreground">{acao.evidencia_documento}</blockquote>
            </Secao>
          )}
          {acao.impacto && <Secao n={++n} titulo={k('why')}>{acao.impacto}</Secao>}
          {acao.passos && acao.passos.length > 0 && (
            <Secao n={++n} titulo={k('steps')}>
              <ol className="list-decimal space-y-1 pl-4">{acao.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
            </Secao>
          )}
          {acao.texto_sugerido && (
            <Secao n={++n} titulo={k('suggested')}>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="whitespace-pre-wrap text-sm text-foreground">{acao.texto_sugerido}</p>
                <Button size="sm" variant="ghost" className="mt-2" onClick={copiar}>{k('copy')}</Button>
              </div>
            </Secao>
          )}
        </div>
      )}

      <div className="flex justify-end border-t px-5 py-2.5">
        <Button size="sm" variant={planoCriado ? 'ghost' : 'outline'} disabled={planoCriado || criando} onClick={onCriarPlano}>
          {criando && <AkurisPulse size={14} className="mr-2" />}
          {planoCriado && <IconSuccess className="mr-1.5 h-4 w-4 text-success" strokeWidth={1.5} />}
          {planoCriado ? t('gapAnalysis.adherenceUi.verdict.planExists') : t('gapAnalysis.adherenceUi.verdict.createPlan')}
        </Button>
      </div>
    </div>
  );
}
