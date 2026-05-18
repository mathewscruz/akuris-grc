import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, Zap, TrendingUp, ArrowRight } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AiCostHint } from '@/components/ui/ai-cost-hint';
interface AIRecommendationsDialogProps {
  frameworkId: string;
  frameworkNome: string;
  empresaId: string;
  overallScore: number;
  totalRequirements: number;
  evaluatedRequirements: number;
  scoreType: string;
  onGoToRemediation?: () => void;
}

interface Recommendations {
  analise_situacional: string;
  score_estimado_apos_acoes: number;
  top_5_prioridades: { codigo: string; titulo: string; justificativa: string; esforco: string }[];
  quick_wins: { codigo: string; titulo: string; acao_sugerida: string }[];
  proximo_marco: string;
  recomendacao_geral: string;
}

export function AIRecommendationsButton(props: AIRecommendationsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);

  const minEvaluated = Math.max(1, Math.ceil(props.totalRequirements * 0.1));
  const canAnalyze = props.evaluatedRequirements >= minEvaluated;

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const [evalsRes, reqsRes] = await Promise.all([
        supabase.from('gap_analysis_evaluations')
          .select('requirement_id, conformity_status')
          .eq('framework_id', props.frameworkId).eq('empresa_id', props.empresaId),
        supabase.from('gap_analysis_requirements')
          .select('id, codigo, titulo, peso, categoria')
          .eq('framework_id', props.frameworkId).order('peso', { ascending: false }),
      ]);

      const evals = evalsRes.data || [];
      const reqs = reqsRes.data || [];
      const evalMap = new Map(evals.map(e => [e.requirement_id, e.conformity_status]));

      const conformes = evals.filter(e => e.conformity_status === 'conforme').length;
      const parciais = evals.filter(e => e.conformity_status === 'parcial').length;
      const naoConformes = evals.filter(e => e.conformity_status === 'nao_conforme').length;

      const reqsCriticos = reqs.filter(r => evalMap.get(r.id) === 'nao_conforme').slice(0, 10);
      const reqsParciais = reqs.filter(r => evalMap.get(r.id) === 'parcial').slice(0, 10);

      const { data, error } = await supabase.functions.invoke('ai-module-assistant', {
        body: {
          action: 'framework-recommendations',
          data: {
            framework_nome: props.frameworkNome,
            score_atual: props.overallScore,
            total_requisitos: props.totalRequirements,
            avaliados: props.evaluatedRequirements,
            conformes, parciais, nao_conformes: naoConformes,
            requisitos_criticos: reqsCriticos,
            requisitos_parciais: reqsParciais,
          },
        },
      });

      if (error) {
        // Check for 402 credits exhausted
        if (error.message?.includes('402') || error.status === 402) {
          toast.error('Créditos de IA esgotados. Entre em contato com a Akuris para adquirir mais créditos.');
          return;
        }
        throw error;
      }
      if (data?.error) {
        if (data.error === 'Créditos de IA esgotados.') {
          toast.error('Créditos de IA esgotados. Entre em contato com a Akuris para adquirir mais créditos.');
          return;
        }
        toast.error(data.error); return;
      }
      setRecommendations(data?.data || null);
    } catch (err: any) {
      logger.error('AI recommendations error:', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Erro ao gerar recomendações');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!recommendations && !loading) {
      handleAnalyze();
    }
  };

  const getEffortBadge = (esforco: string) => {
    switch (esforco) {
      case 'baixo': return <Badge variant="secondary" className="text-xs">Baixo esforço</Badge>;
      case 'medio': return <Badge variant="outline" className="text-xs">Médio esforço</Badge>;
      case 'alto': return <Badge variant="destructive" className="text-xs">Alto esforço</Badge>;
      default: return null;
    }
  };

  const tooltipText = canAnalyze
    ? 'Consultor de Conformidade — análise priorizada e quick wins'
    : `Avalie pelo menos ${minEvaluated} requisito${minEvaluated > 1 ? 's' : ''} (${props.evaluatedRequirements}/${minEvaluated}) para liberar o Consultor`;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={canAnalyze ? -1 : 0} className="inline-flex">
              <Button
                onClick={canAnalyze ? handleOpen : undefined}
                disabled={loading || !canAnalyze}
                aria-disabled={!canAnalyze}
                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground p-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-elegant"
              >
                {loading ? (
                  <AkurisPulse size={16} />
                ) : (
                  <AkurisAIIcon className="h-4 w-4"/>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-3xl lg:max-w-4xl max-h-[88vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AkurisAIIcon className="h-5 w-5 text-primary"/>
              Consultor de Conformidade
              <AiCostHint className="ml-2" action="cada análise" />
            </DialogTitle>
          </DialogHeader>

          {loading && !recommendations ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AkurisPulse size={32} className="text-primary" />
              <p className="text-sm text-muted-foreground">Analisando sua conformidade...</p>
            </div>
          ) : recommendations ? (
            <div className="space-y-5">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-foreground">{recommendations.analise_situacional}</p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" strokeWidth={1.5}/>
                <div>
                  <p className="text-sm font-medium">
                    Score projetado: <span className="text-primary font-bold">
                      {Number(recommendations.score_estimado_apos_acoes).toFixed(1)}{props.scoreType === 'percentage' ? '%' : '/5'}
                    </span>
                    <span className="text-muted-foreground ml-1">(atual: {Number(props.overallScore).toFixed(1)}{props.scoreType === 'percentage' ? '%' : '/5'})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{recommendations.proximo_marco}</p>
                </div>
              </div>

              {recommendations.top_5_prioridades?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Target className="h-4 w-4 text-destructive" strokeWidth={1.5}/>
                    Requisitos Prioritários
                  </h4>
                  <div className="space-y-2">
                    {recommendations.top_5_prioridades.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded border bg-card">
                        <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0">{p.codigo}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium break-words">{p.titulo}</p>
                          <p className="text-xs text-muted-foreground break-words">{p.justificativa}</p>
                        </div>
                        <div className="shrink-0">{getEffortBadge(p.esforco)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.quick_wins?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Zap className="h-4 w-4 text-warning" strokeWidth={1.5}/>
                    Quick Wins (Vitórias Rápidas)
                  </h4>
                  <div className="space-y-2">
                    {recommendations.quick_wins.map((q, i) => (
                      <div key={i} className="p-2 rounded border bg-card">
                        <p className="text-sm"><span className="font-mono text-xs text-muted-foreground mr-1">{q.codigo}</span> {q.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1">→ {q.acao_sugerida}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-sm text-foreground">{recommendations.recomendacao_geral}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="flex-1">
                  {loading ? <AkurisPulse size={16} className="mr-2" /> : <AkurisAIIcon className="h-4 w-4 mr-2"/>}
                  Atualizar Análise
                </Button>
                {props.onGoToRemediation && (
                  <Button
                    size="sm"
                    onClick={() => { setOpen(false); props.onGoToRemediation?.(); }}
                    className="flex-1"
                  >
                    Ir para Remediação
                    <ArrowRight className="h-4 w-4 ml-2" strokeWidth={1.5}/>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Erro ao carregar recomendações. Tente novamente.</p>
              <Button onClick={handleAnalyze} className="mt-3">
                <AkurisAIIcon className="h-4 w-4 mr-2"/>Tentar Novamente
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
