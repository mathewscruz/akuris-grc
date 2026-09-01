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
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconSuccess, IconIdea, IconWarning, IconArrowRight } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { chaveDoFramework } from '@/lib/gap-fases';
import { escopoDe, aplicarTravas, codigosExcluidos, type TravaDeEscopo } from '@/lib/gap-escopo';

type Resposta = 'sim' | 'nao' | 'nao_sei';

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
  const { t } = useLanguage();
  const assistente = escopoDe(chaveDoFramework(frameworkName));

  const [respostas, setRespostas] = useState<Record<string, Resposta | undefined>>({});
  const [etapa, setEtapa] = useState<'perguntas' | 'confirmar'>('perguntas');
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [gravando, setGravando] = useState(false);
  const [forcadas, setForcadas] = useState<TravaDeEscopo[]>([]);
  /** codigo -> requirement_id, para escrever no SoA sem consultar duas vezes. */
  const [idsPorCodigo, setIdsPorCodigo] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) { setEtapa('perguntas'); setRespostas({}); setForcadas([]); }
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
    const cru = { ...respostas, [id]: valor };
    const paraTravas = Object.fromEntries(
      Object.entries(cru).map(([k, v]) => [k, v === 'nao_sei' ? undefined : v]),
    ) as Record<string, 'sim' | 'nao' | undefined>;
    const { respostas: ajustadas, forcadas: novas } = aplicarTravas(assistente, paraTravas);
    setRespostas({ ...cru, ...ajustadas } as Record<string, Resposta | undefined>);
    setForcadas(novas);
  };

  const excluidos = useMemo(() => {
    if (!assistente) return [];
    const so = Object.fromEntries(
      Object.entries(respostas).map(([k, v]) => [k, v === 'nao_sei' ? undefined : v]),
    ) as Record<string, 'sim' | 'nao' | undefined>;
    return codigosExcluidos(assistente, so);
  }, [assistente, respostas]);

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

  if (!assistente) return null;

  const gravar = async () => {
    setGravando(true);
    try {
      const linhas = excluidos
        .map((x) => ({
          framework_id: frameworkId,
          empresa_id: empresaId,
          requirement_id: idsPorCodigo[x.codigo],
          aplicavel: false,
          justificativa: justificativas[x.perguntaId] ?? x.justificativa,
        }))
        // Um código sem id é um requisito que este framework não tem. A guarda
        // impede que isso aconteça, mas gravar `null` seria pior do que saltar.
        .filter((l) => !!l.requirement_id);

      if (linhas.length === 0) {
        toast.error(t('gapEscopo.nadaAExcluir'));
        return;
      }

      const { error } = await supabase
        .from('gap_analysis_soa')
        .upsert(linhas, { onConflict: 'framework_id,empresa_id,requirement_id' });
      if (error) throw error;

      toast.success(t('gapEscopo.gravado', { n: linhas.length }));
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
          <DialogDescription className="leading-6">{assistente.intro}</DialogDescription>
        </DialogHeader>

        {etapa === 'perguntas' ? (
          <>
            {/* Duas colunas a partir de `lg`: cada pergunta é um cartão
                fechado, e em fila indiana somavam mais de 2000 px. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              {assistente.perguntas.map((p, i) => {
                const r = respostas[p.id];
                const sai = porPergunta.get(p.id)?.length ?? 0;
                return (
                  <div key={p.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-6 text-foreground">{p.pergunta}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{p.ajuda}</p>

                        {p.aviso && (
                          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-warning">
                            <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                            {p.aviso}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {(['sim', 'nao', 'nao_sei'] as Resposta[]).map((valor) => (
                            <button
                              key={valor}
                              type="button"
                              onClick={() => responder(p.id, valor)}
                              className={cn(
                                'rounded-md border px-3 py-1.5 text-xs font-medium transition-ui',
                                r === valor
                                  ? 'border-primary/60 bg-primary/10 text-primary'
                                  : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                              )}
                            >
                              {t(`gapEscopo.resposta.${valor}`)}
                            </button>
                          ))}
                        </div>

                        {r === 'nao' && sai > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('gapEscopo.saiDoEscopo', { n: sai })}
                          </p>
                        )}
                        {r === 'nao' && p.nuncaExcluir && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                            <IconIdea className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                            {p.nuncaExcluir}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {forcadas.length > 0 && (
              /* A trava é dita em voz alta: a resposta mudou e a pessoa lê porquê. */
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
                {forcadas.map((f, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-xs leading-5 text-warning">
                    <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    {f.porque}
                  </p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('gapEscopo.progresso', { feitas: respondidas, total: assistente.perguntas.length })}
                {excluidos.length > 0 && ` · ${t('gapEscopo.resumoParcial', {
                  fora: excluidos.length, resta: totalRequisitos - excluidos.length,
                })}`}
              </span>
              <Button
                onClick={() => {
                  setJustificativas(Object.fromEntries(
                    assistente.perguntas.map((p) => [p.id, p.justificativa]),
                  ));
                  setEtapa('confirmar');
                }}
                disabled={excluidos.length === 0}
              >
                {t('gapEscopo.revisar')} <IconArrowRight className="ml-1.5 h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm leading-6 text-foreground">
                {t('gapEscopo.confirmarResumo', {
                  fora: excluidos.length, resta: totalRequisitos - excluidos.length,
                })}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t('gapEscopo.confirmarAviso')}
              </p>
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
