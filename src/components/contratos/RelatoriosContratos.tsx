import React, { useState, useEffect } from 'react';
import { IconDownload, IconFile, IconTrendUp, IconTrendDown, IconMoney, IconCalendar, IconUsers, IconChart } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEmpresaMoeda, formatMoeda, formatMoedasSomadas, type MoedaCodigo } from '@/hooks/useEmpresaMoeda';
import { somaPorMoeda } from '@/lib/metrics/contratos';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import jsPDF from 'jspdf';
import { loadAkurisLogo, addAkurisHeader, addAkurisFooter, addSectionTitle, drawTableHeader, formatLabel, AKURIS_COLORS } from '@/lib/pdf-utils';
import { exportCSV } from '@/lib/csv-utils';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { CHART_SERIES, CHART_GRID, CHART_AXIS, CHART_TOOLTIP_STYLE, chartSeries, CHART_FONT } from '@/lib/chart-tokens';
import { dateFnsLocale, datePattern, formatarDiaParaDB, formatDateOnly, intlLocale, parseDataLocal } from '@/lib/date-utils';
import { isContratoVigente } from '@/lib/metrics/contratos';
interface RelatorioData {
  contratos: any[];
  fornecedores: any[];
  marcos: any[];
  aditivos: any[];
}

interface FiltrosRelatorio {
  periodo: 'todos' | 'mes' | 'trimestre' | 'ano' | 'personalizado';
  dataInicio?: Date;
  dataFim?: Date;
  status?: string;
  tipo?: string;
  fornecedor?: string;
}

// Envio 9: paleta neutra partilhada (o roxo é só ação/navegação).
const COLORS = CHART_SERIES;

