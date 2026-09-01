/**
 * O que o utilizador vê depois de o fornecedor responder.
 *
 * ## O que estava
 *
 * Duas colunas desiguais dentro do mesmo diálogo: à esquerda o número grande e
 * umas barras de progresso; à direita, numa faixa estreita, o parecer da IA. E
 * um cartão de «Recomendações» com QUATRO frases fixas — uma por classificação
 * — que não recomendam nada: dizem outra vez o que a classificação já disse.
 * As recomendações a sério vinham no parecer e ficavam na coluna de lado.
 *
 * Faltava, sobretudo, o passo do meio: o número dizia QUANTO, o parecer dizia
 * O QUÊ em prosa, e nada dizia QUAIS respostas custaram pontos. Quem lê um
 * relatório de due diligence quer exactamente isso para poder cobrar o
 * fornecedor.
 *
 * ## O que fica
 *
 * Um relatório com corredor de navegação à esquerda — nota global,
 * classificação e cada secção com a sua — e, à direita, a leitura: o que está
 * bem, o que precisa de atenção, o que falta em evidência, o que fazer a
 * seguir, e depois **secção a secção, as respostas que tiraram pontos**, com a
 * pergunta, o que o fornecedor respondeu, a nota e o peso.
 *
 * ## Duas coisas que não se misturam
 *
 * O NÚMERO é aritmética: nota por resposta × peso da pergunta, e está tudo à
 * vista para ser conferido. O PARECER é leitura da IA sobre o mesmo material,
 * incluindo o texto livre que o número não pontua. Ficam lado a lado e
 * rotulados, nunca fundidos num só valor.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateShort } from '@/lib/date-utils';
import type { ParecerDaIA } from './ParecerIA';

/** Uma secção como o cálculo a devolve. */
export interface SecaoDoScore {
  score: number;
  perguntas: number;
}

/** Uma resposta, já pontuada pelo cálculo. */
export interface RespostaPontuada {
  question_id: string;
  secao: string;
  titulo: string;
  resposta: string | null;
  pontuacao: number | null;
  peso: number;
}

interface Props {
  fornecedor: string;
  template?: string;
  concluidoEm?: string | null;
  scoreTotal: number;
  classificacao: string;
  /** `{ secao: { score, perguntas } }`. Aceita também o formato antigo, `{ secao: number }`. */
  breakdown: Record<string, SecaoDoScore | number> | null;
  cobertura?: string | null;
  respostas: RespostaPontuada[];
  parecer: ParecerDaIA | null;
}

/** Abaixo disto uma resposta entra na lista do que custou pontos. */
const NOTA_QUE_PREOCUPA = 6;

function tomDoScore(score: number) {
  if (score >= 80) return 'success' as const;
  if (score >= 60) return 'info' as const;
  if (score >= 40) return 'warning' as const;
  return 'destructive' as const;
}

const CLASSE_DO_TOM: Record<ReturnType<typeof tomDoScore>, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

const BARRA_DO_TOM: Record<ReturnType<typeof tomDoScore>, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/** O formato antigo do `score_breakdown` era um número solto por secção. */
function lerSecao(valor: SecaoDoScore | number): SecaoDoScore {
  return typeof valor === 'number' ? { score: valor, perguntas: 0 } : valor;
}

