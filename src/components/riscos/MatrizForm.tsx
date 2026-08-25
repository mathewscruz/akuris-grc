/**
 * MatrizForm — configurar a matriz de risco da empresa.
 *
 * Tinha 34 campos e 37 botões em duas telas e meia de rolagem, para configurar
 * o que quase toda a gente deixa no padrão 5×5. Havia ainda uma lista de
 * "matrizes salvas" com criação livre, num produto onde só uma matriz por
 * empresa é lida — e nada dizia qual delas estava a valer.
 *
 * Passa a ter três decisões à vista (tamanho da escala, método, apetite) e
 * tudo o resto — rótulos, cores, limites das faixas — atrás de "Personalizar".
 *
 * Duas regras novas, que antes só existiam na cabeça de quem configurava:
 *
 *  1. Mudar a escala ou o método REAJUSTA as faixas. Escolher "Soma" numa 5×5
 *     baixa o resultado máximo de 25 para 10; as faixas continuavam 1–4 / 5–9 /
 *     10–16 / 17–25, "Crítico" tornava-se inatingível e "acima do apetite"
 *     ficava preso em zero, sem um único aviso no ecrã.
 *  2. Gravar reclassifica a carteira, e o utilizador vê quantos riscos mudam
 *     de nível antes de confirmar. O rodapé dizia "Alterações afetam novos
 *     cálculos de risco" — ou seja, os riscos já registados ficavam com o
 *     rótulo antigo para sempre.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  IconAdd,
  IconDelete,
  IconWarning,
  IconGrid,
  IconCalculator,
  IconChevron,
  IconInfo,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { MatrizPreviewGrid } from './MatrizPreviewGrid';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import {
  DEFAULT_ESCALA_IMPACTO,
  DEFAULT_ESCALA_PROBABILIDADE,
  DEFAULT_MATRIZ_NOME,
  DEFAULT_NIVEIS_RISCO,
  apetiteScoreDaConfig,
  faixasPara,
  validarFaixas,
  type EscalaItem,
  type NivelRisco,
  type MetodoCalculo,
} from './matriz-config';

const COLOR_PALETTE = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#dc2626', '#6b7280', '#3b82f6', '#7552ff'];

/** Escalas oferecidas. Fora destas, o utilizador acrescenta níveis à mão. */
const TAMANHOS = [3, 4, 5, 6] as const;

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLanguage();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('fin.riscos.matrizForm.selecionarCor')}
          className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                'h-7 w-7 rounded-md border transition-ui hover:scale-110',
                value === c ? 'border-foreground ring-2 ring-foreground/20' : 'border-border',
              )}
              style={{ backgroundColor: c }}
              aria-label={t('sweepRiscos.riscos.matrizForm.corAria', { cor: c })}
            />
          ))}
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs font-mono"
          placeholder="#hex"
        />
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-3">
      <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
      <h4 className="text-sm font-semibold text-foreground mt-0.5">{title}</h4>
    </div>
  );
}

interface RiscoReclassificado {
  risco_id: string;
  codigo: string | null;
  nome: string;
  nivel_atual: string | null;
  nivel_novo: string | null;
}

interface Props {
  onSuccess: () => void;
}

