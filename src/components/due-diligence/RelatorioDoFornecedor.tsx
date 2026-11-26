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
import { AnimatedMetricValue } from '@/components/ui/stat-strip';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateShort } from '@/lib/date-utils';
import { resolveScoreDueDiligenceTone } from '@/lib/status-tone';
import type { ParecerDaIA, SecaoDoParecer } from './parecer-ia-types';
import { alertasDeCoerencia, classeDaNota, coberturaDeEvidencia, ehLacuna, ehLacunaCritica, lacunasPorImpacto, notaDe } from './avaliacao-regras';

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
  temAnexo?: boolean;
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
          className={cn(TRACO[tom], 'akuris-motion-data transition-[stroke-dasharray] motion-reduce:transition-none')}
          strokeDasharray={`${preenchido} ${perimetro}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-semibold tabular-nums leading-none', TEXTO[tom])}>
          <AnimatedMetricValue value={score.toFixed(0)} />
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
      // `pontuacao` = nota × peso: comparar a NOTA, não o valor bruto.
      if (!ehLacuna(r)) continue;
      const chave = r.secao || t('dueDiligence.relatorioFornecedor.semSecao');
      porSecao.set(chave, [...(porSecao.get(chave) ?? []), r]);
    }
    // Dentro da secção, o que mais pesa primeiro: é por onde se começa.
    for (const lista of porSecao.values()) {
      lista.sort((a, b) => b.peso * (10 - (notaDe(b) ?? 0)) - a.peso * (10 - (notaDe(a) ?? 0)));
    }
    return porSecao;
  }, [respostas, t]);

  const tom = tomDoScore(scoreTotal);
  const coberturaEvid = coberturaDeEvidencia(respostas);
  const totalLacunas = respostas.filter(ehLacuna).length;
  const totalCriticas = respostas.filter(ehLacunaCritica).length;
  const alertas = alertasDeCoerencia(scoreTotal, respostas);

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

  const classe = classeDaNota(scoreTotal) ?? classificacao;
  const chaveClasse = classe === 'excelente' ? 'Excellent' : classe === 'bom' ? 'Good' : classe === 'regular' ? 'Regular' : 'Bad';
  const risco = (parecer?.nivelRisco ?? '').toLowerCase();
  const tomRisco: Tom = !risco ? 'neutral'
    : /baixo|low/.test(risco) ? 'success'
    : /m[eé]dio|moderado|medium/.test(risco) ? 'warning'
    : /alto|elevado|high/.test(risco) ? 'orange' : 'destructive';

  const lacunas = lacunasPorImpacto(respostas);
  const secoesComLacuna = Array.from(new Set(lacunas.map((r) => r.secao).filter(Boolean)));
  const [filtro, setFiltro] = React.useState<string | null>(null);
  const lacunasVisiveis = filtro ? lacunas.filter((r) => r.secao === filtro) : lacunas;
  const leiturasPorSecao = secoes
    .map((s) => ({ nome: s.nome, leitura: parecerPorSecao.get(s.nome.trim().toLowerCase()) }))
    .filter((x) => x.leitura && (x.leitura.pontosFortes?.length || x.leitura.pontosAtencao?.length || x.leitura.oQuePedir?.length));

  const kpis: { k: string; v: React.ReactNode; extra?: React.ReactNode; tom?: Tom }[] = [
    {
      k: t('dueDiligence.relatorioFornecedor.kpiPontuacao'),
      v: (<><AnimatedMetricValue value={scoreTotal.toFixed(0)} /><span className="text-base font-normal text-muted-foreground">/100</span></>),
      extra: (
        <StatusBadge {...resolveScoreDueDiligenceTone(scoreTotal)}>
          {t(`dueDiligence.scoreVisualization.classification${chaveClasse}`)}
        </StatusBadge>
      ),
    },
    {
      k: t('dueDiligence.relatorioFornecedor.kpiRiscoIa'),
      v: risco ? (
        <span className="inline-flex items-center gap-2 capitalize">
          <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', BARRA[tomRisco])} />
          {parecer?.nivelRisco}
        </span>
      ) : '—',
    },
    { k: t('dueDiligence.relatorioFornecedor.kpiCriticas'), v: String(totalCriticas), tom: totalCriticas ? 'destructive' : undefined },
    { k: t('dueDiligence.relatorioFornecedor.kpiEvidencia'), v: `${coberturaEvid}%`, tom: coberturaEvid === 0 ? 'destructive' : coberturaEvid < 50 ? 'warning' : undefined },
    { k: t('dueDiligence.relatorioFornecedor.kpiRespondido'), v: concluidoEm ? formatDateShort(concluidoEm) : '—' },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h3 className="text-base font-semibold text-foreground">{fornecedor}</h3>
        {template && <p className="text-xs text-muted-foreground">{template}</p>}
      </header>

      {/* ── faixa executiva ─────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 lg:grid-cols-5 rounded-lg border border-border bg-card divide-y lg:divide-y-0 lg:divide-x divide-border/60">
        {kpis.map((m, i) => (
          <div key={m.k} className={cn('px-5 py-4', i === 0 && 'col-span-2 lg:col-span-1')}>
            <dt className="text-xs text-muted-foreground">{m.k}</dt>
            <dd className={cn('mt-1.5 text-2xl font-semibold tabular-nums text-foreground', m.tom && TEXTO[m.tom])}>{m.v}</dd>
            {m.extra && <div className="mt-2">{m.extra}</div>}
          </div>
        ))}
      </dl>

      {alertas.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/40 border-l-2 border-l-destructive bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-foreground">{t('dueDiligence.relatorioFornecedor.alertaTitulo')}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {alertas.map((a) => (
              <li key={a}>{t(a === 'lacunas_criticas' ? 'dueDiligence.relatorioFornecedor.alertaCriticas' : 'dueDiligence.relatorioFornecedor.alertaEvidencia')}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── seções + leitura da IA ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <section className="rounded-lg border border-border bg-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4">{t('dueDiligence.relatorioFornecedor.desempenhoPorSecao')}</h4>
          <ul className="space-y-3">
            {secoes.map((s) => {
              const tomS = tomDoScore(s.score);
              return (
                <li key={s.nome} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm">
                  <span className="truncate text-foreground" title={s.nome}>{s.nome}</span>
                  <Progress value={s.score} indicatorClassName={BARRA[tomS]} className="h-1.5" />
                  <span className="text-right tabular-nums text-muted-foreground">
                    <span className={cn('font-semibold', TEXTO[tomS])}>{s.score.toFixed(0)}</span>/100
                  </span>
                </li>
              );
            })}
          </ul>
          {cobertura && <p className="mt-4 text-micro text-muted-foreground leading-relaxed">{cobertura}</p>}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">{t('dueDiligence.relatorioFornecedor.leituraDaIa')}</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {parecer?.resumo || t('dueDiligence.relatorioFornecedor.semParecer')}
          </p>
        </section>
      </div>

      {/* ── respostas que custaram pontos ────────────────────────────────── */}
      {lacunas.length > 0 && (
        <section className="rounded-lg border border-border bg-card">
          <div className="px-5 pt-5 pb-3">
            <h4 className="text-sm font-semibold text-foreground">{t('dueDiligence.relatorioFornecedor.custaramPontos')}</h4>
            <p className="text-xs text-muted-foreground">{t('dueDiligence.relatorioFornecedor.custaramPontosDesc')}</p>
            {secoesComLacuna.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[null, ...secoesComLacuna].map((s) => (
                  <button
                    key={s ?? '__todas'}
                    type="button"
                    onClick={() => setFiltro(s)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      filtro === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {s ?? t('dueDiligence.relatorioFornecedor.todas')}
                    <span className="ml-1 tabular-nums">({s ? lacunas.filter((r) => r.secao === s).length : lacunas.length})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto px-5 pb-4">
            <table className="akuris-table w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left font-medium py-2">{t('dueDiligence.relatorioFornecedor.colPergunta')}</th>
                  <th className="text-left font-medium py-2 w-28">{t('dueDiligence.relatorioFornecedor.colRespondeu')}</th>
                  <th className="text-right font-medium py-2 w-16">{t('dueDiligence.relatorioFornecedor.colNota')}</th>
                  <th className="text-right font-medium py-2 w-14">{t('dueDiligence.relatorioFornecedor.colPeso')}</th>
                  <th className="text-left font-medium py-2 pl-4 w-44">{t('dueDiligence.relatorioFornecedor.colSecao')}</th>
                </tr>
              </thead>
              <tbody>
                {lacunasVisiveis.map((r) => (
                  <tr key={r.question_id} className="border-t border-border/50">
                    <td className="py-2.5 pr-3 text-foreground">{r.titulo}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{r.resposta || '—'}</td>
                    <td className={cn('py-2.5 text-right tabular-nums font-semibold', TEXTO[tomDoScore((notaDe(r) ?? 0) * 10)])}>
                      {(notaDe(r) ?? 0).toFixed(0)}/10
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">×{r.peso}</td>
                    <td className="py-2.5 pl-4 text-xs text-muted-foreground truncate">{r.secao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── leitura da IA por seção (quando existe) ──────────────────────── */}
      {leiturasPorSecao.map(({ nome, leitura }) => (
        <section key={nome} id={idDaSecao(nome)} className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-4">
          <div className="px-4 py-3 border-b border-border/60">
            <h4 className="text-sm font-semibold text-foreground">{nome}</h4>
          </div>
          <Bloco titulo={t('dueDiligence.relatorioFornecedor.oQueEstaBem')} itens={leitura!.pontosFortes} tom="success" />
          <Bloco titulo={t('dueDiligence.relatorioFornecedor.oQuePrecisaAtencao')} itens={leitura!.pontosAtencao} tom="warning" />
          {leitura!.oQuePedir && leitura!.oQuePedir.length > 0 && (
            <div className="px-4 py-3 border-t border-border/60">
              <Rotulo tom="info">{t('dueDiligence.relatorioFornecedor.oQuePedir')}</Rotulo>
              <div className="mt-2 space-y-3">
                {leitura!.oQuePedir.map((p, i) => (
                  <div key={i} className="rounded-md border border-border overflow-hidden">
                    <p className="px-3 py-1.5 text-xs font-medium text-foreground bg-muted/40 border-b border-border/60">{p.pergunta}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
                      <div className="p-3">
                        <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('dueDiligence.relatorioFornecedor.colRespondeu')}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">{p.respondeu}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('dueDiligence.relatorioFornecedor.colPedir')}</p>
                        <p className="text-xs leading-relaxed text-foreground">{p.pedir}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}

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
