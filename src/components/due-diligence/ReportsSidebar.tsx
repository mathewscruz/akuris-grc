import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { IconDownload, IconChart, IconTrendUp, IconUsers, IconAward } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDueDiligenceStats } from '@/hooks/useDueDiligenceStats';
import { useReportsData } from '@/hooks/useReportsData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { CHART_GRID, CHART_AXIS, CHART_TOOLTIP_STYLE, chartSeries, CHART_FONT } from '@/lib/chart-tokens';

import { formatarDiaParaDB } from '@/lib/date-utils';
export function ReportsSidebar() {
  const { t } = useLanguage();
  const { data: stats, isLoading: statsLoading } = useDueDiligenceStats();
  const { data: reports, isLoading: reportsLoading } = useReportsData();
  
  const exportReport = () => {
    // Preparar dados para exportação
    const reportData = {
      data_geracao: new Date().toISOString(),
      metricas_gerais: {
        total_avaliacoes: stats?.totalAssessments || 0,
        score_medio: (stats?.averageScore || 0).toFixed(1) + '%',
        concluidas: stats?.completedAssessments || 0,
        pendentes: (stats?.totalAssessments || 0) - (stats?.completedAssessments || 0),
        taxa_conclusao: stats?.totalAssessments > 0 
          ? ((stats.completedAssessments / stats.totalAssessments) * 100).toFixed(1) + '%'
          : '0%'
      },
      performance_categorias: reports?.categoryPerformance || [],
      top_fornecedores: reports?.topSuppliers || [],
      fornecedores_baixo_desempenho: reports?.lowPerformingSuppliers || []
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-due-diligence-${formatarDiaParaDB(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <IconChart className="h-4 w-4 mr-2" />
          {t('dueDiligence.reportsSidebar.reports')}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('dueDiligence.reportsSidebar.title')}</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {/* Métricas Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <IconTrendUp className="h-4 w-4" />
                {t('dueDiligence.reportsSidebar.overviewTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statsLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('dueDiligence.reportsSidebar.totalAssessments')}</span>
                    <span className="font-semibold">{stats?.totalAssessments || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('dueDiligence.reportsSidebar.averageScore')}</span>
                    <Badge variant={
                      (stats?.averageScore || 0) >= 80 ? 'default' : 
                      (stats?.averageScore || 0) >= 60 ? 'secondary' : 
                      'destructive'
                    }>
                      {(stats?.averageScore || 0).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('dueDiligence.reportsSidebar.completionRate')}</span>
                    <span className="font-semibold">
                      {stats?.totalAssessments > 0 
                        ? ((stats.completedAssessments / stats.totalAssessments) * 100).toFixed(1) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('dueDiligence.reportsSidebar.completed')}</span>
                    <span className="font-semibold text-success">{stats?.completedAssessments || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('dueDiligence.reportsSidebar.pending')}</span>
                    <span className="font-semibold text-warning">
                      {(stats?.totalAssessments || 0) - (stats?.completedAssessments || 0)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Gráfico de Performance por Categoria */}
          {!reportsLoading && reports?.categoryPerformance && reports.categoryPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('dueDiligence.reportsSidebar.categoryPerformanceTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={reports.categoryPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    {/* Os dados vêm como `{ category, score }`; o gráfico lia
                        `categoria` e `averageScore` — renderizava sem uma única
                        barra e sem um único rótulo no eixo. */}
                    <XAxis dataKey="category" stroke={CHART_AXIS} tick={{ fontSize: CHART_FONT.label, fill: CHART_AXIS }} />
                    <YAxis stroke={CHART_AXIS} tick={{ fontSize: CHART_FONT.label, fill: CHART_AXIS }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="score" fill={chartSeries(0)} name={t('dueDiligence.reportsSidebar.averageScoreLegend')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Fornecedores */}
          {!reportsLoading && reports?.topSuppliers && reports.topSuppliers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconAward className="h-4 w-4" />
                  {t('dueDiligence.reportsSidebar.topSuppliersTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reports.topSuppliers.map((supplier, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">#{index + 1}</span>
                        <span className="text-sm">{supplier.nome}</span>
                      </div>
                      <Badge variant="default">
                        {supplier.score.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fornecedores de Baixo Desempenho */}
          {!reportsLoading && reports?.lowPerformingSuppliers && reports.lowPerformingSuppliers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconUsers className="h-4 w-4" />
                  {t('dueDiligence.reportsSidebar.lowPerformingTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reports.lowPerformingSuppliers.map((supplier, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border border-warning/30 rounded bg-warning/10/50">
                      <span className="text-sm">{supplier.nome}</span>
                      <Badge variant="destructive">
                        {supplier.score.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Botão de Exportação */}
          <Button onClick={exportReport} className="w-full">
            <IconDownload className="h-4 w-4 mr-2" />
            {t('dueDiligence.reportsSidebar.exportButton')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
