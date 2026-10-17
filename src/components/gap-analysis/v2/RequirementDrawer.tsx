/**
 * RequirementDrawer — sheet lateral editorial (820px) para triagem rápida de requisito.
 *
 * Inclui: identidade do requisito, StatusSeg, AIDiagnosticCard (sob demanda),
 * justificativa textual, prazo, salvar. Para edição completa (planos de ação,
 * riscos vinculados, evidências, auditoria), o usuário continua usando o
 * RequirementDetailDialog completo, acionado pelo botão "Edição completa".
 *
 * Acionado via RequirementDrawerProvider em qualquer ponto da app.
 */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserSelect } from '@/components/riscos/UserSelect';
import { DocumentosDoRequisito } from '@/components/gap-analysis/DocumentosDoRequisito';
import { sugerirStatus, contarEvidenciasEsperadas } from '@/lib/gap-analysis/sugerir-status';
import { scopedDraftKey } from '@/hooks/useWizardDraft';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { IconExternal, IconFileText, IconIdea, IconChecklist, IconSuccess, IconAttach, IconSettings, IconCalendar, IconPerson, IconSave } from '@/components/icons';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AIDiagnosticCard, type AIDiagnosticResult } from './AIDiagnosticCard';
import { localizeRequirement } from "@/lib/gap-i18n";
import { useOrientacaoRequisito } from '@/hooks/useOrientacaoRequisito';
import { useLanguage } from '@/contexts/LanguageContext';

interface RequirementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementId: string | null;
  empresaId: string;
  onSaved?: () => void;
  /** Ordem dos requisitos para navegar anterior/próximo. */
  sequence?: string[];
  onNavigate?: (id: string) => void;
}

interface RequirementCore {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  orientacao_implementacao: string | null;
  exemplos_evidencias: string | null;
  framework_id: string;
}

interface EvaluationCore {
  id?: string;
  conformity_status: string | null;
  observacoes: string | null;
  prazo_implementacao: string | null;
  responsavel_avaliacao?: string | null;
}

/** Estilo de prosa para conteúdo em Markdown (orientação da norma, evidências). */
const PROSE_CLASS =
  'prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-headings:text-sm prose-headings:mt-3 prose-headings:mb-1.5 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:text-foreground';

