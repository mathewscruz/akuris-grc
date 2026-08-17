import { useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveControleStatusTone, resolveCriticidadeTone } from "@/lib/status-tone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, FileText, Download, TrendingUp, PieChart, AlertTriangle } from "lucide-react";
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
  const { data: controles } = useQuery({
    queryKey: ['controles-relatorios'],
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

  const { data: stats } = useQuery({
    queryKey: ['controles-stats-relatorio'],
    queryFn: async () => {
      const { data: controles, error } = await supabase
        .from('controles')
        .select('status, criticidade, tipo');
      
      if (error) throw error;

      const total = controles.length;
      const ativos = controles.filter(c => c.status === 'ativo').length;
      const criticos = controles.filter(c => c.criticidade === 'alto').length;
      const preventivos = controles.filter(c => c.tipo === 'preventivo').length;

      return { total, ativos, criticos, preventivos };
    }
  });

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
          formatLabel(c.frequencia_teste || ''),
          c.responsavel || '',
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
      doc.text(t('controlesAuditorias.rdPdfGeneratedAt', { date: new Date().toLocaleDateString('pt-BR'), count: controles.length }), pageWidth / 2, y, { align: 'center' });
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
      doc.save(`relatorio_controles_${new Date().toISOString().split('T')[0]}.pdf`);
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
      icon={BarChart3}
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
                <Download className="h-4 w-4" />
                {t('controlesAuditorias.rdBtnExcel')}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => exportarRelatorio('pdf')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
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
                    <BarChart3 className="h-8 w-8 text-muted-foreground" />
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
                    <TrendingUp className="h-8 w-8 text-success" />
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
                    <AlertTriangle className="h-8 w-8 text-destructive" />
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
                    <PieChart className="h-8 w-8 text-info" />
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
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  {t('controlesAuditorias.rdTendenciaPlaceholder')}
                </div>
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
                        <StatusBadge size="sm" {...resolveControleStatusTone(controle.status)}>
                          {formatStatus(controle.status)}
                        </StatusBadge>
                        <StatusBadge size="sm" {...resolveCriticidadeTone(controle.criticidade)}>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg border-warning/20 bg-warning/10">
                    <div>
                      <h4 className="font-medium text-warning">{t('controlesAuditorias.rdGapFinanceiraTitle')}</h4>
                      <p className="text-sm text-muted-foreground">{t('controlesAuditorias.rdGapFinanceiraDesc')}</p>
                    </div>
                    <StatusBadge tone="warning">{t('controlesAuditorias.rdGapIdentificado')}</StatusBadge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg border-destructive/20 bg-destructive/10">
                    <div>
                      <h4 className="font-medium text-destructive">{t('controlesAuditorias.rdGapTiTitle')}</h4>
                      <p className="text-sm text-muted-foreground">{t('controlesAuditorias.rdGapTiDesc')}</p>
                    </div>
                    <StatusBadge tone="destructive" intensity="high">{t('controlesAuditorias.rdGapCritico')}</StatusBadge>
                  </div>
                </div>
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
                  <Card className="bg-success/10 border-success/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-success">85%</p>
                      <p className="text-sm text-success">{t('controlesAuditorias.rdCoberturaGeral')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-info/10 border-info/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-info">92%</p>
                      <p className="text-sm text-info">{t('controlesAuditorias.rdCoberturaRiscosCriticos')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-warning/10 border-warning/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-warning">78%</p>
                      <p className="text-sm text-warning">{t('controlesAuditorias.rdCoberturaRiscosMedios')}</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </DialogShell>
  );
}