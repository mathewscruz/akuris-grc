/**
 * O que o utilizador vê depois de o fornecedor responder.
 *
 * ## O que estava
 *
 * Duas colunas desiguais dentro do mesmo diálogo: à esquerda o número grande e
 * umas barras de progresso; à direita, numa faixa estreita, o parecer da IA. E
 * um cartão de «Recomendações» com QUATRO frases fixas — uma por classificação
 * — que não recomendam nada: dizem outra vez o que a classificação já disse.
 *
 * Faltava o passo do meio: o número dizia QUANTO, o parecer dizia O QUÊ em
 * prosa, e nada dizia QUAIS respostas custaram pontos nem o que pedir por
 * causa delas.
 *
 * ## A forma
 *
 * Corredor à esquerda: mostrador com a nota, a classificação, cada secção com
 * a sua nota — e um plano de acção com os achados, as evidências em falta e os
 * próximos passos. À direita, secção a secção, três blocos rotulados:
 *
 *   O QUE ESTÁ BEM · O QUE PRECISA DE ATENÇÃO · O QUE PEDIR AO FORNECEDOR
 *
 * O terceiro é uma tabela RESPONDEU → PEDIR. É o par que torna o relatório
 * accionável: sem a segunda coluna, a análise descreve o problema a quem já o
 * tem.
 *
 * ## Duas coisas que não se misturam
 *
 * O NÚMERO é aritmética: nota por resposta × peso da pergunta, tudo à vista
 * para ser conferido. O PARECER é leitura da IA sobre o mesmo material,
 * incluindo o texto livre que o número não pontua. Ficam lado a lado e
 * rotulados, nunca fundidos num só valor.
 *
 * ## Sobre o desenho
 *
 * O modelo que inspirou isto tinha o corredor em painel escuro. Aqui as
 * superfícies são claras e separadas por fio, com um só realce no hover — é a
 * linguagem do produto, defendida por teste. Copia-se a ESTRUTURA (mostrador,
 * secções com nota, plano de acção, blocos rotulados, tabela de duas colunas),
 * não a pele de outro produto.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateShort } from '@/lib/date-utils';
import { resolveScoreDueDiligenceTone } from '@/lib/status-tone';
import type { ParecerDaIA, SecaoDoParecer } from './ParecerIA';

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

/*
   A escala do score vem de `resolveScoreDueDiligenceTone`, e não daqui.

   Este ficheiro tinha a SUA -- success/info/warning/destructive -- e havia mais
   duas: quatro faixas na lista de avaliações e três na de fornecedores. O
   mesmo fornecedor mudava de cor conforme o ecrã. Pior, `info` desenha-se
   cinzento nos crachás (é o tom de «nada a fazer»), por isso a faixa mais
   comum saía sem cor nenhuma.
*/
type Tom = 'success' | 'warning' | 'orange' | 'destructive' | 'info' | 'neutral' | 'primary';

const tomDoScore = (score: number): Tom => resolveScoreDueDiligenceTone(score).tone;

const TEXTO: Record<Tom, string> = {
  success: 'text-success',
  warning: 'text-warning',
  orange: 'text-orange',
  destructive: 'text-destructive',
  info: 'text-info',
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
};

const BARRA: Record<Tom, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  orange: 'bg-orange',
  destructive: 'bg-destructive',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
};

const TRACO: Record<Tom, string> = {
  success: 'stroke-success',
  warning: 'stroke-warning',
  orange: 'stroke-orange',
  destructive: 'stroke-destructive',
  info: 'stroke-info',
  neutral: 'stroke-muted-foreground',
  primary: 'stroke-primary',
};

/** O formato antigo do `score_breakdown` era um número solto por secção. */
function lerSecao(valor: SecaoDoScore | number): SecaoDoScore {
  return typeof valor === 'number' ? { score: valor, perguntas: 0 } : valor;
}

