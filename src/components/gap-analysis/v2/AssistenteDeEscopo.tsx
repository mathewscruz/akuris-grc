/**
 * O assistente de escopo — perguntas antes da lista.
 *
 * Ao activar a ISO 27001, o utilizador recebia 121 linhas em branco. Nenhum
 * concorrente começa assim: os quatro abrem por contexto e recortam a norma
 * antes de a mostrar. Na Drata, marcar cada requisito In Scope/Out of Scope
 * com justificação escrita *é* literalmente a Declaração de Aplicabilidade.
 *
 * O ecrã tem dois tempos, e o segundo é o que importa:
 *
 *  1. **Perguntas.** Sim, não, ou não sei. "Não sei" mantém no escopo: lista
 *     maior é chatice, exclusão indevida é reprovação na auditoria.
 *
 *  2. **Confirmação.** Antes de gravar, a pessoa vê exactamente o que vai sair
 *     e lê a justificativa que ficará no documento. Ela pode editar cada uma.
 *     Isto não é cortesia: as justificativas afirmam factos sobre a empresa
 *     ("todas as pessoas trabalham a partir de residências particulares") que
 *     só quem lá está pode confirmar, e é a empresa que assina, não o produto.
 *
 * Escreve em `gap_analysis_soa`, que é a mesma tabela da aba Aplicabilidade —
 * o assistente é um atalho para o trabalho que já existia, não um mecanismo
 * paralelo. Quem quiser rever depois, revê lá.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconSuccess, IconIdea, IconWarning, IconArrowRight } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { chaveDoFramework } from '@/lib/gap-fases';
import {
  escopoDe, codigosExcluidos, responderComTravas, semNaoSei,
  type TravaDeEscopo, type RespostaDeEscopo,
} from '@/lib/gap-escopo';

type Resposta = RespostaDeEscopo;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frameworkId: string;
  frameworkName: string;
  empresaId: string;
  totalRequisitos: number;
  /** Chamado depois de gravar, para a página recarregar contagens. */
  onAplicado: () => void;
}