function idDaSecao(nome: string) {
  return `secao-${nome.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
}

export function RelatorioDoFornecedor({
  fornecedor,
  template,
  concluidoEm,
  scoreTotal,
  classificacao,
  breakdown,
  cobertura,
  respostas,
  parecer,
}: Props) {
  const { t } = useLanguage();

  const secoes = React.useMemo(
    () =>
      Object.entries(breakdown ?? {})
        .map(([nome, valor]) => ({ nome, ...lerSecao(valor) }))
        // Da pior para a melhor: num relatório de risco, o que dói vem primeiro.
        .sort((a, b) => a.score - b.score),
    [breakdown],
  );

  /* As respostas que custaram pontos, agrupadas pela secção a que pertencem. */
  const custaramPontos = React.useMemo(() => {
    const porSecao = new Map<string, RespostaPontuada[]>();
    for (const r of respostas) {
      if (r.pontuacao === null || r.pontuacao >= NOTA_QUE_PREOCUPA) continue;
      const chave = r.secao || t('dueDiligence.relatorioFornecedor.semSecao');
      porSecao.set(chave, [...(porSecao.get(chave) ?? []), r]);
    }
    // Dentro da secção, o que mais pesa primeiro: é por onde se começa.
    for (const lista of porSecao.values()) {
      lista.sort((a, b) => b.peso * (10 - (b.pontuacao ?? 0)) - a.peso * (10 - (a.pontuacao ?? 0)));
    }
    return porSecao;
  }, [respostas, t]);

  const tom = tomDoScore(scoreTotal);

  const irPara = (nome: string) => {
    document.getElementById(idDaSecao(nome))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[236px_1fr] gap-6 items-start">
      {/* ── corredor: a nota, a classificação e por onde entrar ───────────── */}
      <aside className="lg:sticky lg:top-0 rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="text-center">
          <div className={cn('text-4xl font-semibold tabular-nums leading-none', CLASSE_DO_TOM[tom])}>
            {scoreTotal.toFixed(0)}
            <span className="text-base text-muted-foreground font-normal">/100</span>
          </div>
          <div className="mt-2 flex justify-center">
            <StatusBadge tone={tom} variant="soft">
              {t(`dueDiligence.scoreVisualization.classification${
                classificacao === 'excelente' ? 'Excellent'
                : classificacao === 'bom' ? 'Good'
                : classificacao === 'regular' ? 'Regular' : 'Bad'
              }`)}
            </StatusBadge>
          </div>
          {concluidoEm && (
            <p className="mt-2 text-micro text-muted-foreground">
              {t('dueDiligence.relatorioFornecedor.respondidoEm', { data: formatDateShort(concluidoEm) })}
            </p>
          )}
        </div>

        {secoes.length > 0 && (
          <div className="border-t border-border/60 pt-3">
            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {t('dueDiligence.relatorioFornecedor.porSecao')}
            </p>
            <ul className="space-y-0.5">
              {secoes.map((s) => (
                <li key={s.nome}>
                  <button
                    type="button"
                    onClick={() => irPara(s.nome)}
                    className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                  >
                    <span className="truncate text-foreground">{s.nome}</span>
                    <span className={cn('shrink-0 tabular-nums font-semibold', CLASSE_DO_TOM[tomDoScore(s.score)])}>
                      {s.score.toFixed(0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sobre o que a conta se fez. Sem isto, o número parece cobrir tudo. */}
        {cobertura && (
          <p className="border-t border-border/60 pt-3 text-micro text-muted-foreground leading-relaxed">
            {cobertura}
          </p>
        )}
      </aside>

      <div className="min-w-0 space-y-5">
        <header>
          <h3 className="text-base font-semibold text-foreground">{fornecedor}</h3>
          {template && <p className="text-xs text-muted-foreground">{template}</p>}
        </header>

        {/* ── a leitura da IA, separada do cálculo e dita como tal ────────── */}
        {parecer && (
          <div className="space-y-4">
            {parecer.resumo && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  {t('dueDiligence.relatorioFornecedor.leituraDaIa')}
                </p>
                <p className="text-sm leading-relaxed text-foreground">{parecer.resumo}</p>
              </div>
            )}
            <Faixa titulo={t('dueDiligence.parecerIA.pontosFortes')} itens={parecer.pontosFortes} tom="success" />
            <Faixa titulo={t('dueDiligence.parecerIA.pontosAtencao')} itens={parecer.pontosAtencao} tom="warning" />
            <Faixa titulo={t('dueDiligence.parecerIA.evidenciasEmFalta')} itens={parecer.evidenciasEmFalta} tom="info" />
            <Faixa titulo={t('dueDiligence.parecerIA.recomendacoes')} itens={parecer.recomendacoes} tom="info" />
          </div>
        )}

        {/* ── secção a secção: QUAIS respostas custaram pontos ────────────── */}
        {secoes.map((s) => {
          const problemas = custaramPontos.get(s.nome) ?? [];
          return (
            <section
              key={s.nome}
              id={idDaSecao(s.nome)}
              className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-4"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{s.nome}</h4>
                  {s.perguntas > 0 && (
                    <p className="text-micro text-muted-foreground">
                      {t('dueDiligence.relatorioFornecedor.perguntasContadas', { n: String(s.perguntas) })}
                    </p>
                  )}
                </div>
                <span className={cn('shrink-0 text-lg font-semibold tabular-nums', CLASSE_DO_TOM[tomDoScore(s.score)])}>
                  {s.score.toFixed(0)}<span className="text-xs text-muted-foreground font-normal">/100</span>
                </span>
              </div>
              <div className="px-4 py-2">
                <Progress value={s.score} indicatorClassName={BARRA_DO_TOM[tomDoScore(s.score)]} className="h-1.5" />
              </div>

              {problemas.length === 0 ? (
                <p className="px-4 pb-4 pt-2 text-xs text-muted-foreground">
                  {t('dueDiligence.relatorioFornecedor.nadaACobrar')}
                </p>
              ) : (
                <div className="px-4 pb-4 pt-2">
                  <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {t('dueDiligence.relatorioFornecedor.custaramPontos')}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-micro uppercase tracking-wide text-muted-foreground">
                          <th className="text-left font-medium pb-1.5">{t('dueDiligence.relatorioFornecedor.colPergunta')}</th>
                          <th className="text-left font-medium pb-1.5 w-24">{t('dueDiligence.relatorioFornecedor.colRespondeu')}</th>
                          <th className="text-right font-medium pb-1.5 w-14">{t('dueDiligence.relatorioFornecedor.colNota')}</th>
                          <th className="text-right font-medium pb-1.5 w-14">{t('dueDiligence.relatorioFornecedor.colPeso')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemas.map((r) => (
                          <tr key={r.question_id} className="border-t border-border/50">
                            <td className="py-1.5 pr-3 text-foreground">{r.titulo}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{r.resposta || '—'}</td>
                            <td className={cn('py-1.5 text-right tabular-nums font-semibold', CLASSE_DO_TOM[tomDoScore((r.pontuacao ?? 0) * 10)])}>
                              {(r.pontuacao ?? 0).toFixed(0)}/10
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">×{r.peso}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Uma lista do parecer, com o seu rótulo e o seu tom. */
function Faixa({
  titulo,
  itens,
  tom,
}: {
  titulo: string;
  itens?: string[];
  tom: 'success' | 'warning' | 'info';
}) {
  if (!itens || itens.length === 0) return null;
  const borda = tom === 'success' ? 'border-l-success' : tom === 'warning' ? 'border-l-warning' : 'border-l-info';
  return (
    <div className={cn('rounded-lg border border-border border-l-2 bg-card p-4', borda)}>
      <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-2">{titulo}</p>
      <ul className="space-y-1.5">
        {itens.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-foreground flex gap-2">
            <span aria-hidden className="text-muted-foreground shrink-0">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
