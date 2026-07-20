import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const exportarRelatorio = async (formato: 'excel' | 'pdf') => {
    if (!controles || controles.length === 0) {
      toast({ title: "Sem dados", description: "Nenhum controle encontrado para exportar.", variant: "destructive" });
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
      toast({ title: "CSV exportado", description: `${controles.length} controles exportados.` });
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
      doc.text('Relatorio de Controles', pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Total: ${controles.length} controles`, pageWidth / 2, y, { align: 'center' });
      y += 12;

      y = addSectionTitle(doc, 'Resumo', y, margin);
      doc.setFontSize(10);
      doc.setTextColor(AKURIS_COLORS.text);
      doc.text(`Total: ${stats?.total || 0}  |  Ativos: ${stats?.ativos || 0}  |  Criticos: ${stats?.criticos || 0}  |  Preventivos: ${stats?.preventivos || 0}`, margin + 8, y);
      y += 12;

      y = addSectionTitle(doc, 'Lista de Controles', y, margin);
      drawTableHeader(doc, [
        { text: 'Nome', x: margin + 2 },
        { text: 'Tipo', x: margin + 72 },
        { text: 'Criticidade', x: margin + 102 },
        { text: 'Status', x: margin + 140 },
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
      toast({ title: "PDF gerado", description: "Relatorio de controles baixado com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Erro ao gerar PDF.", variant: "destructive" });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatórios e Análises
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tipoRelatorio} onValueChange={setTipoRelatorio}>
          <TabsList>
            <TabsTrigger value="eficacia">Eficácia</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="gaps">Análise de Gaps</TabsTrigger>
            <TabsTrigger value="cobertura">Cobertura</TabsTrigger>
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
                Excel
              </Button>
              <Button 
                variant="outline" 
                onClick={() => exportarRelatorio('pdf')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button onClick={salvarRelatorio}>
                Salvar Relatório
              </Button>
            </div>
          </div>

          <TabsContent value="eficacia" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de Controles</p>
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
                      <p className="text-sm font-medium text-muted-foreground">Controles Ativos</p>
                      <p className="text-2xl font-bold text-green-600">{stats?.ativos || 0}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Críticos</p>
                      <p className="text-2xl font-bold text-red-600">{stats?.criticos || 0}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Preventivos</p>
                      <p className="text-2xl font-bold text-blue-600">{stats?.preventivos || 0}</p>
                    </div>
                    <PieChart className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tendência de Eficácia</CardTitle>
                <CardDescription>
                  Evolução da eficácia dos controles ao longo do tempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Gráfico de tendência será implementado aqui
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status de Compliance</CardTitle>
                <CardDescription>
                  Avaliação de conformidade por área e processo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {controles?.slice(0, 5).map((controle) => (
                    <div key={controle.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{controle.nome}</h4>
                        <p className="text-sm text-muted-foreground">{controle.area || 'Não especificada'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={controle.status === 'ativo' ? 'default' : 'secondary'}
                        >
                          {formatStatus(controle.status)}
                        </Badge>
                        <Badge 
                          variant={controle.criticidade === 'alto' ? 'destructive' : 
                                  controle.criticidade === 'medio' ? 'secondary' : 'outline'}
                        >
                          {formatStatus(controle.criticidade)}
                        </Badge>
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
                <CardTitle>Análise de Gaps</CardTitle>
                <CardDescription>
                  Identificação de riscos sem controles adequados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg border-amber-200 bg-amber-50">
                    <div>
                      <h4 className="font-medium text-amber-800">Área Financeira</h4>
                      <p className="text-sm text-amber-600">3 riscos sem controles preventivos</p>
                    </div>
                    <Badge variant="warning">
                      Gap Identificado
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg border-red-200 bg-red-50">
                    <div>
                      <h4 className="font-medium text-red-800">Área de TI</h4>
                      <p className="text-sm text-red-600">2 riscos críticos sem controles</p>
                    </div>
                    <Badge variant="destructive">
                      Gap Crítico
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cobertura" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Matriz de Cobertura</CardTitle>
                <CardDescription>
                  Visualização cruzada de riscos vs controles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">85%</p>
                      <p className="text-sm text-green-600">Cobertura Geral</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">92%</p>
                      <p className="text-sm text-blue-600">Riscos Críticos</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">78%</p>
                      <p className="text-sm text-amber-600">Riscos Médios</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}