export function AssistenteDeEscopo({
  open, onOpenChange, frameworkId, frameworkName, empresaId, totalRequisitos, onAplicado,
}: Props) {
  const { t, locale } = useLanguage();
  /* As perguntas e as justificativas seguem o idioma do ecrã. Ficavam em
     português com a aplicação em inglês — e a justificativa é o que a empresa
     assina na Declaração de Aplicabilidade, não um rótulo. */
  const assistente = escopoDe(chaveDoFramework(frameworkName), locale === 'en' ? 'en' : 'pt');

  const [respostas, setRespostas] = useState<Record<string, Resposta | undefined>>({});
  const [etapa, setEtapa] = useState<'perguntas' | 'confirmar'>('perguntas');
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [gravando, setGravando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [forcadas, setForcadas] = useState<TravaDeEscopo[]>([]);
  /** codigo -> requirement_id, para escrever no SoA sem consultar duas vezes. */
  const [idsPorCodigo, setIdsPorCodigo] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) { setEtapa('perguntas'); setRespostas({}); setForcadas([]); setAtual(0); }
  }, [open]);

  useEffect(() => {
    if (!open || !frameworkId) return;
    (async () => {
      const { data } = await supabase
        .from('gap_analysis_requirements')
        .select('id, codigo')
        .eq('framework_id', frameworkId);
      const mapa: Record<string, string> = {};
      for (const r of data || []) if (r.codigo) mapa[r.codigo] = r.id;
      setIdsPorCodigo(mapa);
    })();
  }, [open, frameworkId]);

  /*
    As travas correm em cada resposta, não no fim.

    Corrigir no fim significaria mostrar à pessoa um resumo diferente do que ela
    respondeu, sem aviso. Aqui ela vê a resposta mudar e lê porquê.
  */
  const responder = (id: string, valor: Resposta) => {
    if (!assistente) return;
    const { respostas: novas, forcadas: travadas } = responderComTravas(
      assistente, respostas, id, valor,
    );
    setRespostas(novas);
    setForcadas(travadas);
  };

  const excluidos = useMemo(
    () => (assistente ? codigosExcluidos(assistente, semNaoSei(respostas)) : []),
    [assistente, respostas],
  );

  const porPergunta = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const x of excluidos) {
      m.set(x.perguntaId, [...(m.get(x.perguntaId) ?? []), x.codigo]);
    }
    return m;
  }, [excluidos]);

  const respondidas = assistente
    ? assistente.perguntas.filter((p) => respostas[p.id]).length
    : 0;
  // Frameworks sem roteiro próprio continuam acessíveis pela tabela/SoA.
  // O diálogo pode estar montado (mesmo fechado) antes desta guarda.
  const todasRespondidas = !!assistente && respondidas === assistente.perguntas.length;

  const pergunta = assistente?.perguntas[atual];

  const escolher = (valor: Resposta) => {
    if (!assistente || !pergunta) return;
    responder(pergunta.id, valor);
    if (atual < assistente.perguntas.length - 1) {
      window.setTimeout(() => setAtual((a) => Math.min(assistente.perguntas.length - 1, a + 1)), 280);
    }
  };

  useEffect(() => {
    if (!open || etapa !== 'perguntas') return;
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const total = assistente?.perguntas.length ?? 0;
      if (e.key === '1') escolher('sim');
      else if (e.key === '2') escolher('nao');
      else if (e.key === '3') escolher('nao_sei');
      else if (e.key === 'ArrowRight') setAtual((a) => Math.min(total - 1, a + 1));
      else if (e.key === 'ArrowLeft') setAtual((a) => Math.max(0, a - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!assistente) return null;

  const gravar = async () => {
    setGravando(true);
    try {
      /*
        Concluir o escopo também é uma decisão quando tudo se aplica.

        A versão anterior gravava apenas exclusões e recusava salvar zero
        exclusões. Uma empresa com escritório, nuvem e desenvolvimento
        respondia as nove perguntas e ficava presa com o botão desabilitado.
        Gravar o universo completo torna explícito tanto o que sai quanto o
        que fica e dá ao fluxo um estado de conclusão verificável.
      */
      const exclusaoPorId = new Map(
        excluidos
          .map((x) => {
            const requirementId = idsPorCodigo[x.codigo];
            return requirementId
              ? [requirementId, justificativas[x.perguntaId] ?? x.justificativa] as const
              : null;
          })
          .filter((x): x is readonly [string, string] => !!x),
      );
      const ids = Object.values(idsPorCodigo);
      if (ids.length === 0) throw new Error('Requisitos do framework ainda não foram carregados.');

      const linhas = ids.map((requirementId) => ({
        framework_id: frameworkId,
        empresa_id: empresaId,
        requirement_id: requirementId,
        aplicavel: !exclusaoPorId.has(requirementId),
        justificativa: exclusaoPorId.get(requirementId) || '',
      }));

      const { error } = await supabase
        .from('gap_analysis_soa')
        .upsert(linhas, { onConflict: 'framework_id,empresa_id,requirement_id' });
      if (error) throw error;

      // Mantém a avaliação sincronizada com a SoA, inclusive quando um
      // requisito antes excluído volta a ser aplicável numa revisão de escopo.
      const { data: avaliacoesNA, error: erroAvaliacoes } = await supabase
        .from('gap_analysis_evaluations')
        .select('requirement_id')
        .eq('framework_id', frameworkId)
        .eq('empresa_id', empresaId)
        .eq('conformity_status', 'nao_aplicavel');
      if (erroAvaliacoes) throw erroAvaliacoes;

      const agoraExcluidos = new Set(exclusaoPorId.keys());
      const marcarNA = [...agoraExcluidos].map((requirementId) => ({
        framework_id: frameworkId,
        empresa_id: empresaId,
        requirement_id: requirementId,
        conformity_status: 'nao_aplicavel',
        observacoes: exclusaoPorId.get(requirementId) || null,
        updated_at: new Date().toISOString(),
      }));
      const reabrir = (avaliacoesNA || [])
        .filter((avaliacao) => !agoraExcluidos.has(avaliacao.requirement_id))
        .map((avaliacao) => ({
          framework_id: frameworkId,
          empresa_id: empresaId,
          requirement_id: avaliacao.requirement_id,
          conformity_status: 'nao_avaliado',
          observacoes: null,
          updated_at: new Date().toISOString(),
        }));
      if (marcarNA.length || reabrir.length) {
        const { error: erroSincronia } = await supabase
          .from('gap_analysis_evaluations')
          .upsert([...marcarNA, ...reabrir], { onConflict: 'framework_id,empresa_id,requirement_id' });
        if (erroSincronia) throw erroSincronia;
      }

      toast.success(excluidos.length > 0
        ? t('gapEscopo.gravado', { n: excluidos.length })
        : t('gapEscopo.gravadoSemExclusoes'));
      onAplicado();
      onOpenChange(false);
    } catch (e) {
      logger.error('Erro ao gravar escopo', { error: e instanceof Error ? e.message : String(e) });
      toast.error(t('gapEscopo.erroGravar'));
    } finally {
      setGravando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
          `sm:max-w-5xl`, com o prefixo.

          O `DialogContent` traz `sm:max-w-lg` na base. Um `max-w-3xl` sem
          prefixo não entra em conflito com ele para o `tailwind-merge` —
          são variantes diferentes — e os dois sobrevivem; a partir de `sm`
          manda o da base. Medido a 1366×768: o diálogo tinha 482 px de
          largura e 2258 px de conteúdo numa caixa de 737, com 880 px de
          ecrã vazio de cada lado. Nove perguntas em fila indiana.
      */}
      <DialogContent className="sm:max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('gapEscopo.titulo')}</DialogTitle>
          <DialogDescription className="leading-6">
            {t('gapEscopo.introCurta', { n: assistente.perguntas.length })}
          </DialogDescription>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer list-none font-medium text-primary hover:underline">
              {t('gapEscopo.saibaMais')}
            </summary>
            <p className="mt-2 leading-5">{assistente.intro}</p>
          </details>
        </DialogHeader>

        {etapa === 'perguntas' ? (
          <>
            {/* Barra de progresso + pontos clicáveis */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                <span>{t('gapEscopo.perguntaN', { n: atual + 1, total: assistente.perguntas.length })}</span>
                <span>{t('gapEscopo.progresso', { feitas: respondidas, total: assistente.perguntas.length })}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-ui duration-500"
                  style={{ width: `${(respondidas / assistente.perguntas.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assistente.perguntas.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={t('gapEscopo.perguntaN', { n: i + 1, total: assistente.perguntas.length })}
                    onClick={() => setAtual(i)}
                    className={cn(
                      'h-2 rounded-full transition-all',
                      i === atual ? 'w-6 bg-primary' : respostas[p.id] ? 'w-2 bg-primary/50' : 'w-2 bg-muted-foreground/25',
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
              {/* Pergunta atual */}
              {pergunta && (
                <div key={pergunta.id} className="animate-fade-in rounded-lg border border-border bg-card p-6 sm:p-8">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {String(atual + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold leading-7 text-foreground sm:text-xl">
                    {pergunta.pergunta}
                  </h3>

                  <details className="group mt-3">
                    <summary className="cursor-pointer list-none text-xs font-medium text-primary hover:underline">
                      {t('gapEscopo.comoResponder')}
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{pergunta.ajuda}</p>
                  </details>

                  {pergunta.aviso && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-warning">
                      <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      {pergunta.aviso}
                    </p>
                  )}

                  <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                    {(['sim', 'nao', 'nao_sei'] as Resposta[]).map((valor, k) => {
                      const ativo = respostas[pergunta.id] === valor;
                      return (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => escolher(valor)}
                          className={cn(
                            'relative flex flex-col items-center gap-1 rounded-lg border px-3 py-4 text-sm font-medium transition-ui',
                            ativo
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background text-foreground hover:border-primary/50',
                          )}
                        >
                          {t(`gapEscopo.resposta.${valor}`)}
                          <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">{k + 1}</kbd>
                        </button>
                      );
                    })}
                  </div>

                  {respostas[pergunta.id] === 'nao' && (porPergunta.get(pergunta.id)?.length ?? 0) > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t('gapEscopo.saiDoEscopo', { n: porPergunta.get(pergunta.id)?.length ?? 0 })}
                    </p>
                  )}
                  {respostas[pergunta.id] === 'nao' && pergunta.nuncaExcluir && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                      <IconIdea className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      {pergunta.nuncaExcluir}
                    </p>
                  )}

                  <div className="mt-6 flex items-center justify-between">
                    <Button variant="ghost" size="sm" disabled={atual === 0} onClick={() => setAtual((a) => Math.max(0, a - 1))}>
                      {t('gapEscopo.anterior')}
                    </Button>
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">{t('gapEscopo.atalhos')}</span>
                    <Button
                      variant="ghost" size="sm"
                      disabled={atual >= assistente.perguntas.length - 1}
                      onClick={() => setAtual((a) => Math.min(assistente.perguntas.length - 1, a + 1))}
                    >
                      {t('gapEscopo.proxima')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Painel ao vivo */}
              <aside className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {totalRequisitos - excluidos.length}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">/ {totalRequisitos}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{t('gapEscopo.controles')} {t('gapEscopo.noEscopo')}</p>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-foreground">{t('gapEscopo.saemAqui')}</p>
                  {excluidos.length === 0 ? (
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{t('gapEscopo.nadaSaiAinda')}</p>
                  ) : (
                    <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                      {assistente.perguntas.map((p, i) => {
                        const cods = porPergunta.get(p.id);
                        if (!cods?.length) return null;
                        return (
                          <li key={p.id}>
                            <button type="button" onClick={() => setAtual(i)} className="text-left text-xs text-muted-foreground hover:text-foreground">
                              <span className="font-mono">{String(i + 1).padStart(2, '0')}</span> · {cods.length} {t('gapEscopo.controles')}
                              <span className="mt-0.5 block font-mono text-[11px] leading-4">{cods.join(' · ')}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {forcadas.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-3">
                    {forcadas.map((f, i) => (
                      <p key={i} className="flex items-start gap-1.5 text-xs leading-5 text-warning">
                        <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        {f.porque}
                      </p>
                    ))}
                  </div>
                )}
              </aside>
            </div>

            <div className="flex items-center justify-end border-t border-border pt-4">
              <Button
                onClick={() => {
                  setJustificativas(Object.fromEntries(
                    assistente.perguntas.map((p) => [p.id, p.justificativa]),
                  ));
                  setEtapa('confirmar');
                }}
                disabled={!todasRespondidas || Object.keys(idsPorCodigo).length === 0}
              >
                {t(excluidos.length > 0 ? 'gapEscopo.revisar' : 'gapEscopo.confirmarTudoAplicavel')}{' '}
                <IconArrowRight className="ml-1.5 h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm leading-6 text-foreground">
                {excluidos.length > 0
                  ? t('gapEscopo.confirmarResumo', {
                    fora: excluidos.length, resta: totalRequisitos - excluidos.length,
                  })
                  : t('gapEscopo.confirmarSemExclusoes', { total: totalRequisitos })}
              </p>
              {excluidos.length > 0 && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t('gapEscopo.confirmarAviso')}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {assistente.perguntas
                .filter((p) => (porPergunta.get(p.id)?.length ?? 0) > 0)
                .map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-medium text-foreground">{p.pergunta}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {(porPergunta.get(p.id) ?? []).join(' · ')}
                    </p>
                    <label className="mt-3 block text-xs font-medium text-muted-foreground">
                      {t('gapEscopo.justificativaLabel')}
                    </label>
                    <Textarea
                      value={justificativas[p.id] ?? p.justificativa}
                      onChange={(e) => setJustificativas((j) => ({ ...j, [p.id]: e.target.value }))}
                      rows={4}
                      className="mt-1.5 text-sm leading-6"
                    />
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setEtapa('perguntas')} disabled={gravando}>
                {t('gapEscopo.voltar')}
              </Button>
              <Button onClick={gravar} disabled={gravando}>
                {gravando ? <AkurisPulse size={14} className="mr-1.5" /> : <IconSuccess className="mr-1.5 h-4 w-4" strokeWidth={1.5} />}
                {t('gapEscopo.aplicar')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
