import { useState } from "react";
import { IconDownload, IconWarning, IconFile, IconChart, IconTrendUp, IconChartPie } from '@/components/icons';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveControleStatusTone, resolveCriticidadeTone } from "@/lib/status-tone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { loadAkurisLogo, addAkurisHeader, addAkurisFooter, addSectionTitle, drawTableHeader, formatLabel, AKURIS_COLORS } from "@/lib/pdf-utils";
import { exportCSV } from "@/lib/csv-utils";
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { criticidadeControle, resultadoTeste } from '@/lib/metrics/controles';
import { severidadeRiscoEfetiva, SEVERIDADES, type Severidade } from '@/lib/metrics/riscos';
import { chartSeries, CHART_GRID, CHART_AXIS, CHART_TOOLTIP_STYLE } from '@/lib/chart-tokens';
import { formatMonthYearLabel, intlLocale, parseDataLocal, formatarDiaParaDB} from '@/lib/date-utils';
import { pct } from '@/lib/metrics/core';

interface RelatoriosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RelatoriosDialog({ open, onOpenChange }: RelatoriosDialogProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date()
  });
  const [tipoRelatorio, setTipoRelatorio] = useState<string>("eficacia");

  // Buscar dados para relatórios
  // Só corre com o diálogo aberto: sem o guarda, cada carregamento da
  // listagem de controles disparava também as consultas do relatório.
  const { data: controles } = useQuery({
    queryKey: ['controles-relatorios'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles')
        .select(`
          *,
          categoria:controles_categorias(nome, cor),
          testes:controles_testes(resultado, data_teste),
          riscos:controles_riscos(*)
        `);
      
      if (error) throw error;
      return data;
    }
  });

  /** Nomes dos responsáveis: a coluna guarda `profiles.user_id`. */
  const { data: perfis } = useQuery({
    queryKey: ['controles-relatorios-perfis'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, nome');
      if (error) throw error;
      return data ?? [];
    },
  });

  const nomePorUtilizador = useMemo(() => {
    const mapa: Record<string, string> = {};
    (perfis ?? []).forEach((p: any) => { mapa[p.user_id] = p.nome; });
    return mapa;
  }, [perfis]);

  const { data: stats } = useQuery({
    queryKey: ['controles-stats-relatorio'],
    enabled: open,
    queryFn: async () => {
      const { data: controles, error } = await supabase
        .from('controles')
        .select('status, criticidade, tipo');
      
      if (error) throw error;

      const total = controles.length;
      const ativos = controles.filter(c => c.status === 'ativo').length;
      // Contava `criticidade === 'alto'` e rotulava "Críticos": errava duas vezes,
      // porque o banco guarda o género feminino e porque alto não é crítico.
      const criticos = controles.filter(c => criticidadeControle(c) === 'critico').length;
      const preventivos = controles.filter(c => c.tipo === 'preventivo').length;

      return { total, ativos, criticos, preventivos };
    }
  });

  /** Riscos da empresa e os seus vínculos a controlos — base da cobertura e dos gaps. */
  const { data: riscosCobertura } = useQuery({
    queryKey: ['riscos-cobertura-relatorio'],
    enabled: open,
    queryFn: async () => {
      const [{ data: riscos, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
        supabase.from('riscos').select('id, nome, nivel_risco_inicial, nivel_risco_residual, status'),
        supabase.from('controles_riscos').select('risco_id'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const comControlo = new Set((vinculos ?? []).map((v) => v.risco_id));
      // Severidade residual quando existe, como na listagem de Riscos — o
      // relatório não pode chamar "crítico" a um risco que a tabela mostra
      // como "alto".
      return (riscos ?? []).map((r) => ({
        ...r,
        severidade: severidadeRiscoEfetiva(r),
        temControlo: comControlo.has(r.id),
      }));
    },
  });

  /** Cobertura geral e por severidade. `null` quando não há riscos dessa faixa —
   *  nunca 0%, que se leria como "descoberto" em vez de "não aplicável". */
  const cobertura = useMemo(() => {
    const lista = riscosCobertura ?? [];
    const faixa = (sev: Severidade) => {
      const alvo = lista.filter((r) => r.severidade === sev);
      return {
        total: alvo.length,
        cobertos: alvo.filter((r) => r.temControlo).length,
        percentual: alvo.length ? pct(alvo.filter((r) => r.temControlo).length, alvo.length) : null,
      };
    };
    return {
      geral: {
        total: lista.length,
        cobertos: lista.filter((r) => r.temControlo).length,
        percentual: lista.length ? pct(lista.filter((r) => r.temControlo).length, lista.length) : null,
      },
      critico: faixa('critico'),
      alto: faixa('alto'),
    };
  }, [riscosCobertura]);

  /** Riscos sem qualquer controlo vinculado, do mais severo para o menos. */
  const gaps = useMemo(() => {
    const ordem = SEVERIDADES;
    return (riscosCobertura ?? [])
      .filter((r) => !r.temControlo)
      .sort((a, b) => ordem.indexOf(a.severidade) - ordem.indexOf(b.severidade));
  }, [riscosCobertura]);

  /**
   * Eficácia média por mês, a partir dos testes realmente registados.
   *
   * O seletor de período existia e nunca chegava a lado nenhum: só era
   * serializado no JSON do relatório guardado. Um PDF assinado como "últimos 30
   * dias" trazia o histórico completo. Agora recorta os TESTES, que são o que
   * tem data — recortar o inventário de controlos por `created_at` esconderia
   * controlos vigentes, que é o defeito que o relatório de Contratos tem.
   */
  const tendencia = useMemo(() => {
    const PESO: Record<string, number> = { eficaz: 100, parcial: 50, ineficaz: 0 };
    const porMes = new Map<string, { soma: number; n: number; data: Date }>();
    const desde = dateRange?.from ? new Date(dateRange.from.setHours(0, 0, 0, 0)) : null;
    const ate = dateRange?.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : null;
    (controles ?? []).forEach((c: any) => {
      (c.testes ?? []).forEach((teste: any) => {
        const r = resultadoTeste(teste);
        if (r === 'indefinido' || !teste.data_teste) return;
        const d = parseDataLocal(teste.data_teste);
        if (desde && d < desde) return;
        if (ate && d > ate) return;
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const atual = porMes.get(chave) ?? { soma: 0, n: 0, data: new Date(d.getFullYear(), d.getMonth(), 1) };
        atual.soma += PESO[r];
        atual.n += 1;
        porMes.set(chave, atual);
      });
    });
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ mes: formatMonthYearLabel(v.data), eficacia: Math.round(v.soma / v.n), testes: v.n }));
  }, [controles, dateRange]);

  /** Tom por faixa de percentagem — verde só quando a cobertura é boa. */
  const tomDaCobertura = (percentual: number | null) => {
    if (percentual === null) return { cor: 'text-muted-foreground', fundo: 'bg-muted/40 border-border' };
    if (percentual >= 80) return { cor: 'text-success', fundo: 'bg-success/10 border-success/20' };
    if (percentual >= 50) return { cor: 'text-warning', fundo: 'bg-warning/10 border-warning/20' };
    return { cor: 'text-destructive', fundo: 'bg-destructive/10 border-destructive/20' };
  };

  const { toast } = useToast();
  const { t } = useLanguage();

  const exportarRelatorio = async (formato: 'excel' | 'pdf') => {
    if (!controles || controles.length === 0) {
      toast({ title: t('controlesAuditorias.rdToastNoDataTitle'), description: t('controlesAuditorias.rdToastNoDataDesc'), variant: "destructive" });
      return;
    }

    if (formato === 'excel') {
      exportCSV(
        ['Nome', 'Tipo', 'Criticidade', 'Status', 'Frequencia Teste', 'Responsavel'],
        controles.map((c: any) => [
          c.nome,
          formatLabel(c.tipo || ''),
          formatLabel(c.criticidade || ''),
          formatLabel(c.status || ''),
          // As colunas sao `frequencia` e `responsavel_id`. Com os nomes
          // errados, as duas saiam vazias nas 116 linhas do CSV.
          formatLabel(c.frequencia || ''),
          nomePorUtilizador[c.responsavel_id] || '',
        ]),
        'relatorio_controles'
      );
      toast({ title: t('controlesAuditorias.rdToastCsvExportedTitle'), description: t('controlesAuditorias.rdToastCsvExportedDesc', { count: controles.length }) });
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
      doc.text(t('controlesAuditorias.rdPdfTitle'), pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text(t('controlesAuditorias.rdPdfGeneratedAt', { date: new Date().toLocaleDateString(intlLocale()), count: controles.length }), pageWidth / 2, y, { align: 'center' });
      y += 12;

      y = addSectionTitle(doc, t('controlesAuditorias.rdPdfResumo'), y, margin);
      doc.setFontSize(10);
      doc.setTextColor(AKURIS_COLORS.text);
      doc.text(t('controlesAuditorias.rdPdfResumoLine', { total: stats?.total || 0, ativos: stats?.ativos || 0, criticos: stats?.criticos || 0, preventivos: stats?.preventivos || 0 }), margin + 8, y);
      y += 12;

      y = addSectionTitle(doc, t('controlesAuditorias.rdPdfListaControles'), y, margin);
      drawTableHeader(doc, [
        { text: t('controlesAuditorias.rdPdfColNome'), x: margin + 2 },
        { text: t('controlesAuditorias.rdPdfColTipo'), x: margin + 72 },
        { text: t('controlesAuditorias.rdPdfColCriticidade'), x: margin + 102 },
        { text: t('controlesAuditorias.rdPdfColStatus'), x: margin + 140 },
      ], y, margin, contentWidth);
      y += 5;

      doc.setFont('helvetica', 'normal');
      controles.forEach((c: any, i: number) => {
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
        doc.text((c.nome || '').substring(0, 38), margin + 2, y);
        doc.text(formatLabel(c.tipo || ''), margin + 72, y);
        doc.text(formatLabel(c.criticidade || ''), margin + 102, y);
        doc.text(formatLabel(c.status || ''), margin + 140, y);
        y += 5.5;
      });

      addAkurisFooter(doc);
      doc.save(`relatorio_controles_${formatarDiaParaDB(new Date())}.pdf`);
      toast({ title: t('controlesAuditorias.rdToastPdfGeneratedTitle'), description: t('controlesAuditorias.rdToastPdfGeneratedDesc') });
    } catch {
      toast({ title: t('controlesAuditorias.rdToastPdfErrorTitle'), description: t('controlesAuditorias.rdToastPdfErrorDesc'), variant: "destructive" });
    }
  };

  const salvarRelatorio = async () => {
    // Buscar empresa_id do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!profile?.empresa_id) return;

    const config = {
      tipo: tipoRelatorio,
      dateRange: {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString()
      },
      filtros: {}
    };

    const { error } = await supabase
      .from('relatorios_salvos')
      .insert({
        nome: `Relatório ${tipoRelatorio} - ${new Date().toLocaleDateString()}`,
        tipo: tipoRelatorio,
        configuracao: config as any,
        empresa_id: profile.empresa_id
      });

    if (error) {
      console.error('Erro ao salvar relatório:', error);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChart}
      title={t('controlesAuditorias.rdTitle')}
      size="lg"
      hideFooter
    >
        <Tabs value={tipoRelatorio} onValueChange={setTipoRelatorio}>
          <TabsList>
            <TabsTrigger value="eficacia">{t('controlesAuditorias.rdTabEficacia')}</TabsTrigger>
            <TabsTrigger value="compliance">{t('controlesAuditorias.rdTabCompliance')}</TabsTrigger>
            <TabsTrigger value="gaps">{t('controlesAuditorias.rdTabGaps')}</TabsTrigger>
            <TabsTrigger value="cobertura">{t('controlesAuditorias.rdTabCobertura')}</TabsTrigger>
          </TabsList>

          {/* Filtros Gerais */}
          <div className="flex gap-4 mb-6">
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => exportarRelatorio('excel')}
                className="flex items-center gap-2"
              >
                <IconDownload className="h-4 w-4" />
                {t('controlesAuditorias.rdBtnExcel')}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => exportarRelatorio('pdf')}
                className="flex items-center gap-2"
              >
                <IconFile className="h-4 w-4" />
                {t('controlesAuditorias.rdBtnPdf')}
              </Button>
              <Button onClick={salvarRelatorio}>
                {t('controlesAuditorias.rdBtnSalvar')}
              </Button>
            </div>
          </div>

          <TabsContent value="eficacia" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('controlesAuditorias.rdStatTotal')}</p>
                      <p className="text-2xl font-bold">{stats?.total || 0}</p>
                    </div>
                    <IconChart className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('controlesAuditorias.rdStatAtivos')}</p>
                      <p className="text-2xl font-bold text-success">{stats?.ativos || 0}</p>
                    </div>
                    <IconTrendUp className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('controlesAuditorias.rdStatCriticos')}</p>
                      <p className="text-2xl font-bold text-destructive">{stats?.criticos || 0}</p>
                    </div>
                    <IconWarning className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('controlesAuditorias.rdStatPreventivos')}</p>
                      <p className="text-2xl font-bold text-info">{stats?.preventivos || 0}</p>
                    </div>
                    <IconChartPie className="h-8 w-8 text-info" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('controlesAuditorias.rdTendenciaTitle')}</CardTitle>
                <CardDescription>
                  {t('controlesAuditorias.rdTendenciaDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tendencia.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-center text-sm text-muted-foreground px-6">
                    {t('controlesAuditorias.rdTendenciaVazia')}
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tendencia} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                        <XAxis dataKey="mes" stroke={CHART_AXIS} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} stroke={CHART_AXIS} fontSize={12} tickLine={false} axisLine={false} unit="%" />
                        <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [v + '%', t('controlesAuditorias.rdTendenciaEixo')]} />
                        <Line type="monotone" dataKey="eficacia" stroke={chartSeries(0)} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('controlesAuditorias.rdComplianceTitle')}</CardTitle>
                <CardDescription>
                  {t('controlesAuditorias.rdComplianceDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {controles?.slice(0, 5).map((controle) => (
                    <div key={controle.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{controle.nome}</h4>
                        <p className="text-sm text-muted-foreground">{controle.area || t('controlesAuditorias.rdAreaNaoEspecificada')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge {...resolveControleStatusTone(controle.status)}>
                          {formatStatus(controle.status)}
                        </StatusBadge>
                        <StatusBadge {...resolveCriticidadeTone(controle.criticidade)}>
                          {formatStatus(controle.criticidade)}
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gaps" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('controlesAuditorias.rdGapsTitle')}</CardTitle>
                <CardDescription>
                  {t('controlesAuditorias.rdGapsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(riscosCobertura?.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('controlesAuditorias.rdGapsSemRiscos')}
                  </p>
                ) : gaps.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('controlesAuditorias.rdGapsVazio')}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t('controlesAuditorias.rdGapsResumo', { semControle: gaps.length, total: riscosCobertura?.length ?? 0 })}
                    </p>
                    <div className="space-y-2">
                      {gaps.map((risco) => (
                        <div key={risco.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                          <div className="min-w-0">
                            <h4 className="font-medium truncate">{risco.nome}</h4>
                            <p className="text-sm text-muted-foreground">{t('controlesAuditorias.rdGapSemControle')}</p>
                          </div>
                          <StatusBadge {...resolveCriticidadeTone(risco.severidade)}>
                            {formatStatus(risco.severidade)}
                          </StatusBadge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cobertura" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('controlesAuditorias.rdCoberturaTitle')}</CardTitle>
                <CardDescription>
                  {t('controlesAuditorias.rdCoberturaDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {([
                    // O tom vem da PERCENTAGEM, não da faixa de risco: "Cobertura
                    // Geral 0% (0 de 31)" saía a verde de sucesso porque a cor
                    // estava fixa na linha. Verde tem de querer dizer bom.
                    { faixa: cobertura.geral, rotulo: t('controlesAuditorias.rdCoberturaGeral'), ...tomDaCobertura(cobertura.geral.percentual) },
                    { faixa: cobertura.critico, rotulo: t('controlesAuditorias.rdCoberturaRiscosCriticos'), ...tomDaCobertura(cobertura.critico.percentual) },
                    { faixa: cobertura.alto, rotulo: t('controlesAuditorias.rdCoberturaRiscosAltos'), ...tomDaCobertura(cobertura.alto.percentual) },
                  ]).map(({ faixa, rotulo, cor, fundo }) => (
                    <Card key={rotulo} className={fundo}>
                      <CardContent className="p-4 text-center">
                        {/* Sem riscos nessa faixa não há percentagem: 0% leria-se
                            como "descoberto", que é o oposto de "não aplicável". */}
                        <p className={faixa.percentual === null ? 'text-2xl font-bold text-muted-foreground' : 'text-2xl font-bold ' + cor}>
                          {faixa.percentual === null ? t('controlesAuditorias.rdSemDados') : faixa.percentual + '%'}
                        </p>
                        <p className={'text-sm ' + cor}>{rotulo}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('controlesAuditorias.rdCoberturaDetalhe', { cobertos: faixa.cobertos, total: faixa.total })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </DialogShell>
  );
}