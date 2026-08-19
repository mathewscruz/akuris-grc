import { useState, useEffect } from 'react';
import { IconDownload, IconSuccess, IconWarning, IconTime, IconCalendar, IconTrendUp, IconChart, IconChartPie } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useLanguage } from '@/contexts/LanguageContext';
import { chartSeries, CHART_GRID, CHART_AXIS, CHART_TOOLTIP_STYLE, CHART_SEVERITY, CHART_FONT } from '@/lib/chart-tokens';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { datePattern, parseDataLocal } from '@/lib/date-utils';
interface RelatorioMetricas {
  total_denuncias: number;
  denuncias_periodo: number;
  tempo_medio_resolucao: number;
  taxa_resolucao: number;
  denuncias_por_status: { status: string; count: number; label: string }[];
  denuncias_por_categoria: { categoria: string; count: number; cor: string }[];
  denuncias_por_gravidade: { gravidade: string; count: number; label: string }[];
  timeline_denuncias: { data: string; count: number }[];
}

export function RelatoriosDenuncia() {
  const { t } = useLanguage();
  const [metricas, setMetricas] = useState<RelatorioMetricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('30dias');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  useEffect(() => {
    carregarRelatorio();
  }, [periodo, dateRange]);

  const carregarRelatorio = async () => {
    setLoading(true);
    try {
      let dataInicio: Date;
      let dataFim: Date = new Date();

      // Definir período
      switch (periodo) {
        case '7dias':
          dataInicio = subDays(new Date(), 7);
          break;
        case '30dias':
          dataInicio = subDays(new Date(), 30);
          break;
        case '90dias':
          dataInicio = subDays(new Date(), 90);
          break;
        case 'mes_atual':
          dataInicio = startOfMonth(new Date());
          dataFim = endOfMonth(new Date());
          break;
        case 'personalizado':
          dataInicio = dateRange?.from || subDays(new Date(), 30);
          dataFim = dateRange?.to || new Date();
          break;
        default:
          dataInicio = subDays(new Date(), 30);
      }

      // Buscar denúncias do período
      const { data: denuncias, error } = await supabase
        .from('denuncias')
        .select(`
          *,
          categoria:denuncias_categorias(nome, cor)
        `)
        .gte('created_at', dataInicio.toISOString())
        .lte('created_at', dataFim.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar total geral
      const { count: totalGeral } = await supabase
        .from('denuncias')
        .select('*', { count: 'exact', head: true });

      // Processar métricas
      const total_denuncias = totalGeral || 0;
      const denuncias_periodo = denuncias?.length || 0;
      
      // Calcular tempo médio de resolução
      const denunciasResolvidas = denuncias?.filter(d => 
        ['resolvida', 'arquivada'].includes(d.status) && d.data_conclusao
      ) || [];
      
      const tempo_medio_resolucao = denunciasResolvidas.length > 0
        ? denunciasResolvidas.reduce((acc, d) => {
            const inicio = new Date(d.created_at);
            const fim = parseDataLocal(d.data_conclusao);
            return acc + (fim.getTime() - inicio.getTime());
          }, 0) / denunciasResolvidas.length / (1000 * 60 * 60 * 24) // em dias
        : 0;

      const taxa_resolucao = denuncias_periodo > 0 
        ? (denunciasResolvidas.length / denuncias_periodo) * 100 
        : 0;

      // Agrupar por status
      const statusMap = {
        nova: t('denunciasAdmin.relatorios.statusNova'),
        em_analise: t('denunciasAdmin.relatorios.statusEmAnalise'),
        em_investigacao: t('denunciasAdmin.relatorios.statusEmInvestigacao'),
        resolvida: t('denunciasAdmin.relatorios.statusResolvida'),
        arquivada: t('denunciasAdmin.relatorios.statusArquivada')
      };

      const denuncias_por_status = Object.entries(statusMap).map(([status, label]) => ({
        status,
        label,
        count: denuncias?.filter(d => d.status === status).length || 0
      }));

      // Agrupar por categoria
      const categoriaGroups = denuncias?.reduce((acc, d) => {
        const categoria = d.categoria?.nome || t('denunciasAdmin.relatorios.semCategoria');
        const cor = d.categoria?.cor || CHART_AXIS;
        if (!acc[categoria]) {
          acc[categoria] = { count: 0, cor };
        }
        acc[categoria].count++;
        return acc;
      }, {} as Record<string, { count: number; cor: string }>);

      const denuncias_por_categoria = Object.entries(categoriaGroups || {}).map(([categoria, data]) => ({
        categoria,
        count: data.count,
        cor: data.cor
      }));

      // Agrupar por gravidade
      const gravidadeMap = {
        baixa: t('denunciasAdmin.relatorios.gravidadeBaixa'),
        media: t('denunciasAdmin.relatorios.gravidadeMedia'),
        alta: t('denunciasAdmin.relatorios.gravidadeAlta'),
        critica: t('denunciasAdmin.relatorios.gravidadeCritica')
      };

      const denuncias_por_gravidade = Object.entries(gravidadeMap).map(([gravidade, label]) => ({
        gravidade,
        label,
        count: denuncias?.filter(d => d.gravidade === gravidade).length || 0
      }));

      // Timeline (últimos 30 dias)
      const timeline_denuncias = Array.from({ length: 30 }, (_, i) => {
        const data = subDays(new Date(), 29 - i);
        const dataStr = format(data, 'dd/MM');
        const count = denuncias?.filter(d => 
          format(new Date(d.created_at), datePattern()) === format(data, datePattern())
        ).length || 0;
        
        return { data: dataStr, count };
      });

      setMetricas({
        total_denuncias,
        denuncias_periodo,
        tempo_medio_resolucao,
        taxa_resolucao,
        denuncias_por_status,
        denuncias_por_categoria,
        denuncias_por_gravidade,
        timeline_denuncias
      });
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportarRelatorio = () => {
    if (!metricas) return;

    const dadosCSV = [
      [t('denunciasAdmin.relatorios.csvPeriodo'), periodo],
      [t('denunciasAdmin.relatorios.csvTotal'), metricas.total_denuncias],
      [t('denunciasAdmin.relatorios.csvPeriodoLabel'), metricas.denuncias_periodo],
      [t('denunciasAdmin.relatorios.csvTempoMedio'), metricas.tempo_medio_resolucao.toFixed(1)],
      [t('denunciasAdmin.relatorios.csvTaxaResolucao'), metricas.taxa_resolucao.toFixed(1)],
      [''],
      [t('denunciasAdmin.relatorios.csvStatus'), t('denunciasAdmin.relatorios.csvQuantidade')],
      ...metricas.denuncias_por_status.map(item => [item.label, item.count]),
      [''],
      [t('denunciasAdmin.relatorios.csvCategoria'), t('denunciasAdmin.relatorios.csvQuantidade')],
      ...metricas.denuncias_por_categoria.map(item => [item.categoria, item.count]),
      [''],
      [t('denunciasAdmin.relatorios.csvGravidade'), t('denunciasAdmin.relatorios.csvQuantidade')],
      ...metricas.denuncias_por_gravidade.map(item => [item.label, item.count])
    ];

    const csvContent = dadosCSV.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-denuncias-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('denunciasAdmin.relatorios.pageTitle')}</h2>
          <p className="text-muted-foreground">
            {t('denunciasAdmin.relatorios.pageDescription')}
          </p>
        </div>
        
        <Button onClick={exportarRelatorio}>
          <IconDownload className="w-4 h-4 mr-2" />
          {t('denunciasAdmin.relatorios.exportCsv')}
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            {t('denunciasAdmin.relatorios.periodTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7dias">{t('denunciasAdmin.relatorios.period7')}</SelectItem>
                <SelectItem value="30dias">{t('denunciasAdmin.relatorios.period30')}</SelectItem>
                <SelectItem value="90dias">{t('denunciasAdmin.relatorios.period90')}</SelectItem>
                <SelectItem value="mes_atual">{t('denunciasAdmin.relatorios.periodCurrentMonth')}</SelectItem>
                <SelectItem value="personalizado">{t('denunciasAdmin.relatorios.periodCustom')}</SelectItem>
              </SelectContent>
            </Select>
            
            {periodo === 'personalizado' && (
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Métricas principais */}
      {metricas && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('denunciasAdmin.relatorios.totalCard')}</CardTitle>
                <IconChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricas.total_denuncias}</div>
                <p className="text-xs text-muted-foreground">
                  {t('denunciasAdmin.relatorios.totalCardFooter', { count: metricas.denuncias_periodo })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('denunciasAdmin.relatorios.avgTimeCard')}</CardTitle>
                <IconTime className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {t('denunciasAdmin.relatorios.avgTimeDays', { days: metricas.tempo_medio_resolucao.toFixed(1) })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('denunciasAdmin.relatorios.avgTimeFooter')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('denunciasAdmin.relatorios.resolutionRateCard')}</CardTitle>
                <IconSuccess className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {metricas.taxa_resolucao.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('denunciasAdmin.relatorios.resolutionRateFooter')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('denunciasAdmin.relatorios.pendingCard')}</CardTitle>
                <IconWarning className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {metricas.denuncias_por_status
                    .filter(s => ['nova', 'em_analise', 'em_investigacao'].includes(s.status))
                    .reduce((acc, s) => acc + s.count, 0)
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('denunciasAdmin.relatorios.pendingFooter')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconChart className="h-5 w-5" />
                  {t('denunciasAdmin.relatorios.statusChartTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricas.denuncias_por_status}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: CHART_FONT.label, fill: CHART_AXIS }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: CHART_AXIS }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill={chartSeries(0)} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Categorias */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconChartPie className="h-5 w-5" />
                  {t('denunciasAdmin.relatorios.categoryChartTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metricas.denuncias_por_categoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ categoria, count }) => `${categoria}: ${count}`}
                      outerRadius={80}
                      fill={chartSeries(0)}
                      dataKey="count"
                    >
                      {metricas.denuncias_por_categoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Gravidade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconWarning className="h-5 w-5" />
                  {t('denunciasAdmin.relatorios.gravityChartTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metricas.denuncias_por_gravidade.map((item, index) => (
                    <div key={item.gravidade} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: CHART_SEVERITY[
                            item.gravidade === 'critica' ? 'critical' :
                            item.gravidade === 'alta' ? 'high' :
                            item.gravidade === 'media' ? 'medium' : 'low'
                          ] }}
                        />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconTrendUp className="h-5 w-5" />
                  {t('denunciasAdmin.relatorios.timelineTitle')}
                </CardTitle>
                <CardDescription>
                  {t('denunciasAdmin.relatorios.timelineDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metricas.timeline_denuncias}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="data" 
                      tick={{ fontSize: CHART_FONT.axis }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke={chartSeries(0)} 
                      strokeWidth={2}
                      dot={{ fill: chartSeries(0) }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}