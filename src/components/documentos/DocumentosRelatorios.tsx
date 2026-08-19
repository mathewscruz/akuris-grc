import React, { useState } from 'react';
import { estadoDocumento, isDocumentoVencido } from '@/lib/metrics/documentos';
import { IconFilter, IconDownload, IconChart } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly, intlLocale, parseDataLocal } from '@/lib/date-utils';
import jsPDF from 'jspdf';
import { loadAkurisLogo, addAkurisHeader, addAkurisFooter, addSectionTitle, drawTableHeader, formatLabel, AKURIS_COLORS } from '@/lib/pdf-utils';

interface Documento {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  classificacao?: string;
  data_vencimento?: string;
  versao?: number;
  created_at?: string;
  descricao?: string;
}

interface Categoria {
  id: string;
  nome: string;
}

interface DocumentosRelatoriosProps {
  documentos: Documento[];
  categorias: Categoria[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentosRelatorios({ documentos, categorias, open, onOpenChange }: DocumentosRelatoriosProps) {
  const [gerando, setGerando] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const exportCSV = (dados: Documento[], nomeArquivo: string) => {
    const headers = [
      t('documentosExtras.relatorios.csvNome'),
      t('documentosExtras.relatorios.csvTipo'),
      t('documentosExtras.relatorios.csvClassificacao'),
      t('documentosExtras.relatorios.csvStatus'),
      t('documentosExtras.relatorios.csvVersao'),
      t('documentosExtras.relatorios.csvValidade'),
      t('documentosExtras.relatorios.csvDataCriacao'),
    ];
    const rows = dados.map(doc => [
      doc.nome,
      formatLabel(doc.tipo),
      doc.classificacao ? formatLabel(doc.classificacao) : "",
      formatLabel(doc.status),
      doc.versao || 1,
      doc.data_vencimento ? formatDateOnly(doc.data_vencimento) : "",
      doc.created_at ? formatDateOnly(doc.created_at) : ""
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${nomeArquivo}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const gerarRelatorioGeral = async () => {
    setGerando('geral');
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
      doc.text(t('documentosExtras.relatorios.pdfTituloRelatorioGeral'), pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(AKURIS_COLORS.textLight);
      doc.text(
        t('documentosExtras.relatorios.pdfGeradoEm', { data: new Date().toLocaleDateString(intlLocale()), total: String(documentos.length) }),
        pageWidth / 2,
        y,
        { align: 'center' }
      );
      y += 12;

      // Derivado de `estadoDocumento`, não de `status` cru: assim o resumo
      // soma o total. Faltava a linha dos pendentes, e um documento vencido só
      // conta se estiver activo — um rascunho nunca teve vigência para expirar.
      const ativos = documentos.filter((d) => estadoDocumento(d) === 'ativo').length;
      const inativos = documentos.filter((d) => estadoDocumento(d) === 'arquivado').length;
      const pendentes = documentos.filter((d) => estadoDocumento(d) === 'pendente_aprovacao').length;
      const rascunhos = documentos.filter((d) => estadoDocumento(d) === 'rascunho').length;
      const vencidos = documentos.filter((d) => isDocumentoVencido(d)).length;

      y = addSectionTitle(doc, t('documentosExtras.relatorios.pdfResumoStatus'), y, margin);
      doc.setFontSize(10);
      doc.setTextColor(AKURIS_COLORS.text);
      doc.text(t('documentosExtras.relatorios.pdfAtivos', { qtd: String(ativos) }), margin + 8, y); y += 6;
      doc.text(t('documentosExtras.relatorios.pdfInativos', { qtd: String(inativos) }), margin + 8, y); y += 6;
      doc.text(t('documentosExtras.relatorios.pdfPendentes', { qtd: String(pendentes) }), margin + 8, y); y += 6;
      doc.text(t('documentosExtras.relatorios.pdfRascunhos', { qtd: String(rascunhos) }), margin + 8, y); y += 6;
      doc.text(t('documentosExtras.relatorios.pdfVencidos', { qtd: String(vencidos) }), margin + 8, y); y += 10;

      y = addSectionTitle(doc, t('documentosExtras.relatorios.pdfListaDocumentos'), y, margin);

      drawTableHeader(doc, [
        { text: t('documentosExtras.relatorios.colunaNome'), x: margin + 2 },
        { text: t('documentosExtras.relatorios.colunaTipo'), x: margin + 82 },
        { text: t('documentosExtras.relatorios.colunaStatus'), x: margin + 118 },
        { text: t('documentosExtras.relatorios.colunaValidade'), x: margin + 148 },
      ], y, margin, contentWidth);
      y += 5;

      doc.setFont('helvetica', 'normal');
      documentos.forEach((d, i) => {
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
        doc.text(d.nome.substring(0, 42), margin + 2, y);
        doc.text(formatLabel(d.tipo) || '', margin + 82, y);
        doc.text(formatLabel(d.status) || '', margin + 118, y);
        doc.text(d.data_vencimento ? formatDateOnly(d.data_vencimento) : '-', margin + 148, y);
        y += 5.5;
      });

      addAkurisFooter(doc);
      doc.save(`relatorio_geral_documentos_${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: t('documentosExtras.relatorios.relatorioGerado'), description: t('documentosExtras.relatorios.pdfBaixado') });
    } catch {
      toast({ title: t('documentosExtras.relatorios.erroTitulo'), description: t('documentosExtras.relatorios.erroGerar'), variant: "destructive" });
    } finally {
      setGerando(null);
    }
  };

  const gerarRelatorioVencidos = () => {
    setGerando('vencidos');
    try {
      const hoje = new Date();
      const vencidos = documentos.filter(d => d.data_vencimento && parseDataLocal(d.data_vencimento) < hoje);
      exportCSV(vencidos, 'documentos_vencidos');
      toast({
        title: t('documentosExtras.relatorios.relatorioGerado'),
        description: t('documentosExtras.relatorios.vencidosExportados', { qtd: String(vencidos.length) }),
      });
    } catch {
      toast({ title: t('documentosExtras.relatorios.erroTitulo'), description: t('documentosExtras.relatorios.erroGerar'), variant: "destructive" });
    } finally {
      setGerando(null);
    }
  };

  const gerarRelatorioPorCategoria = () => {
    setGerando('categoria');
    try {
      exportCSV(documentos, 'documentos_por_categoria');
      toast({
        title: t('documentosExtras.relatorios.relatorioGerado'),
        description: t('documentosExtras.relatorios.exportados', { qtd: String(documentos.length) }),
      });
    } catch {
      toast({ title: t('documentosExtras.relatorios.erroTitulo'), description: t('documentosExtras.relatorios.erroGerar'), variant: "destructive" });
    } finally {
      setGerando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('documentosExtras.relatorios.titulo')}</DialogTitle>
          <DialogDescription>
            {t('documentosExtras.relatorios.descricao')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconChart className="h-5 w-5" />
                  {t('documentosExtras.relatorios.relatorioGeralTitulo')}
                </CardTitle>
                <CardDescription>
                  {t('documentosExtras.relatorios.relatorioGeralDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={gerarRelatorioGeral} disabled={gerando === 'geral'}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  {gerando === 'geral' ? t('documentosExtras.relatorios.gerando') : t('documentosExtras.relatorios.gerarPdf')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconFilter className="h-5 w-5" />
                  {t('documentosExtras.relatorios.docsVencidosTitulo')}
                </CardTitle>
                <CardDescription>
                  {t('documentosExtras.relatorios.docsVencidosDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={gerarRelatorioVencidos} disabled={gerando === 'vencidos'}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  {gerando === 'vencidos' ? t('documentosExtras.relatorios.gerando') : t('documentosExtras.relatorios.exportarCsv')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconChart className="h-5 w-5" />
                  {t('documentosExtras.relatorios.porCategoriaTitulo')}
                </CardTitle>
                <CardDescription>
                  {t('documentosExtras.relatorios.porCategoriaDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={gerarRelatorioPorCategoria} disabled={gerando === 'categoria'}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  {gerando === 'categoria' ? t('documentosExtras.relatorios.gerando') : t('documentosExtras.relatorios.exportarCsv')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
