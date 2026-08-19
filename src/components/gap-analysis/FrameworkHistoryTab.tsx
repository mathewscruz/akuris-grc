import { useMemo } from 'react';
import { IconDownload, IconCalendar, IconTrendUp, IconTrendDown, IconMinus } from '@/components/icons';
import { StatStrip } from '@/components/ui/stat-strip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreEvolutionChart } from './ScoreEvolutionChart';
import { useScoreHistory } from '@/hooks/useScoreHistory';
import { exportFrameworkPDF } from './ExportFrameworkPDF';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface FrameworkHistoryTabProps {
  frameworkId: string;
  frameworkName: string;
  frameworkVersion: string;
  frameworkType: string;
  currentScore: number;
  totalRequirements: number;
  evaluatedRequirements: number;
}

export function FrameworkHistoryTab({
  frameworkId,
  frameworkName,
  frameworkVersion,
  frameworkType,
  currentScore,
  totalRequirements,
  evaluatedRequirements,
}: FrameworkHistoryTabProps) {
  const { t } = useLanguage();
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
  const liveDiff = stats ? Math.round(currentScore) - Math.round(stats.initialScore) : 0;
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
        maxScore: 100,
      });

      toast.success(t('cardsKpi.sweep.gap.relatorioEvolucaoExportado'));
    } catch {
      toast.error(t('cardsKpi.sweep.gap.erroExportarRelatorio'));
    }
  };

  const formatScore = (s: number) => `${Math.round(s)}%`;

  return (
    <div className="space-y-6">
      {/* Faixa de indicadores no padrão do sistema. Eram três cartões soltos,
          cada um com borda e vão próprios — o padrão antigo, que já saiu do
          resto do produto. */}
      <StatStrip
        items={[
          {
            key: 'inicial',
            label: t('sweepRiscos.gap.history.scoreInicial'),
            value: stats ? formatScore(stats.initialScore) : '—',
          },
          {
            key: 'atual',
            label: t('sweepRiscos.gap.history.scoreAtual'),
            value: formatScore(currentScore),
            icon: trend === 'up' ? IconTrendUp : trend === 'down' ? IconTrendDown : IconMinus,
            hint: stats ? `${liveDiff > 0 ? '+' : ''}${formatScore(liveDiff)}` : undefined,
            tone: trend === 'down' ? 'destructive' : undefined,
          },
          {
            key: 'progresso',
            label: t('sweepRiscos.gap.history.progresso'),
            value: `${totalRequirements > 0 ? Math.round((evaluatedRequirements / totalRequirements) * 100) : 0}%`,
            hint: t('sweepRiscos.gap.history.requisitosAvaliados', { evaluated: evaluatedRequirements, total: totalRequirements }),
          },
        ]}
      />

      {/* Evolution chart */}
      <ScoreEvolutionChart frameworkId={frameworkId} />

      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExportEvolution}>
          <IconDownload className="h-4 w-4 mr-2" strokeWidth={1.5}/>
          {t('sweepRiscos.gap.history.exportarRelatorio')}
        </Button>
      </div>

      {/* Timeline - simplified */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('residuos.score.timelineAvaliacoes')}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t('sweepRiscos.gap.history.medicoesDesc')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.slice(-10).reverse().map((point, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground w-24 shrink-0">
                    <IconCalendar className="h-3.5 w-3.5" strokeWidth={1.5}/>
                    <span>{point.date}</span>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span>
                    {t('sweepRiscos.gap.scoreChart.score')}: <strong>{formatScore(point.score)}</strong>
                    {' · '}
                    {t('sweepRiscos.gap.history.requisitosAvaliados', { evaluated: point.evaluatedRequirements, total: point.totalRequirements })}
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
