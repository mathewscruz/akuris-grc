/**
 * CartaoDeProntidao — «já posso marcar a auditoria?»
 *
 * É a última pergunta do percurso e a única que o módulo não respondia. Havia
 * o índice ("87%"), as fases ("estás na terceira") e a fila ("faz estes seis"),
 * e nada que dissesse se 87% chega. Não chega: numa ISO, um requisito aplicável
 * por cumprir reprova o Estágio 2. Quem contrata consultoria tem alguém que diz
 * «ainda não» ou «pode ir»; sem isso, a pessoa marca cedo e reprova, ou não
 * marca nunca.
 *
 * Três decisões que se vêem no ecrã:
 *
 *  · **Cada bloqueio é clicável.** Dizer «faltam 12 por avaliar» sem levar lá é
 *    dar um problema sem o caminho. Filtra a tabela por aquele estado.
 *  · **O desfecho é o da família certa.** Quem trabalha a LGPD não lê «contrate
 *    um organismo certificador» — não existe certificado de LGPD.
 *  · **A ressalva fica sempre visível**, também quando está pronto. O produto vê
 *    o que está registado nele; a qualidade da prova é juízo do auditor.
 *    Afirmar mais do que isto era o género de promessa que o resto deste módulo
 *    foi corrigido para não fazer.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { fimDoPercurso } from '@/lib/gap-fases';
import { prontidaoDoFramework, type ContagemDaCategoria } from '@/lib/gap-prontidao';
import { SectionHead } from './SectionHead';
import { IconSuccess, IconWarning, IconArrowRight } from '@/components/icons';

interface Props {
  frameworkName: string;
  /** As mesmas contagens que alimentam o mapa de calor e o painel de fases. */
  categorias: ContagemDaCategoria[];
  /**
   * Requisitos conformes sem prova nenhuma. `null` quando não se conseguiu
   * contar — e aí não se acusa ninguém.
   */
  conformesSemProva?: number | null;
  /** Leva à tabela já filtrada por aquele estado. */
  onVerEstado: (estado: string) => void;
}

export function CartaoDeProntidao({ frameworkName, categorias, conformesSemProva = null, onVerEstado }: Props) {
  const { t } = useLanguage();
  const p = useMemo(
    () => prontidaoDoFramework(categorias, conformesSemProva),
    [categorias, conformesSemProva],
  );
  const fim = fimDoPercurso(frameworkName);

  /* Sem requisitos carregados não há nada a dizer — e dizer «pronto» a um ecrã
     que ainda está a carregar seria a pior altura para o dizer. */
  if (p.aplicaveis === 0 && p.bloqueios.length === 0) return null;

  return (
    <section
      className={cn(
        'rounded-lg border bg-card p-5',
        p.pronto ? 'border-state-done/40' : 'border-border',
      )}
    >
      <SectionHead title={t('gapProntidao.titulo')} />

      <div className="flex items-start gap-3">
        {p.pronto ? (
          <IconSuccess className="mt-0.5 h-5 w-5 shrink-0 text-state-done" strokeWidth={1.5} />
        ) : (
          <IconWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" strokeWidth={1.5} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-6 text-foreground">
            {p.pronto
              ? t(`gapProntidao.pronto_${fim}`)
              : t('gapProntidao.aindaNao', {
                  feitos: p.conformes,
                  total: p.aplicaveis,
                })}
          </p>

          {p.bloqueios.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {p.bloqueios.map((b) => (
                <li key={b.chave}>
                  <button
                    type="button"
                    onClick={() => onVerEstado(b.chave === 'conforme_sem_prova' ? 'conforme' : b.chave)}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-md border border-border',
                      'bg-background px-3 py-2 text-left text-sm transition-ui',
                      'hover:border-primary/40 hover:bg-accent/40',
                    )}
                  >
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {String(b.quantos).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 text-foreground/85">
                      {t(`gapProntidao.bloqueio.${b.chave}`, { count: b.quantos })}
                    </span>
                    <IconArrowRight
                      className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-ui group-hover:opacity-100"
                      strokeWidth={1.5}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* A ressalva. Vale nos dois estados, e sobretudo no «pronto». */}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {t('gapProntidao.ressalva')}
          </p>
        </div>
      </div>
    </section>
  );
}