export function MatrizForm({ onSuccess }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [gravando, setGravando] = useState(false);
  const [avancado, setAvancado] = useState(false);

  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [nome, setNome] = useState(DEFAULT_MATRIZ_NOME);
  const [descricao, setDescricao] = useState('');
  const [escalaProbabilidade, setEscalaProbabilidade] = useState<EscalaItem[]>(DEFAULT_ESCALA_PROBABILIDADE);
  const [escalaImpacto, setEscalaImpacto] = useState<EscalaItem[]>(DEFAULT_ESCALA_IMPACTO);
  const [niveisRisco, setNiveisRisco] = useState<NivelRisco[]>(DEFAULT_NIVEIS_RISCO);
  const [metodoCalculo, setMetodoCalculo] = useState<MetodoCalculo>('multiplicacao');
  const [apetiteScore, setApetiteScore] = useState<number | null>(null);

  const [reclassificados, setReclassificados] = useState<RiscoReclassificado[] | null>(null);
  const [carregandoPrevisao, setCarregandoPrevisao] = useState(false);

  const pMax = escalaProbabilidade.length;
  const iMax = escalaImpacto.length;

  const problema = useMemo(
    () => validarFaixas(niveisRisco, pMax, iMax, metodoCalculo),
    [niveisRisco, pMax, iMax, metodoCalculo],
  );

  const configAtual = useMemo(
    () => ({
      escala_probabilidade: escalaProbabilidade,
      escala_impacto: escalaImpacto,
      niveis_risco: niveisRisco,
      metodo_calculo: metodoCalculo,
      apetite_score: apetiteScore,
    }),
    [escalaProbabilidade, escalaImpacto, niveisRisco, metodoCalculo, apetiteScore],
  );

  // ── carregar a matriz vigente ─────────────────────────────────────────
  useEffect(() => {
    if (!profile?.empresa_id) return;
    (async () => {
      setCarregando(true);
      const { data, error } = await supabase
        .from('riscos_matrizes')
        .select(`
          id, nome, descricao,
          configuracao:riscos_matriz_configuracao(
            escala_probabilidade, escala_impacto, niveis_risco, metodo_calculo, apetite_score
          )
        `)
        .eq('empresa_id', profile.empresa_id)
        .eq('ativa', true)
        .maybeSingle();

      if (error) {
        toast.error(t('fin.comum.erroCarregarDados', { mensagem: error.message }));
      } else if (data) {
        const cfg = Array.isArray(data.configuracao) ? data.configuracao[0] : data.configuracao;
        setMatrizId(data.id);
        setNome(data.nome);
        setDescricao(data.descricao || '');
        if (cfg) {
          setEscalaProbabilidade((cfg.escala_probabilidade as unknown as EscalaItem[]) || DEFAULT_ESCALA_PROBABILIDADE);
          setEscalaImpacto((cfg.escala_impacto as unknown as EscalaItem[]) || DEFAULT_ESCALA_IMPACTO);
          setNiveisRisco((cfg.niveis_risco as unknown as NivelRisco[]) || DEFAULT_NIVEIS_RISCO);
          setMetodoCalculo((cfg.metodo_calculo as MetodoCalculo) || 'multiplicacao');
          setApetiteScore(
            cfg.apetite_score ??
              apetiteScoreDaConfig({ niveis_risco: cfg.niveis_risco as unknown as NivelRisco[] }),
          );
        }
      }
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.empresa_id]);

  // ── prévia da reclassificação, sempre que a classificação muda ────────
  useEffect(() => {
    if (carregando || problema) {
      setReclassificados(null);
      return;
    }
    let cancelado = false;
    setCarregandoPrevisao(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('riscos_previsao_reclassificacao', {
        p_niveis_risco: niveisRisco as never,
        p_metodo_calculo: metodoCalculo,
      });
      if (cancelado) return;
      setReclassificados(error ? null : ((data || []) as RiscoReclassificado[]));
      setCarregandoPrevisao(false);
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(timer);
      setCarregandoPrevisao(false);
    };
  }, [niveisRisco, metodoCalculo, problema, carregando]);

  /**
   * Trocar a escala ou o método arrasta as faixas atrás.
   *
   * Sem isto, o utilizador escolhia "Soma" e ficava com uma matriz em que a
   * faixa mais grave era inatingível — a validação recusava-lhe a gravação e
   * ele não tinha como saber o que corrigir.
   */
  const reajustarFaixas = useCallback(
    (p: number, i: number, metodo: MetodoCalculo) => {
      setNiveisRisco((anteriores) => {
        const novas = faixasPara(p, i, metodo, anteriores);
        // O apetite acompanha a faixa que ocupava a mesma posição.
        setApetiteScore((score) => {
          const idx = anteriores.findIndex((f) => f.max === score);
          return novas[idx >= 0 ? idx : Math.max(novas.length - 2, 0)]?.max ?? null;
        });
        return novas;
      });
    },
    [],
  );

  const mudarTamanho = (n: number) => {
    const prob = Array.from({ length: n }, (_, k) =>
      escalaProbabilidade[k] ?? { valor: String(k + 1), descricao: '' },
    ).map((it, k) => ({ ...it, valor: String(k + 1) }));
    const imp = Array.from({ length: n }, (_, k) =>
      escalaImpacto[k] ?? { valor: String(k + 1), descricao: '' },
    ).map((it, k) => ({ ...it, valor: String(k + 1) }));
    setEscalaProbabilidade(prob);
    setEscalaImpacto(imp);
    reajustarFaixas(n, n, metodoCalculo);
  };

  const mudarMetodo = (m: MetodoCalculo) => {
    setMetodoCalculo(m);
    reajustarFaixas(pMax, iMax, m);
  };

  const atualizarEscala = (
    qual: 'p' | 'i',
    index: number,
    campo: keyof EscalaItem,
    valor: string,
  ) => {
    const set = qual === 'p' ? setEscalaProbabilidade : setEscalaImpacto;
    set((prev) => prev.map((it, k) => (k === index ? { ...it, [campo]: valor } : it)));
  };

  const removerEscala = (qual: 'p' | 'i', index: number) => {
    const lista = qual === 'p' ? escalaProbabilidade : escalaImpacto;
    if (lista.length <= 2) return;
    const nova = lista.filter((_, k) => k !== index).map((it, k) => ({ ...it, valor: String(k + 1) }));
    (qual === 'p' ? setEscalaProbabilidade : setEscalaImpacto)(nova);
    reajustarFaixas(
      qual === 'p' ? nova.length : pMax,
      qual === 'i' ? nova.length : iMax,
      metodoCalculo,
    );
  };

  const adicionarEscala = (qual: 'p' | 'i') => {
    const lista = qual === 'p' ? escalaProbabilidade : escalaImpacto;
    const nova = [...lista, { valor: String(lista.length + 1), descricao: '' }];
    (qual === 'p' ? setEscalaProbabilidade : setEscalaImpacto)(nova);
    reajustarFaixas(
      qual === 'p' ? nova.length : pMax,
      qual === 'i' ? nova.length : iMax,
      metodoCalculo,
    );
  };

  const atualizarNivel = (index: number, campo: keyof NivelRisco, valor: string | number) => {
    setNiveisRisco((prev) => prev.map((n, k) => (k === index ? { ...n, [campo]: valor } : n)));
  };

  const mensagemProblema = (): string => {
    if (!problema) return '';
    switch (problema.tipo) {
      case 'nao_cobrem':
        return t('sweepRiscos.riscos.matrizForm.erroSemCobertura', { scores: problema.mensagem });
      case 'inalcancavel':
        return t('sweepRiscos.riscos.matrizForm.erroInalcancavel', {
          niveis: (problema.niveis || []).join(', '),
          intervalo: problema.mensagem,
        });
      case 'sobreposicao':
        return t('sweepRiscos.riscos.matrizForm.erroSobreposicaoSimples', { niveis: problema.mensagem });
      default:
        return t('sweepRiscos.riscos.matrizForm.erroMinMaior', { nivel: problema.mensagem });
    }
  };

  const mensagemErroGravacao = (error: { code?: string; message?: string; details?: string } | null): string => {
    const raw = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
    if (raw.includes('FAIXA_INALCANCAVEL')) return t('sweepRiscos.riscos.matrizForm.erroInalcancavelCurto');
    if (raw.includes('FAIXAS_NAO_COBREM_ESCALA')) return t('sweepRiscos.riscos.matrizForm.erroSemCoberturaCurto');
    if (raw.includes('ESCALA_MINIMA')) return t('sweepRiscos.riscos.matrizForm.erroEscalaMinima');
    if (raw.includes('NOME_OBRIGATORIO')) return t('sweepRiscos.riscos.matrizForm.erroNomeObrigatorio');
    if (raw.includes('EMPRESA_NAO_ENCONTRADA') || error?.code === '42501') {
      return t('sweepRiscos.riscos.matrizForm.erroPermissao');
    }
    return t('sweepRiscos.riscos.matrizForm.erroGenerico');
  };

  const gravar = async () => {
    if (!profile?.empresa_id) return;
    if (problema) {
      toast.error(mensagemProblema());
      return;
    }
    if (!nome.trim()) {
      toast.error(t('sweepRiscos.riscos.matrizForm.erroNomeObrigatorio'));
      return;
    }

    setGravando(true);
    const { data, error } = await supabase.rpc('criar_matriz_com_configuracao', {
      p_nome: nome.trim(),
      p_descricao: descricao || null,
      p_escala_probabilidade: escalaProbabilidade as never,
      p_escala_impacto: escalaImpacto as never,
      p_niveis_risco: niveisRisco as never,
      p_metodo_calculo: metodoCalculo,
      p_matriz_id: matrizId,
      p_apetite_score: apetiteScore,
    });
    setGravando(false);

    if (error || !data) {
      toast.error(mensagemErroGravacao(error));
      return;
    }
    toast.success(
      reclassificados && reclassificados.length > 0
        ? t('sweepRiscos.riscos.matrizForm.gravadaComReclassificacao', { count: reclassificados.length })
        : t('cardsKpi.sweep.riscos.matrizAtualizada'),
    );
    onSuccess();
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <AkurisPulse size={56} />
        <p className="text-xs text-muted-foreground">{t('fin.comum.carregando')}</p>
      </div>
    );
  }

  const faixasOrdenadas = [...niveisRisco].sort((a, b) => a.min - b.min);

  return (
    <div className="space-y-5">
      {/* Pré-visualização — o resultado das três decisões, sempre à vista. */}
      <MatrizPreviewGrid
        escalaProbabilidade={escalaProbabilidade}
        escalaImpacto={escalaImpacto}
        niveisRisco={niveisRisco}
        metodoCalculo={metodoCalculo}
        apetiteScore={apetiteScore}
      />

      {problema && (
        <Alert variant="destructive">
          <IconWarning className="h-4 w-4" strokeWidth={1.5} />
          <AlertDescription>{mensagemProblema()}</AlertDescription>
        </Alert>
      )}

      {/* ── As três decisões ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-6">
        <div>
          <SectionHeader
            eyebrow={t('sweepRiscos.riscos.matrizForm.escalaEyebrow')}
            title={t('sweepRiscos.riscos.matrizForm.tamanhoEscala')}
          />
          <div className="flex flex-wrap gap-2">
            {TAMANHOS.map((n) => {
              const ativo = pMax === n && iMax === n;
              return (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={ativo ? 'default' : 'outline'}
                  onClick={() => mudarTamanho(n)}
                >
                  {n} × {n}
                </Button>
              );
            })}
            {pMax !== iMax && (
              <span className="self-center text-xs text-muted-foreground">
                {t('sweepRiscos.riscos.matrizForm.escalaAssimetrica', { p: pMax, i: iMax })}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 pt-5">
          <SectionHeader
            eyebrow={t('fin.riscos.matrizForm.calculo')}
            title={t('fin.riscos.matrizForm.metodoCalculo')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { value: 'multiplicacao', label: t('fin.riscos.matrizForm.multiplicacao'), formula: 'P × I' },
              { value: 'soma', label: t('sweepRiscos.riscos.matrizForm.soma'), formula: 'P + I' },
            ] as const).map((opt) => {
              const active = metodoCalculo === opt.value;
              const intervalo =
                opt.value === 'soma' ? `2 – ${pMax + iMax}` : `1 – ${pMax * iMax}`;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => mudarMetodo(opt.value)}
                  className={cn(
                    'text-left rounded-lg border p-4 transition-ui',
                    active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card hover:bg-accent',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <IconCalculator
                      className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')}
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span
                      className={cn(
                        'ml-auto text-xs font-mono px-2 py-0.5 rounded',
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {opt.formula}
                    </span>
                  </div>
                  {/* O intervalo real da escala escolhida, e não "de 1 a
                      Pmax × Imax" em abstracto: é a diferença entre perceber e
                      não perceber que "Soma" muda o tecto de 25 para 10. */}
                  <p className="text-xs text-muted-foreground leading-snug">
                    {t('sweepRiscos.riscos.matrizForm.resultadoEntre', { intervalo })}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 pt-5">
          <SectionHeader
            eyebrow={t('sweepRiscos.riscos.matrizForm.apetiteEyebrow')}
            title={t('residuos.risco.limiteApetite')}
          />
          <p className="text-xs text-muted-foreground mb-3">
            {t('sweepRiscos.riscos.matrizForm.apetiteExplicacao')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {faixasOrdenadas.map((nivel) => (
              <Button
                key={`${nivel.nivel}-${nivel.min}`}
                type="button"
                size="sm"
                variant={apetiteScore === nivel.max ? 'default' : 'outline'}
                onClick={() => setApetiteScore(nivel.max)}
                className="gap-1.5"
              >
                {t('sweepRiscos.riscos.matrizForm.ateNivel', { nivel: nivel.nivel })}
                <span className="text-micro opacity-70 tabular-nums">(≤{nivel.max})</span>
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Impacto de gravar ────────────────────────────────────────── */}
      {!problema && (
        <section
          className={cn(
            'rounded-lg border p-4 text-sm',
            reclassificados && reclassificados.length > 0
              ? 'border-warning/40 bg-warning/5'
              : 'border-border bg-card',
          )}
        >
          <div className="flex items-start gap-2.5">
            <IconInfo className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <div className="min-w-0">
              {carregandoPrevisao ? (
                <span className="text-muted-foreground">{t('sweepRiscos.riscos.matrizForm.calculandoImpacto')}</span>
              ) : reclassificados === null ? (
                <span className="text-muted-foreground">{t('sweepRiscos.riscos.matrizForm.semImpactoConhecido')}</span>
              ) : reclassificados.length === 0 ? (
                <span className="text-muted-foreground">{t('sweepRiscos.riscos.matrizForm.nenhumRiscoMuda')}</span>
              ) : (
                <>
                  <div className="font-medium text-foreground">
                    {t('sweepRiscos.riscos.matrizForm.riscosQueMudam', { count: reclassificados.length })}
                  </div>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {reclassificados.slice(0, 12).map((r) => (
                      <li key={r.risco_id} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-mono shrink-0">{r.codigo || '—'}</span>
                        <span className="truncate">{r.nome}</span>
                        <span className="ml-auto shrink-0 tabular-nums">
                          {r.nivel_atual || '—'} → <strong className="text-foreground">{r.nivel_novo || '—'}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {reclassificados.length > 12 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('sweepRiscos.riscos.matrizForm.eMaisRiscos', { count: reclassificados.length - 12 })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Personalização ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setAvancado((v) => !v)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-accent transition-colors rounded-lg"
          aria-expanded={avancado}
        >
          <div>
            <div className="text-sm font-semibold">{t('sweepRiscos.riscos.matrizForm.personalizar')}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t('sweepRiscos.riscos.matrizForm.personalizarDesc')}
            </div>
          </div>
          <IconChevron
            className={cn('h-4 w-4 shrink-0 transition-transform', avancado && 'rotate-180')}
            strokeWidth={1.5}
          />
        </button>

        {avancado && (
          <div className="px-5 pb-5 space-y-6 border-t border-border/60 pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="matriz-nome">{t('campos.matriz.nome')}</Label>
                <Input id="matriz-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="matriz-descricao">{t('fin.comum.descricao')}</Label>
                <Textarea
                  id="matriz-descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1.5 min-h-[38px]"
                  rows={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(['p', 'i'] as const).map((qual) => {
                const lista = qual === 'p' ? escalaProbabilidade : escalaImpacto;
                return (
                  <div key={qual}>
                    <SectionHeader
                      eyebrow={t('campos.matriz.escala')}
                      title={qual === 'p' ? t('campos.matriz.probabilidade') : t('campos.matriz.impacto')}
                    />
                    <div className="space-y-2">
                      {lista.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-2 items-center bg-muted/30 hover:bg-accent rounded-md p-2 transition-colors"
                        >
                          <span className="w-8 text-center text-sm font-medium tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                          <Input
                            value={item.descricao}
                            onChange={(e) => atualizarEscala(qual, index, 'descricao', e.target.value)}
                            placeholder={
                              qual === 'p'
                                ? t('fin.riscos.matrizForm.exProbabilidade')
                                : t('fin.riscos.matrizForm.exImpacto')
                            }
                            className="flex-1 min-w-0"
                            aria-label={
                              qual === 'p'
                                ? t('fin.riscos.matrizForm.descProbabilidade')
                                : t('fin.riscos.matrizForm.descImpacto')
                            }
                          />
                          {lista.length > 2 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                                  onClick={() => removerEscala(qual, index)}
                                >
                                  <IconDelete className="h-4 w-4" strokeWidth={1.5} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('sweepRiscos.comum.remover')}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => adicionarEscala(qual)}
                        className="w-full gap-1.5 border-dashed"
                      >
                        <IconAdd className="h-4 w-4" strokeWidth={1.5} />
                        {t('sweepRiscos.riscos.matrizForm.adicionarNivel')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <SectionHeader
                eyebrow={t('sweepRiscos.riscos.matrizForm.faixasEyebrow')}
                title={t('fin.riscos.matrizForm.niveisRisco')}
              />
              <div className="space-y-2">
                {niveisRisco.map((nivel, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-center bg-muted/30 hover:bg-accent rounded-md p-2 transition-colors"
                  >
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        value={nivel.min}
                        onChange={(e) => atualizarNivel(index, 'min', parseInt(e.target.value) || 0)}
                        className="w-16 text-center"
                        aria-label={t('fin.comum.valorMinimo')}
                      />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input
                        type="number"
                        value={nivel.max}
                        onChange={(e) => atualizarNivel(index, 'max', parseInt(e.target.value) || 0)}
                        className="w-16 text-center"
                        aria-label={t('fin.comum.valorMaximo')}
                      />
                    </div>
                    <Input
                      value={nivel.nivel}
                      onChange={(e) => atualizarNivel(index, 'nivel', e.target.value)}
                      placeholder={t('fin.riscos.matrizForm.nomeNivelPlaceholder')}
                      className="flex-1 min-w-0"
                      aria-label={t('fin.riscos.matrizForm.nomeNivel')}
                    />
                    <ColorSwatch value={nivel.cor || '#6b7280'} onChange={(v) => atualizarNivel(index, 'cor', v)} />
                    {niveisRisco.length > 2 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => setNiveisRisco((prev) => prev.filter((_, k) => k !== index))}
                          >
                            <IconDelete className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('sweepRiscos.comum.remover')}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNiveisRisco((prev) => [
                      ...prev,
                      {
                        min: (prev[prev.length - 1]?.max ?? 0) + 1,
                        max: (prev[prev.length - 1]?.max ?? 0) + 1,
                        nivel: '',
                        cor: '#6b7280',
                      },
                    ])
                  }
                  className="w-full gap-1.5 border-dashed"
                >
                  <IconAdd className="h-4 w-4" strokeWidth={1.5} />
                  {t('sweepRiscos.riscos.matrizForm.adicionarNivelRisco')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => reajustarFaixas(pMax, iMax, metodoCalculo)}
                  className="w-full gap-1.5 text-muted-foreground"
                >
                  <IconGrid className="h-4 w-4" strokeWidth={1.5} />
                  {t('sweepRiscos.riscos.matrizForm.recalcularFaixas')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 -mx-6 px-6 py-4 border-t bg-popover flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          {t('fin.comum.cancelar')}
        </Button>
        <Button type="button" onClick={gravar} disabled={gravando || !!problema}>
          {gravando ? t('fin.comum.salvando') : t('fin.riscos.matrizForm.atualizarMatriz')}
        </Button>
      </div>
    </div>
  );
}
