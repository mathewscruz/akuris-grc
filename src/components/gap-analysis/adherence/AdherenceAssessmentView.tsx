import { VeredictoBadge } from './VeredictoBadge';
import { useState, useEffect } from 'react';
import { IconAdd, IconDelete, IconView, IconWarning, IconFileCheck, IconTrendUp, IconTarget } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatStrip } from '@/components/ui/stat-strip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAdherenceStats } from '@/hooks/useAdherenceStats';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { supabase } from '@/integrations/supabase/client';
import { formatDateOnly } from '@/lib/date-utils';
import { AdherenceAssessmentDialog } from './AdherenceAssessmentDialog';
import { toast } from '@/lib/toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { AdherenceAssessment } from './types';
import { logger } from '@/lib/logger';
import { useEmpresaId } from '@/hooks/useEmpresaId';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { agruparAjustes } from './ajustes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useAutoresDaEmpresa, abrirDocumentoAnalisado } from './autoria';

const TOM_VEREDITO = { em_compliance: 'success', com_ressalvas: 'warning', nao_compliance: 'destructive' } as const;
function veredictoDe(a: any): keyof typeof TOM_VEREDITO | null {
  const v = a?.metadados_analise?.veredito;
  if (v && v in TOM_VEREDITO) return v;
  if (a?.resultado_geral === 'conforme') return 'em_compliance';
  if (a?.resultado_geral === 'parcial') return 'com_ressalvas';
  if (a?.resultado_geral === 'nao_conforme') return 'nao_compliance';
  return null;
}
function MiniRing({ value, tone }: { value: number; tone: 'success' | 'warning' | 'destructive' | null }) {
  const R = 18, C = 2 * Math.PI * R, v = Math.max(0, Math.min(100, Math.round(value || 0)));
  const cor = tone === 'success' ? 'stroke-success' : tone === 'warning' ? 'stroke-warning' : tone === 'destructive' ? 'stroke-destructive' : 'stroke-muted-foreground';
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
        <circle cx="22" cy="22" r={R} strokeWidth="4" className="fill-none stroke-muted" />
        <circle cx="22" cy="22" r={R} strokeWidth="4" strokeLinecap="round" className={cn('fill-none transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none', cor)}
          strokeDasharray={C} strokeDashoffset={C - (v / 100) * C} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-foreground">{v}%</span>
    </div>
  );
}
import { useLanguage } from '@/contexts/LanguageContext';
interface AdherenceAssessmentViewProps {
  onViewResult: (assessment: AdherenceAssessment) => void;
  frameworkId?: string;
  frameworkNome?: string;
  /** Quando embutido sob o DocumentsHero, esconde guidance/stats/botão duplicados
      e mostra apenas a lista de "Avaliações Recentes". */
  embedded?: boolean;
  /** Ao incrementar, abre o diálogo de nova avaliação (acionado pelos CTAs do hero). */
  openSignal?: number;
  /** Arquivo arrastado para o hero: já entra no diálogo. */
  initialFile?: File | null;
}