function idDaSecao(nome: string) {
  return `secao-${nome.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
}

/**
 * O mostrador da nota global.
 *
 * Um número solto lê-se como texto; num anel lê-se como posição numa escala —
 * vê-se de relance quanto falta para o topo, que é a pergunta que se faz a um
 * relatório destes.
 */
function Mostrador({ score, tom }: { score: number; tom: Tom }) {
  const r = 34;
  const perimetro = 2 * Math.PI * r;
  const preenchido = (Math.max(0, Math.min(100, score)) / 100) * perimetro;
  return (
    <div className="relative mx-auto h-[88px] w-[88px]">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-border" />
        <circle
          cx="40" cy="40" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className={TRACO[tom]}
          strokeDasharray={`${preenchido} ${perimetro}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-semibold tabular-nums leading-none', TEXTO[tom])}>
          {score.toFixed(0)}
        </span>
        <span className="text-micro text-muted-foreground leading-none mt-0.5">/100</span>
      </div>
    </div>
  );
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

  /** A leitura da IA para cada secção, por nome. */
  const parecerPorSecao = React.useMemo(() => {
    const mapa = new Map<string, SecaoDoParecer>();
    for (const s of parecer?.secoes ?? []) mapa.set(s.secao.trim().toLowerCase(), s);
    return mapa;
  }, [parecer]);

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

  const irPara = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* O plano de acção: os achados, o que falta em prova, o que fazer a seguir.
     São os três que quem lê o relatório leva consigo. */
  const plano = [
    { id: 'plano-achados', rotulo: t('dueDiligence.relatorioFornecedor.achados'), itens: parecer?.pontosAtencao },
    { id: 'plano-evidencias', rotulo: t('dueDiligence.parecerIA.evidenciasEmFalta'), itens: parecer?.evidenciasEmFalta },
    { id: 'plano-passos', rotulo: t('dueDiligence.relatorioFornecedor.proximosPassos'), itens: parecer?.recomendacoes },
  ].filter((p) => p.itens && p.itens.length > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-6 items-start">
      {/* ── corredor ────────────────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-0 rounded-lg border border-border bg-card divide-y divide-border/60">
        <div className="p-4 text-center">
          <Mostrador score={scoreTotal} tom={tom} />
          <div className="mt-2.5 flex justify-center">
            <StatusBadge {...resolveScoreDueDiligenceTone(scoreTotal)}>
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
          <nav className="p-3">
            <p className="px-2 text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t('dueDiligence.relatorioFornecedor.porSecao')}
            </p>
            <ul>
              {secoes.map((s) => (
                <li key={s.nome}>
                  <button
                    type="button"
                    onClick={() => irPara(idDaSecao(s.nome))}
                    className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                  >
                    <span className="truncate text-foreground">{s.nome}</span>
                    <span className={cn('shrink-0 tabular-nums font-semibold', TEXTO[tomDoScore(s.score)])}>
                      {s.score.toFixed(0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {plano.length > 0 && (
          <nav className="p-3">
            <p className="px-2 text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t('dueDiligence.relatorioFornecedor.planoDeAccao')}
            </p>
            <ul>
              {plano.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => irPara(p.id)}
                    className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                  >
                    <span className="truncate text-foreground">{p.rotulo}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{p.itens!.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Sobre o que a conta se fez. Sem isto, o número parece cobrir tudo. */}
        {cobertura && (
          <p className="p-4 text-micro text-muted-foreground leading-relaxed">{cobertura}</p>
        )}
      </aside>

      <div className="min-w-0 space-y-5">
        <header>
          <h3 className="text-base font-semibold text-foreground">{fornecedor}</h3>
          {template && <p className="text-xs text-muted-foreground">{template}</p>}
        </header>

        {parecer?.resumo && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t('dueDiligence.relatorioFornecedor.leituraDaIa')}
            </p>
            <p className="text-sm leading-relaxed text-foreground">{parecer.resumo}</p>
          </div>
        )}

        {/* ── secção a secção ─────────────────────────────────────────────── */}
        {secoes.map((s) => {
          const custaram = custaramPontos.get(s.nome) ?? [];
          const leitura = parecerPorSecao.get(s.nome.trim().toLowerCase());
          const tomS = tomDoScore(s.score);
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
                <StatusBadge tone={tomS} variant="soft">
                  <span className="tabular-nums">{s.score.toFixed(0)}/100</span>
                </StatusBadge>
              </div>
              <div className="px-4 pt-3">
                <Progress value={s.score} indicatorClassName={BARRA[tomS]} className="h-1.5" />
              </div>

              <Bloco titulo={t('dueDiligence.relatorioFornecedor.oQueEstaBem')} itens={leitura?.pontosFortes} tom="success" />
              <Bloco titulo={t('dueDiligence.relatorioFornecedor.oQuePrecisaAtencao')} itens={leitura?.pontosAtencao} tom="warning" />

              {/* RESPONDEU → PEDIR: as duas colunas que tornam isto accionável. */}
              {leitura?.oQuePedir && leitura.oQuePedir.length > 0 && (
                <div className="px-4 py-3 border-t border-border/60">
                  <Rotulo tom="info">{t('dueDiligence.relatorioFornecedor.oQuePedir')}</Rotulo>
                  <div className="mt-2 space-y-3">
                    {leitura.oQuePedir.map((p, i) => (
                      <div key={i} className="rounded-md border border-border overflow-hidden">
                        <p className="px-3 py-1.5 text-xs font-medium text-foreground bg-muted/40 border-b border-border/60">
                          {p.pergunta}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
                          <div className="p-3">
                            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              {t('dueDiligence.relatorioFornecedor.colRespondeu')}
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground">{p.respondeu}</p>
                          </div>
                          <div className="p-3">
                            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              {t('dueDiligence.relatorioFornecedor.colPedir')}
                            </p>
                            <p className="text-xs leading-relaxed text-foreground">{p.pedir}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* A aritmética, sempre à vista: é o que sustenta a nota da secção. */}
              {custaram.length > 0 && (
                <div className="px-4 py-3 border-t border-border/60">
                  <Rotulo tom="destructive">{t('dueDiligence.relatorioFornecedor.custaramPontos')}</Rotulo>
                  <div className="mt-2 overflow-x-auto">
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
                        {custaram.map((r) => (
                          <tr key={r.question_id} className="border-t border-border/50">
                            <td className="py-1.5 pr-3 text-foreground">{r.titulo}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{r.resposta || '—'}</td>
                            <td className={cn('py-1.5 text-right tabular-nums font-semibold', TEXTO[tomDoScore((r.pontuacao ?? 0) * 10)])}>
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

              {custaram.length === 0 && !leitura && (
                <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border/60">
                  {t('dueDiligence.relatorioFornecedor.nadaACobrar')}
                </p>
              )}
            </section>
          );
        })}

        {/* ── plano de acção ─────────────────────────────────────────────── */}
        {plano.map((p) => (
          <section key={p.id} id={p.id} className="rounded-lg border border-border bg-card scroll-mt-4">
            <div className="px-4 py-3 border-b border-border/60">
              <h4 className="text-sm font-semibold text-foreground">{p.rotulo}</h4>
            </div>
            <ul className="p-4 space-y-1.5">
              {p.itens!.map((item, i) => (
                <li key={i} className="text-sm leading-relaxed text-foreground flex gap-2">
                  <span aria-hidden className="text-muted-foreground shrink-0">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** O rótulo de um bloco, com o fio de cor à esquerda. */
function Rotulo({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  const fio = tom === 'success' ? 'bg-success' : tom === 'warning' ? 'bg-warning' : tom === 'info' ? 'bg-info' : 'bg-destructive';
  return (
    <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
      <span aria-hidden className={cn('h-3 w-0.5 rounded-full', fio)} />
      {children}
    </p>
  );
}

/** Uma lista rotulada dentro do cartão da secção. */
function Bloco({ titulo, itens, tom }: { titulo: string; itens?: string[]; tom: Tom }) {
  if (!itens || itens.length === 0) return null;
  return (
    <div className="px-4 py-3 border-t border-border/60">
      <Rotulo tom={tom}>{titulo}</Rotulo>
      <ul className="mt-2 space-y-1.5">
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
