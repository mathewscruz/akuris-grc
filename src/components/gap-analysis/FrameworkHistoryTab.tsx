import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreEvolutionChart } from './ScoreEvolutionChart';
import { useScoreHistory } from '@/hooks/useScoreHistory';
import { Download, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { exportFrameworkPDF } from './ExportFrameworkPDF';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { toast } from 'sonner';
import type { ScoreType } from '@/lib/framework-configs';

interface FrameworkHistoryTabProps {
  frameworkId: string;
  frameworkName: string;
  frameworkVersion: string;
  frameworkType: string;
  scoreType: ScoreType;
  currentScore: number;
  totalRequirements: number;
  evaluatedRequirements: number;
}

export function FrameworkHistoryTab({
  frameworkId,
  frameworkName,
  frameworkVersion,
  frameworkType,
  scoreType,
  currentScore,
  totalRequirements,
  evaluatedRequirements,
}: FrameworkHistoryTabProps) {
  const { history } = useScoreHistory(frameworkId, 'monthly');
  const { empresaId } = useEmpresaId();

  const stats = useMemo(() => {
    if (!history || history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const diff = last.score - first.score;
    return { initialScore: first.score, currentScore: last.score, diff };
  }, [history]);

  // Delta calculado contra o "Score Atual" exibido (ao vivo), não contra o
  // último snapshot — evita mostrar 49% com um "+22%" que na verdade era 47%−25%.
  const liveDiff = stats
    ? (scoreType === 'percentage'
        ? Math.round(currentScore) - Math.round(stats.initialScore)
        : currentScore - stats.initialScore)
    : 0;
  const trend: 'up' | 'down' | 'neutral' = liveDiff > 0 ? 'up' : liveDiff < 0 ? 'down' : 'neutral';

  const handleExportEvolution = async () => {
    try {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('nome')
        .eq('id', empresaId)
        .single();

      // Simple PDF with evolution data
      const { data: reqs } = await supabase
        .from('gap_analysis_requirements')
        .select('id, codigo, titulo, categoria, peso, area_responsavel')
        .eq('framework_id', frameworkId)
        .order('ordem', { ascending: true });

      const { data: evals } = await supabase
        .from('gap_analysis_evaluations')
        .select('requirement_id, conformity_status')
        .eq('framework_id', frameworkId)
        .eq('empresa_id', empresaId);

      const evalMap = new Map(evals?.map(e => [e.requirement_id, e.conformity_status]) || []);
      const requirements = (reqs || []).map(r => ({
        codigo: r.codigo || '',
        titulo: r.titulo,
        categoria: r.categoria || '',
        conformity_status: evalMap.get(r.id) || 'nao_avaliado',
        peso: r.peso,
        area_responsavel: r.area_responsavel,
      }));

      await exportFrameworkPDF({
        frameworkName,
        frameworkVersion,
        frameworkType,
        overallScore: currentScore,
        totalRequirements,
        evaluatedRequirements,
        pillarScores: [],
        categoryScores: [],
        requirements,
        empresaNome: empresa?.nome || 'Empresa',
        scoreType: scoreType === 'percentage' ? 'percentage' : 'decimal',
        maxScore: scoreType === 'percentage' ? 100 : 5,
      });

      toast.success('Relatório de evolução exportado');
    } catch {
      toast.error('Erro ao exportar relatório');
    }
  };

  const isPercentage = scoreType === 'percentage';
  const formatScore = (s: number) => isPercentage ? `${Math.round(s)}%` : s.toFixed(2);

  return (
    <div className="space-y-6">
      {/* Score comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Score Inicial</p>
            <p className="text-3xl font-bold">{stats ? formatScore(stats.initialScore) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Score Atual</p>
            <p className="text-3xl font-bold text-primary">{formatScore(currentScore)}</p>
            {stats && (
              <div className="flex items-center justify-center gap-1 mt-1">
                {trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={1.5}/>}
                {trend === 'down' && <TrendingDown className="h-4 w-4 text-destructive" strokeWidth={1.5}/>}
                {trend === 'neutral' && <Minus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5}/>}
                <span className={`text-sm font-medium ${
                  trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {liveDiff > 0 ? '+' : ''}{formatScore(liveDiff)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Progresso</p>
            <p className="text-3xl font-bold">
              {totalRequirements > 0 ? Math.round((evaluatedRequirements / totalRequirements) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">{evaluatedRequirements}/{totalRequirements} avaliados</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolution chart */}
      <ScoreEvolutionChart frameworkId={frameworkId} scoreType={scoreType} />

      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExportEvolution}>
          <Download className="h-4 w-4 mr-2" strokeWidth={1.5}/>
          Exportar Relatório de Evolução
        </Button>
      </div>

      {/* Timeline - simplified */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline de Avaliações</CardTitle>
            <p className="text-xs text-muted-foreground">
              Medições registradas ao longo do tempo. O "Score Atual" acima reflete a avaliação em tempo real e pode diferir da última medição registrada.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.slice(-10).reverse().map((point, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground w-24 shrink-0">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.5}/>
                    <span>{point.date}</span>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span>
                    Score: <strong>{formatScore(point.score)}</strong>
                    {' · '}
                    {point.evaluatedRequirements}/{point.totalRequirements} requisitos avaliados
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
