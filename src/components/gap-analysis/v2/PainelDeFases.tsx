/**
 * PainelDeFases — o plano, permanente e clicável.
 *
 * O módulo tinha um "Roteiro Recomendado" bom e específico por framework, que
 * aparecia uma vez, em ecrã cheio, antes da primeira avaliação, e desaparecia
 * para sempre. Quem perguntava "o que faço primeiro" já tinha passado por cima
 * dele — e os quatro passos que mostrava eram sobre preencher a avaliação, não
 * sobre ficar em conformidade ("foque nos de maior peso para maximizar o
 * score").
 *
 * Aqui o plano fica. Quatro fases com nome de resultado, o progresso de cada
 * uma, a duração típica, e ao clique filtra a tabela pelas categorias daquela
 * fase. É a peça que responde "por onde começo" todos os dias, e não só no
 * primeiro.
 *
 * Não desenha nada quando o framework não tem plano: um framework sem fases
 * continua a funcionar exactamente como funcionava.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { fasesDe, chaveDoFramework, progressoDasFases } from '@/lib/gap-fases';
import { useLanguage } from '@/contexts/LanguageContext';
import { SectionHead } from './SectionHead';
import { IconSuccess, IconArrowRight } from '@/components/icons';

interface CategoriaContada {
  categoria: string;
  total: number;
  conforme: number;
  nao_aplicavel: number;
}

interface Props {
  frameworkName: string;
  /** As mesmas contagens que alimentam o mapa de calor. */
  categorias: CategoriaContada[];
  /** Filtra a tabela pelas categorias da fase e leva o utilizador até ela. */
  onEscolherFase: (categorias: string[]) => void;
  /** A fase actualmente a filtrar, se houver. */
  faseAtiva?: string | null;
}

export function PainelDeFases({ frameworkName, categorias, onEscolherFase, faseAtiva }: Props) {
  const { t } = useLanguage();
  const chave = chaveDoFramework(frameworkName);
  const fases = fasesDe(frameworkName);

  const linhas = useMemo(() => {
    if (!fases) return [];
    /*
      Um requisito fora do escopo não é trabalho: entra no denominador da fase
      como já resolvido. Sem isto, uma empresa que declarou metade do Anexo A
      inaplicável via a fase três parada em 40% para sempre.
    */
    const total: Record<string, number> = {};
    const feitos: Record<string, number> = {};
    for (const c of categorias) {
      total[c.categoria] = c.total;
      feitos[c.categoria] = c.conforme + c.nao_aplicavel;
    }
    return progressoDasFases(fases, total, feitos);
  }, [fases, categorias]);

  if (!chave || linhas.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionHead title={t('gapFases.titulo')} />
      <p className="-mt-1 mb-4 text-xs leading-6 text-muted-foreground">
        {t('gapFases.subtitulo')}
      </p>

      <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {linhas.map((fase) => {
          const pct = fase.total > 0 ? Math.round((fase.concluidos / fase.total) * 100) : 0;
          const fechada = fase.total > 0 && fase.concluidos >= fase.total;
          const ativa = faseAtiva === fase.id;
          return (
            <li key={fase.id}>
              <button
                type="button"
                onClick={() => onEscolherFase(fase.categorias)}
                aria-pressed={ativa}
                className={cn(
                  'group h-full w-full rounded-lg border bg-background p-3 text-left transition-ui',
                  'hover:border-primary/40 hover:bg-accent/40',
                  ativa ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {String(fase.ordem).padStart(2, '0')}
                  </span>
                  {fechada ? (
                    <IconSuccess className="h-3.5 w-3.5 text-success" strokeWidth={1.5} />
                  ) : fase.atual ? (
                    /* Um só realce, e é onde o trabalho está agora. */
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-micro font-medium text-primary">
                      {t('gapFases.agora')}
                    </span>
                  ) : null}
                </div>

                <h4 className="mt-1.5 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                  {t(`gapFases.${chave}.${fase.id}.nome`)}
                </h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t(`gapFases.${chave}.${fase.id}.resultado`)}
                </p>

                <div className="mt-3">
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', fechada ? 'bg-success' : 'bg-primary')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-micro tabular-nums text-muted-foreground">
                    <span>{t('gapFases.progresso', { feitos: fase.concluidos, total: fase.total })}</span>
                    <span>{t('gapFases.semanas', { semanas: fase.semanas })}</span>
                  </div>
                </div>

                <span className="mt-2 inline-flex items-center gap-1 text-micro text-muted-foreground group-hover:text-primary transition-colors">
                  {t('gapFases.verRequisitos')}
                  <IconArrowRight className="h-3 w-3" strokeWidth={1.5} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