export function AdherenceAssessmentView({ onViewResult, frameworkId, frameworkNome, embedded, openSignal, initialFile }: AdherenceAssessmentViewProps) {
  const { t, tList } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: stats } = useAdherenceStats();
  const { empresaId } = useEmpresaId();

  // CTAs do DocumentsHero abrem este mesmo diálogo (antes eram botões mortos).
  useEffect(() => {
    if (openSignal) setIsDialogOpen(true);
  }, [openSignal]);

  const { data: assessments, loading: isLoading, refetch } = useOptimizedQuery(
    async () => {
      if (!empresaId) return { data: [], error: null };
      let query = supabase
        .from('gap_analysis_adherence_assessments')
        .select('*')
        // Defesa-em-profundidade: além da RLS, filtramos explicitamente pela empresa
        // do usuário — se a policy for relaxada no futuro, não vazamos silenciosamente.
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      // Filtrar por framework se informado
      if (frameworkId) {
        query = query.eq('framework_id', frameworkId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    },
    [frameworkId, empresaId],
    { cacheKey: `adherence-assessments-${empresaId || 'none'}-${frameworkId || 'all'}`, cacheDuration: 0 }
  );

  const { user } = useAuth();
  const [filtroAutor, setFiltroAutor] = useState<'todas' | 'minhas'>('todas');
  const autores = useAutoresDaEmpresa(empresaId, (assessments as any[]) ?? []);
  const listaVisivel = ((assessments as any[]) ?? []).filter(a => filtroAutor === 'todas' || a.created_by === user?.id);

  type Variant = 'success' | 'warning' | 'destructive' | 'secondary' | 'outline';

  const getStatusVariant = (status: string): Variant => {
    switch (status) {
      case 'concluido': return 'success';
      case 'processando': return 'secondary';
      case 'erro': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'concluido': return t('gapAnalysis.adherenceUi.view.statusConcluido');
      case 'processando': return <><AkurisPulse size={12} className="mr-1 inline" />{t('gapAnalysis.adherenceUi.view.statusProcessando')}</>;
      case 'erro': return t('gapAnalysis.adherenceUi.view.statusErro');
      default: return status;
    }
  };

  const getResultVariant = (resultado?: string): Variant => {
    switch (resultado) {
      case 'conforme': return 'success';
      case 'nao_conforme': return 'destructive';
      case 'parcial': return 'warning';
      default: return 'outline';
    }
  };

  const getResultLabel = (resultado?: string): string | null => {
    if (!resultado) return null;
    switch (resultado) {
      case 'conforme': return t('gapAnalysis.adherenceUi.view.resultConforme');
      case 'nao_conforme': return t('gapAnalysis.adherenceUi.view.resultNaoConforme');
      case 'parcial': return t('gapAnalysis.adherenceUi.view.resultParcial');
      default: return resultado;
    }
  };

  const handleDelete = async () => {
    if (!assessmentToDelete) return;
    
    setIsDeleting(true);
    try {
      const assessment = (assessments as any[])?.find(a => a.id === assessmentToDelete);
      
      // 1. Excluir detalhes relacionados
      const { error: detailsError } = await supabase
        .from('gap_analysis_adherence_details')
        .delete()
        .eq('assessment_id', assessmentToDelete);
      
      if (detailsError) throw detailsError;

      // 2. Excluir arquivo do storage
      if (assessment?.storage_file_name) {
        const { error: storageError } = await supabase.storage
          .from('adherence-documents')
          .remove([assessment.storage_file_name]);
        
        if (storageError) {
          logger.error('Erro ao excluir arquivo do storage:', { error: storageError instanceof Error ? storageError.message : String(storageError) });
        }
      }

      // 3. Excluir registro principal
      const { error: assessmentError } = await supabase
        .from('gap_analysis_adherence_assessments')
        .delete()
        .eq('id', assessmentToDelete);
      
      if (assessmentError) throw assessmentError;

      toast.success(t('gapAnalysis.adherenceUi.view.deleteSuccess'));
      refetch();
    } catch (error: any) {
      logger.error('Erro ao excluir avaliação:', { error: error instanceof Error ? error.message : String(error) });
      toast.error(t('gapAnalysis.adherenceUi.view.deleteError', { error: error.message }));
    } finally {
      setIsDeleting(false);
      setAssessmentToDelete(null);
    }
  };

  const statsCards = [
    {
      key: 'total',
      label: t('gapAnalysis.adherenceUi.view.totalAssessments'),
      value: stats?.totalAvaliacoes || 0,
      icon: IconTarget,
      hint: t('gapAnalysis.adherenceUi.view.totalAssessmentsDescription'),
    },
    {
      key: 'conformes',
      label: t('gapAnalysis.adherenceUi.view.compliantAssessments'),
      value: stats?.avaliacoesConformes || 0,
      icon: IconFileCheck,
      hint: t('gapAnalysis.adherenceUi.view.compliantAssessmentsDescription'),
    },
    {
      key: 'naoConformes',
      label: t('gapAnalysis.adherenceUi.view.nonCompliantAssessments'),
      value: stats?.avaliacoesNaoConformes || 0,
      icon: IconWarning,
      tone: 'destructive' as const,
      hint: t('gapAnalysis.adherenceUi.view.nonCompliantAssessmentsDescription'),
    },
    {
      key: 'media',
      label: t('gapAnalysis.adherenceUi.view.averageCompliance'),
      value: `${stats?.mediaConformidade || 0}%`,
      icon: IconTrendUp,
      hint: t('gapAnalysis.adherenceUi.view.averageComplianceDescription'),
      target: 100,
      direction: 'higher-is-better' as const,
    }
  ];

  const DOCUMENT_EXAMPLES: Record<string, string[]> = {
    'ISO': tList('gapAdherence.docExamples.iso'),
    'LGPD': tList('gapAdherence.docExamples.lgpd'),
    'NIST': tList('gapAdherence.docExamples.nist'),
    'PCI': tList('gapAdherence.docExamples.pci'),
  };

  const getDocExamples = (): string[] => {
    const defaultExamples = tList('gapAdherence.docExamples.default');
    if (!frameworkNome) return defaultExamples;
    for (const [key, examples] of Object.entries(DOCUMENT_EXAMPLES)) {
      if (frameworkNome.toUpperCase().includes(key)) return examples;
    }
    return defaultExamples;
  };

  return (
    <div className="space-y-6">
      {/* Guidance Card — escondido quando embutido (o DocumentsHero já explica) */}
      {!embedded && (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <IconFileCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.5}/>
          <div>
            <p className="text-sm font-medium mb-1">{t('gapAnalysis.adherenceUi.view.howItWorksTitle')}</p>
            <p className="text-xs text-muted-foreground mb-2">
              {t('gapAnalysis.adherenceUi.view.howItWorksDescription')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground">{t('gapAnalysis.adherenceUi.view.examplesLabel')}</span>
              {getDocExamples().map((doc, i) => (
                <Badge key={i} variant="outline" className="text-micro">{doc}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
      )}

      {/* Botão Nova Avaliação — escondido quando embutido (CTAs vivem no hero) */}
      {!embedded && (
      <div className="flex justify-end">
        <Button onClick={() => setIsDialogOpen(true)}>
          <IconAdd className="mr-2 h-4 w-4" strokeWidth={1.5}/>
          {t('gapAnalysis.adherenceUi.view.newAssessment')}
        </Button>
      </div>
      )}

      {/* Stats — escondido quando embutido (o DocumentsHero já traz os KPIs) */}
      {!embedded && (
      <StatStrip module="gap" items={statsCards} />
      )}

      {/* Lista de Avaliações */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{t('gapAnalysis.adherenceUi.view.recentAssessments')}</h3>
          <div className="flex gap-1">
            {(['todas', 'minhas'] as const).map(f => (
              <Button key={f} size="sm" variant={filtroAutor === f ? 'secondary' : 'ghost'} onClick={() => setFiltroAutor(f)}>
                {t(`gapAnalysis.adherenceUi.view.filter_${f}`)}
              </Button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center gap-2">
            <AkurisPulse size={40} />
            <p className="text-xs text-muted-foreground">{t('gapAnalysis.adherenceUi.view.loadingAssessments')}</p>
          </div>
        ) : listaVisivel.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {listaVisivel.map((assessment: any, i: number) => {
              const concluida = assessment.status === 'concluido';
              const v = veredictoDe(assessment);
              const acoes = Array.isArray(assessment.metadados_analise?.acoes) ? assessment.metadados_analise.acoes : [];
              const essenciais = agruparAjustes(acoes, v === 'em_compliance').essenciais.length;
              return (
                <li key={assessment.id}
                  className={cn('flex items-center gap-4 px-4 py-3 transition-colors animate-in fade-in slide-in-from-bottom-1', concluida && 'cursor-pointer hover:bg-accent')}
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms`, animationFillMode: 'both' }}
                  onClick={() => concluida && onViewResult(assessment)}
                  role={concluida ? 'button' : undefined}
                  tabIndex={concluida ? 0 : undefined}
                  onKeyDown={(e) => { if (concluida && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onViewResult(assessment); } }}
                >
                  {concluida ? <MiniRing value={assessment.percentual_conformidade} tone={v ? TOM_VEREDITO[v] : null} /> : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center"><AkurisPulse size={22} /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{assessment.nome_analise}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {assessment.documento_nome}
                      {autores[assessment.created_by] ? ` · ${t('gapAnalysis.adherenceUi.view.sentBy', { nome: autores[assessment.created_by] })}` : ''}
                    </p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    {concluida && v ? (
                      <VeredictoBadge veredito={v} />
                    ) : !concluida ? (
                      <span className="text-xs text-muted-foreground">{t('gapAnalysis.adherenceUi.view.processingHint')}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {concluida && essenciais > 0 ? `${t('gapAnalysis.v2.documentsHero.v3.essentialCount', { n: essenciais })} · ` : ''}
                      {formatDateOnly(assessment.created_at)}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t('gapAnalysis.v2.documentsHero.v3.more')}>
                        <span className="text-lg leading-none text-muted-foreground">⋯</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem disabled={!assessment.metadados_analise?.arquivo_storage} onClick={() => abrirDocumentoAnalisado(assessment, t)}>
                        <IconFileCheck className="mr-2 h-4 w-4" strokeWidth={1.5} />{t('gapAnalysis.adherenceUi.view.openDocument')}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setAssessmentToDelete(assessment.id)}>
                        <IconDelete className="mr-2 h-4 w-4" strokeWidth={1.5} />{t('gapAnalysis.adherenceUi.view.confirmDelete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-10 text-center">
            <IconFileCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" strokeWidth={1.5}/>
            <p className="text-sm text-muted-foreground">{t('gapAnalysis.v2.documentsHero.v3.empty')}</p>
            {!embedded && (
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <IconAdd className="mr-2 h-4 w-4" strokeWidth={1.5}/>
                {t('gapAnalysis.adherenceUi.view.createFirstAssessment')}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <AdherenceAssessmentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={refetch}
        preSelectedFrameworkId={frameworkId}
        preSelectedFrameworkNome={frameworkNome}
        initialFile={initialFile}
      />
      
      <ConfirmDialog
        open={!!assessmentToDelete}
        onOpenChange={(open) => !open && setAssessmentToDelete(null)}
        title={t('gapAnalysis.adherenceUi.view.deleteConfirmTitle')}
        description={t('gapAnalysis.adherenceUi.view.deleteConfirmDescription')}
        confirmText={t('gapAnalysis.adherenceUi.view.confirmDelete')}
        cancelText={t('gapAnalysis.adherenceUi.view.cancel')}
        variant="destructive"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  );
}