export function RequirementDrawer({
  open,
  onOpenChange,
  requirementId,
  empresaId,
  onSaved,
  sequence,
  onNavigate,
}: RequirementDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [requirement, setRequirement] = useState<RequirementCore | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationCore>({
    conformity_status: null, observacoes: '', prazo_implementacao: null, responsavel_avaliacao: null,
  });
  const { user } = useAuth();
  const qc = useQueryClient();
  const draftKey = requirementId ? scopedDraftKey(empresaId, user?.id, `gap-req-${requirementId}`) : null;
  const [saving, setSaving] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AIDiagnosticResult | null>(null);
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // "Edição completa": fecha a triagem e pede à tabela da página que abra o
  // diálogo do mesmo requisito. Passa pela URL de propósito — o diálogo vive
  // dentro da tabela e este painel é global, portanto não há como lhe entregar
  // uma função sem arrastar propriedades por três telas. Foi o que se tentou
  // antes, com `onOpenFullDialog`: a propriedade existia, ninguém a passava, e
  // o botão nunca chegou a ser desenhado.
  const abrirEdicaoCompleta = useCallback(() => {
    if (!requirementId) return;
    const sp = new URLSearchParams(searchParams);
    sp.set('req', requirementId);
    setSearchParams(sp, { replace: true });
    onOpenChange(false);
  }, [requirementId, searchParams, setSearchParams, onOpenChange]);

  /*
    A mesma orientação do diálogo completo, no caminho principal.

    A gaveta mostrava o que estivesse gravado e nunca pedia. Como 98% dos
    requisitos não têm nada gravado, quem chegava pela fila de prioridades —
    o caminho que o próprio produto recomenda — via só o texto da norma.
  */
  const orientacao = useOrientacaoRequisito(open ? requirementId : null, open);

  useEffect(() => {
    if (!open || !requirementId || !empresaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDiagnostic(null);
      try {
        const [reqRes, evalRes] = await Promise.all([
          supabase
            .from('gap_analysis_requirements')
            .select('id, codigo, titulo, descricao, categoria, orientacao_implementacao, exemplos_evidencias, framework_id, titulo_en, descricao_en, categoria_en, orientacao_implementacao_en, exemplos_evidencias_en')
            .eq('id', requirementId)
            .maybeSingle(),
          supabase
            .from('gap_analysis_evaluations')
            .select('id, conformity_status, observacoes, prazo_implementacao, responsavel_avaliacao')
            .eq('requirement_id', requirementId)
            .eq('empresa_id', empresaId)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        if (reqRes.error || !reqRes.data) {
          toast.error(t('gapUi.drawer.requirementNotFound'));
          onOpenChange(false);
          return;
        }
        setRequirement(localizeRequirement(reqRes.data as any) as any);
        setEvaluation({
          id: evalRes.data?.id,
          conformity_status: evalRes.data?.conformity_status || null,
          observacoes: evalRes.data?.observacoes || '',
          prazo_implementacao: evalRes.data?.prazo_implementacao || null,
          responsavel_avaliacao: (evalRes.data as any)?.responsavel_avaliacao || null,
        });
        try {
          const rascunho = draftKey ? localStorage.getItem(draftKey) : null;
          if (rascunho) setEvaluation((prev) => ({ ...prev, ...JSON.parse(rascunho) }));
        } catch { /* rascunho inválido é ignorado */ }
      } catch (e) {
        logger.error('Erro ao carregar requisito no drawer', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirementId, empresaId, onOpenChange]);

  const runDiagnostic = useCallback(async () => {
    if (!requirementId) return;
    setDiagnosing(true);
    const { data, error } = await invokeEdgeFunction<AIDiagnosticResult>(
      'gap-analysis-ai-diagnostic',
      { body: { requirementId }, isAiCall: true },
    );
    setDiagnosing(false);
    if (error || !data) return;
    setDiagnostic(data);
  }, [requirementId]);

  const precisaJustificativa = (evaluation.conformity_status === 'parcial' || evaluation.conformity_status === 'nao_conforme') && !(evaluation.observacoes || '').trim();
  const idx = sequence && requirementId ? sequence.indexOf(requirementId) : -1;
  const prevId = idx > 0 ? sequence![idx - 1] : null;
  const nextId = idx >= 0 && idx < (sequence!.length - 1) ? sequence![idx + 1] : null;

  const handleSave = async (avancar = false) => {
    if (!requirement || !empresaId || precisaJustificativa) return;
    setSaving(true);
    try {
      const payload = {
        requirement_id: requirement.id,
        framework_id: requirement.framework_id,
        empresa_id: empresaId,
        conformity_status: evaluation.conformity_status,
        observacoes: evaluation.observacoes || null,
        prazo_implementacao: evaluation.prazo_implementacao || null,
        responsavel_avaliacao: evaluation.responsavel_avaliacao || null,
      };
      let saveError: any = null;
      if (evaluation.id) {
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .update(payload)
          .eq('id', evaluation.id)
          .eq('empresa_id', empresaId);
        saveError = error;
      } else {
        const { error } = await supabase
          .from('gap_analysis_evaluations')
          .insert(payload);
        saveError = error;
      }
      if (saveError) throw saveError;
      toast.success(t('gapUi.drawer.evaluationSaved'));
      if (draftKey) localStorage.removeItem(draftKey);
      onSaved?.();
      if (avancar && nextId && onNavigate) onNavigate(nextId);
      else onOpenChange(false);
    } catch (e) {
      logger.error('Erro ao salvar avaliação no drawer', {
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error(t('gapUi.drawer.errorSaveEvaluation'));
    } finally {
      setSaving(false);
    }
  };

  // Atalhos de teclado dentro do drawer: 1/2/3/4 selecionam status, Cmd/Ctrl+Enter salva.
  // Ignora se o foco está em input/textarea (para não sequestrar digitação).
  useEffect(() => {
    if (!open || !requirement) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      // Cmd/Ctrl+Enter salva mesmo dentro de textarea
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (evaluation.conformity_status && !saving && !precisaJustificativa) {
          e.preventDefault();
          handleSave();
        }
        return;
      }
      if (isEditable) return;
      const map: Record<string, string> = {
        '1': 'conforme',
        '2': 'parcial',
        '3': 'nao_conforme',
        '4': 'nao_aplicavel',
      };
      const next = map[e.key];
      if (next) {
        e.preventDefault();
        setEvaluation((prev) => ({ ...prev, conformity_status: next }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirement, evaluation.conformity_status, saving]);

  // Rascunho por empresa + utilizador enquanto se escreve.
  useEffect(() => {
    if (!open || !draftKey || loading || !requirement) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          conformity_status: evaluation.conformity_status,
          observacoes: evaluation.observacoes,
          prazo_implementacao: evaluation.prazo_implementacao,
          responsavel_avaliacao: evaluation.responsavel_avaliacao,
        }));
      } catch { /* armazenamento cheio: sem rascunho */ }
    }, 600);
    return () => window.clearTimeout(id);
  }, [open, draftKey, loading, requirement, evaluation]);

  const evidenciasQuery = useQuery({
    queryKey: ['requisito-evidencias-count', requirementId, empresaId],
    enabled: open && !!requirementId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence_library_links')
        .select('id, evidence_library(nome, arquivo_nome, arquivo_url)')
        .eq('requirement_id', requirementId!)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((l) => ({
        id: l.id as string,
        nome: (l.evidence_library?.nome || l.evidence_library?.arquivo_nome || '') as string,
        arquivo: (l.evidence_library?.arquivo_nome || l.evidence_library?.nome || '') as string,
        url: (l.evidence_library?.arquivo_url || null) as string | null,
      }));
    },
  });
  const frameworkQuery = useQuery({
    queryKey: ['gap-framework-nome', requirement?.framework_id],
    enabled: open && !!requirement?.framework_id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('gap_analysis_frameworks')
        .select('nome, versao')
        .eq('id', requirement!.framework_id)
        .maybeSingle();
      return data as { nome: string; versao?: string } | null;
    },
  });

  const arquivos = evidenciasQuery.data ?? [];
  const itensEsperados = parseItens(orientacao.evidencias);
  const itensComo = parseItens(orientacao.texto);
  const avaliados = itensEsperados.map((item) => {
    const chaves = palavras(item.titulo + ' ' + item.descricao);
    const ligados = arquivos.filter((a) => {
      const pa = palavras(a.nome + ' ' + a.arquivo);
      return chaves.some((c) => pa.includes(c));
    });
    return { ...item, ligados };
  });
  const usados = new Set(avaliados.flatMap((i) => i.ligados.map((l) => l.id)));
  const outrosArquivos = arquivos.filter((a) => !usados.has(a.id));
  const esperadas = itensEsperados.length || contarEvidenciasEsperadas(orientacao.evidencias);
  const encontradas = itensEsperados.length > 0 ? avaliados.filter((i) => i.ligados.length > 0).length : arquivos.length;
  const sugestao = sugerirStatus({ esperadas, encontradas: encontradas || arquivos.length });
  const statusLabel = (s: string) => t(`gapUi.drawer.status.${s}`);
  const fw = frameworkQuery.data;
  const OPCOES = ['conforme', 'parcial', 'nao_conforme', 'nao_aplicavel'] as const;
  const TOM: Record<string, string> = {
    conforme: 'bg-success text-success-foreground',
    parcial: 'bg-primary text-primary-foreground',
    nao_conforme: 'bg-destructive text-destructive-foreground',
    nao_aplicavel: 'bg-muted-foreground text-background',
  };

  const prose = (txt: string) => (
    <div className={`text-sm text-foreground/85 leading-relaxed ${PROSE_CLASS}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{txt}</ReactMarkdown>
    </div>
  );

  const Bloco = ({ icon: Icon, titulo, right, children }: { icon: React.ComponentType<any>; titulo: string; right?: React.ReactNode; children: React.ReactNode }) => (
    <section className="py-5 first:pt-0 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className="h-5 w-5 text-foreground/80" strokeWidth={1.5} />
        <h3 className="text-base font-semibold text-foreground flex-1">{titulo}</h3>
        {right}
      </div>
      {children}
    </section>
  );

  const textoJust = evaluation.observacoes || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-6xl p-0 sm:p-0 gap-0 overflow-hidden flex flex-col h-[100dvh] sm:h-[88vh] bg-popover">
        <DialogTitle className="sr-only">{t('gapUi.drawer.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('gapUi.drawer.whatStandardRequires')}</DialogDescription>

        {loading || !requirement || requirement.id !== requirementId ? (
          <div className="flex-1 flex items-center justify-center"><AkurisPulse size={48} /></div>
        ) : (
          <>
            <header className="border-b border-border px-6 py-4 pr-14 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                {fw && <FrameworkBadge name={fw.nome} versao={fw.versao} size="sm" />}
                {fw && <span className="text-lg font-semibold text-foreground">{fw.nome}</span>}
                {requirement.codigo && (
                  <span className="font-mono text-xs tabular-nums rounded-md bg-muted px-2 py-1 text-foreground/80">{requirement.codigo}</span>
                )}
                <h2 className="text-lg font-semibold text-foreground leading-snug min-w-0">{requirement.titulo}</h2>
                {sequence && idx >= 0 && (
                  <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    <Button variant="ghost" size="sm" className="h-7 px-2" disabled={!prevId} aria-label={t('gapUi.drawer.previous')} onClick={() => prevId && onNavigate?.(prevId)}>‹</Button>
                    {idx + 1}/{sequence.length}
                    <Button variant="ghost" size="sm" className="h-7 px-2" disabled={!nextId} aria-label={t('gapUi.drawer.next')} onClick={() => nextId && onNavigate?.(nextId)}>›</Button>
                  </div>
                )}
              </div>
              {requirement.descricao && (
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{requirement.descricao.replace(/[#*_`>]/g, '')}</p>
              )}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
              {/* Esquerda: ler */}
              <div className="lg:overflow-y-auto px-6 py-5 lg:border-r border-border">
                <Bloco icon={IconFileText} titulo={t('gapUi.drawer.requisito')}>
                  <p className="text-sm font-medium text-foreground mb-1.5">
                    {requirement.codigo && <span className="font-mono text-primary mr-2">{requirement.codigo}</span>}
                    {requirement.titulo}
                  </p>
                  {requirement.descricao && prose(requirement.descricao)}
                </Bloco>

                <Bloco icon={IconIdea} titulo={t('gapUi.drawer.comoCumprir')}>
                  <p className="text-micro text-muted-foreground mb-2">{t('gapUi.detail.guidancePlatformIncluded')}</p>
                  {orientacao.estado === 'gerando' && (
                    <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AkurisPulse size={14} />{t('gapUi.drawer.comoCumprirGerando')}
                    </div>
                  )}
                  {itensComo.length > 0 ? (
                    <ul className="space-y-1.5">
                      {itensComo.map((i, n) => (
                        <li key={n} className="flex gap-2.5 text-sm text-foreground/85">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span>{i.titulo}{i.descricao && <span className="text-muted-foreground"> — {i.descricao}</span>}</span>
                        </li>
                      ))}
                    </ul>
                  ) : orientacao.texto ? prose(orientacao.texto) : null}
                  {orientacao.estado !== 'gerando' && (orientacao.estado === 'falha' || !orientacao.texto) && (
                    <div role="status">
                      <p className="text-sm text-muted-foreground">
                        {orientacao.estado === 'falha' ? t('gapUi.detail.guidanceFalhou') : t('gapUi.detail.guidanceIndisponivel')}
                      </p>
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => orientacao.gerar(false)}>
                        {t('gapUi.detail.guidanceTentarDeNovo')}
                      </Button>
                    </div>
                  )}
                </Bloco>

                <Bloco
                  icon={IconChecklist}
                  titulo={t('gapUi.drawer.expectedEvidence')}
                  right={esperadas > 0 ? <span className="text-xs text-muted-foreground tabular-nums">{t('gapUi.drawer.foundOf', { found: Math.min(encontradas, esperadas), expected: esperadas })}</span> : undefined}
                >
                  {avaliados.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {avaliados.map((i, n) => {
                        const ok = i.ligados.length > 0;
                        return (
                          <li key={n} className="flex items-start gap-3 py-3.5">
                            {ok
                              ? <IconSuccess className="h-5 w-5 text-success shrink-0 mt-0.5" strokeWidth={1.5} />
                              : <span className="h-5 w-5 rounded-full border-[1.5px] border-muted-foreground/60 shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{i.titulo}</p>
                              {i.descricao && <p className="text-xs text-muted-foreground mt-0.5">{i.descricao}</p>}
                              {i.ligados.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                                  {i.ligados.map((l) => (
                                    <a key={l.id} href={l.url || undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                      <IconAttach className="h-3.5 w-3.5" strokeWidth={1.5} />{l.arquivo}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                              ok ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                              {ok ? t('gapUi.drawer.found') : t('gapUi.drawer.missing')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : orientacao.evidencias ? prose(orientacao.evidencias) : (
                    <p className="text-sm text-muted-foreground">{t('gapUi.drawer.noExpectedEvidence')}</p>
                  )}
                  {outrosArquivos.length > 0 && avaliados.length > 0 && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {t('gapUi.drawer.otherLinked')}:{' '}
                      {outrosArquivos.map((l, n) => (
                        <a key={l.id} href={l.url || undefined} target="_blank" rel="noreferrer" className="text-primary hover:underline">{n > 0 ? ', ' : ''}{l.arquivo}</a>
                      ))}
                    </div>
                  )}
                  <div className="mt-4">
                    <DocumentosDoRequisito
                      requisitoId={requirement.id}
                      frameworkId={requirement.framework_id}
                      onChanged={() => qc.invalidateQueries({ queryKey: ['requisito-evidencias-count', requirementId, empresaId] })}
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs -ml-2 mt-3" onClick={abrirEdicaoCompleta}>
                    <IconExternal className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    {t('gapUi.drawer.moreOptions')}
                  </Button>
                </Bloco>
              </div>

              {/* Direita: decidir */}
              <aside className="lg:overflow-y-auto px-6 py-5 space-y-6 border-t lg:border-t-0 border-border flex flex-col">
                <section>
                  <div className="flex items-center gap-2.5 mb-3">
                    <IconSettings className="h-5 w-5 text-foreground/80" strokeWidth={1.5} />
                    <h3 className="text-base font-semibold text-foreground">{t('gapUi.drawer.decision')}</h3>
                  </div>
                  <div role="radiogroup" aria-label={t('gapUi.drawer.decision')} className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-border overflow-hidden">
                    {OPCOES.map((o, n) => {
                      const ativo = evaluation.conformity_status === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={ativo}
                          title={`${n + 1}`}
                          onClick={() => setEvaluation((e) => ({ ...e, conformity_status: o }))}
                          className={cn('px-2 py-2.5 text-xs sm:text-sm transition-colors border-border [&:not(:first-child)]:sm:border-l',
                            ativo ? `${TOM[o]} font-medium` : 'text-foreground/80 hover:bg-muted/60')}
                        >
                          {statusLabel(o)}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <IconIdea className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {sugestao
                          ? `${t('gapUi.drawer.suggestion')}: ${statusLabel(sugestao)} — ${t('gapUi.drawer.foundOf', { found: Math.min(encontradas, Math.max(esperadas, encontradas)), expected: Math.max(esperadas, encontradas) })}`
                          : t('gapUi.drawer.suggestion')}
                      </p>
                      <p className="text-xs text-primary/90 mt-1">
                        {sugestao ? t(`gapUi.drawer.suggestionWhy.${sugestao}`) : t('gapUi.drawer.suggestionNone')}
                      </p>
                    </div>
                    {sugestao && evaluation.conformity_status !== sugestao && (
                      <Button size="sm" onClick={() => setEvaluation(e => ({ ...e, conformity_status: sugestao }))}>
                        {t('gapUi.drawer.apply')}
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-primary/20">
                    {diagnosing ? (
                      <div className="flex justify-center py-4"><AkurisPulse size={28} /></div>
                    ) : diagnostic ? (
                      <AIDiagnosticCard
                        result={diagnostic}
                        onApplyStatus={(s) => setEvaluation(e => ({ ...e, conformity_status: s }))}
                        onApplyJustification={(txt) => setEvaluation(e => ({ ...e, observacoes: txt }))}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-micro text-muted-foreground">{t('gapUi.drawer.diagnosticHint')}</p>
                        <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={runDiagnostic}>
                          {t('gapUi.drawer.generateDiagnostic')}
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <label htmlFor="just-drawer" className="text-sm font-medium text-foreground">{t('gapUi.drawer.justification')}</label>
                  <Textarea
                    id="just-drawer"
                    value={textoJust}
                    maxLength={500}
                    onChange={(e) => setEvaluation(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder={t('gapUi.drawer.observationsPlaceholder')}
                    rows={5}
                    aria-invalid={precisaJustificativa}
                    className={cn('mt-2 resize-y', precisaJustificativa && 'border-destructive/60')}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-destructive">{precisaJustificativa ? t('gapUi.drawer.justificationRequired') : ''}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{textoJust.length}/500</span>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <IconCalendar className="h-4 w-4" strokeWidth={1.5} />{t('gapUi.drawer.deadline')}
                  </div>
                  <DateField
                    id="prazo-drawer"
                    value={evaluation.prazo_implementacao || null}
                    onChange={(v) => setEvaluation(prev => ({ ...prev, prazo_implementacao: v || null }))}
                    className="mt-2"
                  />
                </section>

                <section>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <IconPerson className="h-4 w-4" strokeWidth={1.5} />{t('gapUi.drawer.owner')}
                  </div>
                  <div className="mt-2">
                    <UserSelect
                      value={evaluation.responsavel_avaliacao || undefined}
                      onValueChange={(v) => setEvaluation(prev => ({ ...prev, responsavel_avaliacao: v || null }))}
                    />
                  </div>
                </section>

                <div className="mt-auto pt-2 space-y-2 sticky bottom-0 bg-popover pb-1">
                  <Button className="w-full h-11" onClick={() => handleSave(!!(nextId && onNavigate))} disabled={saving || !evaluation.conformity_status || precisaJustificativa}>
                    <IconSave className="h-4 w-4 mr-2" strokeWidth={1.5} />
                    {saving ? t('gapUi.drawer.saving') : nextId && onNavigate ? t('gapUi.drawer.saveAndNext') : t('gapUi.drawer.save')}
                  </Button>
                  {nextId && onNavigate && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => handleSave(false)} disabled={saving || !evaluation.conformity_status || precisaJustificativa}>
                      {t('gapUi.drawer.saveAndClose')}
                    </Button>
                  )}
                  <p className="hidden md:flex items-center justify-center gap-2 text-micro text-muted-foreground">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">1–4</kbd>{t('gapUi.drawer.complianceStatus')}
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-micro">⌘↵</kbd>{t('gapUi.drawer.shortcutSave')}
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Quebra um texto (markdown) em itens de lista: "Título: descrição" ou "**Título** — descrição". */
function parseItens(texto: string | null | undefined): { titulo: string; descricao: string }[] {
  if (!texto) return [];
  return texto
    .split('\n')
    .filter((l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l))
    .map((l) => {
      const limpo = l.replace(/^\s*([-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '').replace(/[`_]/g, '').trim();
      const m = limpo.match(/^(.{3,90}?)\s*(?::|—|–| - )\s+(.+)$/);
      return m ? { titulo: m[1].trim(), descricao: m[2].trim() } : { titulo: limpo, descricao: '' };
    });
}

function palavras(txt: string): string[] {
  return txt
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);
}