interface RelatoriosContratosProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export default function RelatoriosContratos({ open: openProp, onOpenChange, hideTrigger }: RelatoriosContratosProps = {}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<RelatorioData>({
    contratos: [],
    fornecedores: [],
    marcos: [],
    aditivos: []
  });
  const [filtros, setFiltros] = useState<FiltrosRelatorio>({
    // "Este mês" recortava por `created_at`: um contrato de cinco anos assinado
    // no ano passado ficava de fora do relatório de hoje. Três das quatro
    // empresas abriam o painel em "0 contratos · R$ 0,00" com contratos
    // vigentes no banco.
    periodo: 'todos'
  });
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { toast } = useToast();
  const { moeda: moedaEmpresa } = useEmpresaMoeda();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchEmpresa = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();
      setEmpresaId(data?.empresa_id || null);
    };
    fetchEmpresa();
  }, []);

  useEffect(() => {
    if (open && empresaId) {
      carregarDados();
    }
  }, [open, filtros, empresaId]);

  const carregarDados = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { dataInicio, dataFim } = calcularPeriodo();

      // Carregar contratos
      const { data: contratos } = await supabase
        .from('contratos')
        .select(`
          *,
          fornecedores!inner(nome, avaliacao_risco)
        `)
        .eq('empresa_id', empresaId)
        // O período é de VIGÊNCIA: entra quem esteve em vigor durante o
        // intervalo, não quem foi cadastrado nele. Um contrato sem data de fim
        // é aberto e conta sempre.
        // `formatarDiaParaDB` e nao `toISOString`: as colunas sao `date` e o
        // UTC adianta o dia a quem esta a oeste de Greenwich.
        .lte('data_inicio', formatarDiaParaDB(dataFim))
        .or(`data_fim.is.null,data_fim.gte.${formatarDiaParaDB(dataInicio)}`);

      // Carregar marcos
      const { data: marcos } = await supabase
        .from('contrato_marcos')
        .select(`
          *,
          contratos!inner(numero_contrato, nome)
        `)
        .eq('contratos.empresa_id', empresaId)
        .gte('data_prevista', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_prevista', format(dataFim, 'yyyy-MM-dd'));

      // Carregar aditivos
      const { data: aditivos } = await supabase
        .from('contrato_aditivos')
        .select(`
          *,
          contratos!inner(numero_contrato, nome)
        `)
        .eq('contratos.empresa_id', empresaId)
        .gte('created_at', dataInicio.toISOString())
        .lte('created_at', dataFim.toISOString());

      // Carregar fornecedores
      const { data: fornecedores } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', empresaId);

      setDados({
        contratos: contratos || [],
        fornecedores: fornecedores || [],
        marcos: marcos || [],
        aditivos: aditivos || []
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.relatoriosContratos.toastLoadError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularPeriodo = () => {
    const hoje = new Date();
    let dataInicio: Date;
    let dataFim: Date;

    switch (filtros.periodo) {
      // "Todos" não é ausência de filtro: é uma janela larga o suficiente para
      // apanhar qualquer vigência, mantendo uma só forma de consulta.
      case 'todos':
        dataInicio = new Date(1970, 0, 1);
        dataFim = new Date(hoje.getFullYear() + 50, 11, 31);
        break;
      case 'mes':
        dataInicio = startOfMonth(hoje);
        dataFim = endOfMonth(hoje);
        break;
      case 'trimestre':
        dataInicio = startOfMonth(subMonths(hoje, 3));
        dataFim = endOfMonth(hoje);
        break;
      case 'ano':
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        dataFim = new Date(hoje.getFullYear(), 11, 31);
        break;
      case 'personalizado':
        dataInicio = filtros.dataInicio || startOfMonth(hoje);
        dataFim = filtros.dataFim || endOfMonth(hoje);
        break;
      default:
        dataInicio = startOfMonth(hoje);
        dataFim = endOfMonth(hoje);
    }

    return { dataInicio, dataFim };
  };

  const exportarRelatorio = async (formato: 'excel' | 'pdf') => {
    if (dados.contratos.length === 0) {
      toast({ title: t('contratosAtivos.relatoriosContratos.toastNoData'), description: t('contratosAtivos.relatoriosContratos.toastNoDataDescription'), variant: "destructive" });
      return;
    }

    if (formato === 'excel') {
      exportCSV(
        [t('contratosDialogs.relatoriosContratos.csvNumero'), t('contratosDialogs.relatoriosContratos.csvNome'), t('contratosDialogs.relatoriosContratos.csvTipo'), t('contratosDialogs.relatoriosContratos.csvStatus'), t('contratosDialogs.relatoriosContratos.csvValorTotal'), t('contratosDialogs.relatoriosContratos.csvDataInicio'), t('contratosDialogs.relatoriosContratos.csvDataFim')],
        dados.contratos.map((c: any) => [
          c.numero_contrato || '',
          c.nome || '',
          formatLabel(c.tipo || ''),
          formatLabel(c.status || ''),
          // A coluna e `valor`. `valor_total` nao existe em `contratos`, por
          // isso esta coluna saia vazia em 100% das linhas do CSV enquanto o
          // cabecalho do mesmo ficheiro imprimia o total somado.
          c.valor ? formatMoeda(Number(c.valor), moedaDoContrato(c)) : '',
          c.data_inicio ? formatDateOnly(c.data_inicio) : '',
          c.data_fim ? formatDateOnly(c.data_fim) : '',
        ]),
        'relatorio_contratos'
      );
      toast({ title: t('contratosAtivos.relatoriosContratos.toastCsvExported'), description: t('contratosAtivos.relatoriosContratos.toastCsvExportedDescription').replace('{count}', String(dados.contratos.length)) });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      const logo = await loadAkurisLogo();

      let y = addAkurisHeader(doc, logo);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(AKURIS_COLORS.text);
      doc.text(t('contratosAtivos.relatoriosContratos.pdfReportTitle'), pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text(t('contratosAtivos.relatoriosContratos.pdfGeneratedAt').replace('{date}', new Date().toLocaleDateString(intlLocale())).replace('{count}', String(dados.contratos.length)), pageWidth / 2, y, { align: 'center' });
      y += 12;

      y = addSectionTitle(doc, t('contratosAtivos.relatoriosContratos.pdfSummarySection'), y, margin);
      doc.setFontSize(10);
      doc.setTextColor(AKURIS_COLORS.text);
      const valorFormatado = textoTotalPorMoeda(dados.contratos.filter((c: any) => isContratoVigente(c)));
      doc.text(t('contratosAtivos.relatoriosContratos.pdfSummaryLine').replace('{total}', String(estatisticasGerais.totalContratos)).replace('{ativos}', String(estatisticasGerais.contratosAtivos)).replace('{valor}', valorFormatado), margin + 8, y);
      y += 12;

      y = addSectionTitle(doc, t('contratosAtivos.relatoriosContratos.pdfListSection'), y, margin);
      drawTableHeader(doc, [
        { text: t('contratosDialogs.relatoriosContratos.pdfNumero'), x: margin + 2 },
        { text: t('contratosDialogs.relatoriosContratos.pdfNome'), x: margin + 32 },
        { text: t('contratosDialogs.relatoriosContratos.pdfTipo'), x: margin + 95 },
        { text: t('contratosDialogs.relatoriosContratos.pdfStatus'), x: margin + 125 },
        { text: t('contratosDialogs.relatoriosContratos.pdfValor'), x: margin + 150 },
      ], y, margin, contentWidth);
      y += 5;

      doc.setFont('helvetica', 'normal');
      dados.contratos.forEach((c: any, i: number) => {
        if (y > pageHeight - 25) {
          doc.addPage();
          y = addAkurisHeader(doc, logo);
        }
        if (i % 2 === 0) {
          doc.setFillColor(248, 247, 255);
          doc.rect(margin, y - 3.5, contentWidth, 5.5, 'F');
        }
        doc.setFontSize(7);
        doc.setTextColor(AKURIS_COLORS.text);
        doc.text((c.numero_contrato || '-').substring(0, 16), margin + 2, y);
        doc.text((c.nome || '-').substring(0, 34), margin + 32, y);
        doc.text(formatLabel(c.tipo || ''), margin + 95, y);
        doc.text(formatLabel(c.status || ''), margin + 125, y);
        doc.text(c.valor ? formatMoeda(Number(c.valor), moedaDoContrato(c)) : '-', margin + 150, y);
        y += 5.5;
      });

      addAkurisFooter(doc);
      doc.save(`relatorio_contratos_${formatarDiaParaDB(new Date())}.pdf`);
      toast({ title: t('contratosAtivos.relatoriosContratos.toastPdfGenerated'), description: t('contratosAtivos.relatoriosContratos.toastPdfGeneratedDescription') });
    } catch {
      toast({ title: t('contratosAtivos.common.error'), description: t('contratosAtivos.relatoriosContratos.toastPdfError'), variant: "destructive" });
    }
  };

  const dadosGraficoContratosStatus = () => {
    const statusCount = dados.contratos.reduce((acc, contrato) => {
      acc[contrato.status] = (acc[contrato.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCount).map(([status, count]) => ({
      name: status,
      value: count
    }));
  };

  const dadosGraficoValorPorTipo = () => {
    const tipoValue = dados.contratos.reduce((acc, contrato) => {
      const valor = parseFloat(contrato.valor) || 0;
      acc[contrato.tipo] = (acc[contrato.tipo] || 0) + valor;
      return acc;
    }, {});

    return Object.entries(tipoValue).map(([tipo, valor]) => ({
      tipo,
      valor: valor
    }));
  };

  const dadosGraficoMarcosPorMes = () => {
    const marcosPorMes = dados.marcos.reduce((acc, marco) => {
      // Sem ancorar ao fuso local, um marco no dia 1 caia no mes anterior.
      const mes = format(parseDataLocal(marco.data_prevista), 'MMM/yyyy', { locale: dateFnsLocale() });
      acc[mes] = (acc[mes] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(marcosPorMes).map(([mes, count]) => ({
      mes,
      marcos: count
    }));
  };

  /*
    Moeda: a do contrato, não «R$» cravado.

    Cinco pontos deste ficheiro escreviam `currency: 'BRL'` à mão. Uma empresa
    configurada em euros via os seus próprios valores rotulados como reais --
    no ecrã, no CSV e no PDF. E o "Valor Total" somava `c.valor` de contratos
    de moedas diferentes SEM converter, pondo uma etiqueta de real no
    resultado. Somar euros com reais não dá dinheiro nenhum.

    Agora cada contrato é formatado na sua moeda, e o total é somado POR moeda:
    com uma só moeda lê-se como antes; com várias, aparecem lado a lado em vez
    de se fundirem num número que não existe.
  */
  /* Isto vivia aqui, escrito à mão, e só aqui: o cartão do módulo e o
     gerador de PDF continuavam a somar moedas diferentes num número só.
     Passou para `lib/metrics/contratos` e `useEmpresaMoeda`, partilhado. */
  const moedaDoContrato = (c: any): MoedaCodigo => (c?.moeda as MoedaCodigo) || moedaEmpresa;

  const textoTotalPorMoeda = (contratos: any[]) =>
    formatMoedasSomadas(somaPorMoeda(contratos, () => true), moedaEmpresa);

  const estatisticasGerais = {
    totalContratos: dados.contratos.length,
    // `status` é o que alguém escreveu; `estadoContrato` é o que a data diz.
    // Somar tudo e chamar-lhe activo anunciava R$ 696.000 na Nexure incluindo
    // um contrato AWS de R$ 420.000 vencido há 20 dias — 60% do total.
    contratosAtivos: dados.contratos.filter((c) => isContratoVigente(c)).length,
    marcosVencendo: dados.marcos.filter(m => {
      const diasRestantes = Math.ceil((parseDataLocal(m.data_prevista).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return diasRestantes <= 30 && diasRestantes >= 0;
    }).length
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <IconChart className="h-4 w-4 mr-2" />
            {t('contratosAtivos.relatoriosContratos.triggerButton')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('contratosAtivos.relatoriosContratos.title')}</DialogTitle>
          <DialogDescription>
            {t('contratosAtivos.relatoriosContratos.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('contratosAtivos.relatoriosContratos.filtersTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={filtros.periodo} onValueChange={(value: any) => setFiltros(prev => ({ ...prev, periodo: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contratosAtivos.relatoriosContratos.periodPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">{t('contratosAtivos.relatoriosContratos.periodAll')}</SelectItem>
                    <SelectItem value="mes">{t('contratosAtivos.relatoriosContratos.periodMonth')}</SelectItem>
                    <SelectItem value="trimestre">{t('contratosAtivos.relatoriosContratos.periodQuarter')}</SelectItem>
                    <SelectItem value="ano">{t('contratosAtivos.relatoriosContratos.periodYear')}</SelectItem>
                    <SelectItem value="personalizado">{t('contratosAtivos.relatoriosContratos.periodCustom')}</SelectItem>
                  </SelectContent>
                </Select>

                  {filtros.periodo === 'personalizado' && (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("justify-start text-left font-normal", !filtros.dataInicio && "text-muted-foreground")}>
                            <IconCalendar className="mr-2 h-4 w-4" />
                            {filtros.dataInicio ? format(filtros.dataInicio, datePattern(), { locale: dateFnsLocale() }) : t('contratosAtivos.relatoriosContratos.startDatePlaceholder')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={filtros.dataInicio} onSelect={(date) => setFiltros(prev => ({ ...prev, dataInicio: date }))} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("justify-start text-left font-normal", !filtros.dataFim && "text-muted-foreground")}>
                            <IconCalendar className="mr-2 h-4 w-4" />
                            {filtros.dataFim ? format(filtros.dataFim, datePattern(), { locale: dateFnsLocale() }) : t('contratosAtivos.relatoriosContratos.endDatePlaceholder')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={filtros.dataFim} onSelect={(date) => setFiltros(prev => ({ ...prev, dataFim: date }))} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}

                <div className="flex gap-2">
                  <Button onClick={() => exportarRelatorio('excel')} size="sm">
                    <IconDownload className="h-4 w-4 mr-2" />
                    {t('contratosAtivos.relatoriosContratos.excelButton')}
                  </Button>
                  <Button onClick={() => exportarRelatorio('pdf')} size="sm" variant="outline">
                    <IconFile className="h-4 w-4 mr-2" />
                    {t('contratosAtivos.relatoriosContratos.pdfButton')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="text-center py-8">{t('contratosAtivos.relatoriosContratos.loading')}</div>
          ) : (
            <>
              {/* Estatísticas Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('contratosAtivos.relatoriosContratos.statTotalContracts')}</CardTitle>
                    <IconFile className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{estatisticasGerais.totalContratos}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('contratosAtivos.relatoriosContratos.statTotalValue')}</CardTitle>
                    <IconMoney className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {textoTotalPorMoeda(dados.contratos.filter((c: any) => isContratoVigente(c)))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('contratosAtivos.relatoriosContratos.statActiveContracts')}</CardTitle>
                    <IconTrendUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{estatisticasGerais.contratosAtivos}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('contratosAtivos.relatoriosContratos.statExpiringMilestones')}</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{estatisticasGerais.marcosVencendo}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('contratosAtivos.relatoriosContratos.chartContractsByStatus')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={dadosGraficoContratosStatus()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill={chartSeries(0)}
                          dataKey="value"
                        >
                          {dadosGraficoContratosStatus().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('contratosAtivos.relatoriosContratos.chartValueByType')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dadosGraficoValorPorTipo()}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="tipo" stroke={CHART_AXIS} tick={{ fontSize: CHART_FONT.label, fill: CHART_AXIS }} />
                        <YAxis stroke={CHART_AXIS} tick={{ fontSize: CHART_FONT.label, fill: CHART_AXIS }} />
                        <Tooltip 
                          formatter={(value: number) => [
                            formatMoeda(value, moedaEmpresa),
                            t('contratosAtivos.relatoriosContratos.tooltipValue')
                          ]}
                        />
                        <Bar dataKey="valor" fill={chartSeries(0)} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>{t('contratosDialogs.relatoriosContratos.chartMilestonesByMonth')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dadosGraficoMarcosPorMes()}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="mes" stroke={CHART_AXIS} tick={{ fontSize: CHART_FONT.label, fill: CHART_AXIS }} />
                        <YAxis stroke={CHART_AXIS} tick={{ fontSize: CHART_FONT.label, fill: CHART_AXIS }} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="marcos" stroke={chartSeries(0)} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Fornecedores por Risco */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('contratosAtivos.relatoriosContratos.chartSuppliersByRisk')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['alto', 'medio', 'baixo'].map(risco => {
                      const fornecedoresRisco = dados.fornecedores.filter(f => f.avaliacao_risco === risco);
                      const contratosPorRisco = dados.contratos.filter(c => 
                        fornecedoresRisco.some(f => f.id === c.fornecedor_id)
                      );
                      
                      return (
                        <div key={risco} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              risco === 'alto' ? 'bg-severity-critical' :
                              risco === 'medio' ? 'bg-severity-medium' : 'bg-severity-low'
                            }`} />
                            <span>{t('contratosAtivos.relatoriosContratos.riskLabel').replace('{risco}', formatStatus(risco))}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{t('contratosAtivos.relatoriosContratos.suppliersCount').replace('{count}', String(fornecedoresRisco.length))}</div>
                            <div className="text-sm text-muted-foreground">
                              {t('contratosAtivos.relatoriosContratos.contractsCount').replace('{count}', String(contratosPorRisco.length))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}