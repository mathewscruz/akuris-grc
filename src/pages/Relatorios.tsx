import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { RelatorioDialog } from '@/components/relatorios/RelatorioDialog';
import { RelatorioPreviewDialog } from '@/components/relatorios/RelatorioPreviewDialog';
import { generateTemplatePDF } from '@/components/relatorios/generateTemplatePDF';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatDateOnly } from '@/lib/date-utils';
import { Plus, FileText, Download, Pencil, Trash2, Eye, MoreHorizontal, FileBarChart, BarChart3, Shield, AlertTriangle, BookOpen, Clock, Briefcase, Package, Search, Users, FileCheck, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { formatStatus } from '@/lib/text-utils';
const templateConfigs: Record<string, { nome: string; descricao: string; icon: any; cor: string }> = {
  executivo_trimestral: { nome: 'fin.relatorios.tpl.executivo_trimestral.nome', descricao: 'fin.relatorios.tpl.executivo_trimestral.desc', icon: BarChart3, cor: 'text-primary' },
  compliance_geral: { nome: 'fin.relatorios.tpl.compliance_geral.nome', descricao: 'fin.relatorios.tpl.compliance_geral.desc', icon: BookOpen, cor: 'text-violet-600' },
  riscos_geral: { nome: 'fin.relatorios.tpl.riscos_geral.nome', descricao: 'fin.relatorios.tpl.riscos_geral.desc', icon: AlertTriangle, cor: 'text-amber-600' },
  incidentes_periodo: { nome: 'fin.relatorios.tpl.incidentes_periodo.nome', descricao: 'fin.relatorios.tpl.incidentes_periodo.desc', icon: AlertTriangle, cor: 'text-destructive' },
  lgpd_anpd: { nome: 'fin.relatorios.tpl.lgpd_anpd.nome', descricao: 'fin.relatorios.tpl.lgpd_anpd.desc', icon: Shield, cor: 'text-emerald-600' },
  iso27001_auditoria: { nome: 'fin.relatorios.tpl.iso27001_auditoria.nome', descricao: 'fin.relatorios.tpl.iso27001_auditoria.desc', icon: FileBarChart, cor: 'text-blue-600' },
  continuidade_bcp: { nome: 'fin.relatorios.tpl.continuidade_bcp.nome', descricao: 'fin.relatorios.tpl.continuidade_bcp.desc', icon: Shield, cor: 'text-cyan-600' },
  contratos_geral: { nome: 'fin.relatorios.tpl.contratos_geral.nome', descricao: 'fin.relatorios.tpl.contratos_geral.desc', icon: Briefcase, cor: 'text-indigo-600' },
  ativos_inventario: { nome: 'fin.relatorios.tpl.ativos_inventario.nome', descricao: 'fin.relatorios.tpl.ativos_inventario.desc', icon: Package, cor: 'text-orange-600' },
  auditoria_interna: { nome: 'fin.relatorios.tpl.auditoria_interna.nome', descricao: 'fin.relatorios.tpl.auditoria_interna.desc', icon: Search, cor: 'text-rose-600' },
  due_diligence_fornecedores: { nome: 'fin.relatorios.tpl.due_diligence_fornecedores.nome', descricao: 'fin.relatorios.tpl.due_diligence_fornecedores.desc', icon: Users, cor: 'text-teal-600' },
  documentos_governanca: { nome: 'fin.relatorios.tpl.documentos_governanca.nome', descricao: 'fin.relatorios.tpl.documentos_governanca.desc', icon: FileCheck, cor: 'text-sky-600' },
  denuncias_canal_etica: { nome: 'fin.relatorios.tpl.denuncias_canal_etica.nome', descricao: 'fin.relatorios.tpl.denuncias_canal_etica.desc', icon: MessageSquare, cor: 'text-fuchsia-600' },
};

export default function Relatorios() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRelatorio, setEditRelatorio] = useState<any>(null);
  const [previewRelatorio, setPreviewRelatorio] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('meus');

  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ['relatorios-customizados', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('relatorios_customizados')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const stats = useMemo(() => ({
    total: relatorios.length,
    publicados: relatorios.filter((r: any) => r.status === 'publicado').length,
    rascunhos: relatorios.filter((r: any) => r.status === 'rascunho').length,
  }), [relatorios]);

  const handleCreate = async (data: any) => {
    if (!empresaId || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('relatorios_customizados').insert({
        ...data,
        empresa_id: empresaId,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(t('fin.relatorios.criado'));
      queryClient.invalidateQueries({ queryKey: ['relatorios-customizados'] });
      setDialogOpen(false);
    } catch (error) {
      logger.error(t('fin.relatorios.erroCriar'), error);
      toast.error(t('fin.relatorios.erroCriar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('relatorios_customizados').delete().eq('id', deleteId).eq('empresa_id', empresaId);
      if (error) throw error;
      toast.success(t('fin.relatorios.excluido'));
      queryClient.invalidateQueries({ queryKey: ['relatorios-customizados'] });
    } catch (error) {
      logger.error(t('fin.relatorios.erroExcluir'), error);
      toast.error(t('fin.relatorios.erroExcluir'));
    } finally {
      setDeleteId(null);
    }
  };

  const handleExportPDF = async (relatorio: any) => {
    if (!empresaId) return;
    setExporting(relatorio.id);
    try {
      if (relatorio.template_base && templateConfigs[relatorio.template_base]) {
        await generateTemplatePDF(relatorio, empresaId);
      } else {
        // Relatório customizado sem template - exportar básico
        const jsPDF = (await import('jspdf')).default;
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text(relatorio.nome, 20, 30);
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(relatorio.descricao || t('fin.comum.semDescricao'), 20, 45);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 60);
        doc.text(`Status: ${formatStatus(relatorio.status)}`, 20, 70);
        doc.save(`${relatorio.nome.replace(/\s+/g, '_')}.pdf`);
      }
      toast.success(t('cardsKpi.sweep.sistema.pdfExportado'));
    } catch (error) {
      logger.error(t('fin.comum.erroExportarPdf'), error);
      toast.error(t('fin.comum.erroExportarPdf'));
    } finally {
      setExporting(null);
    }
  };

  const handleEdit = async (data: any) => {
    if (!editRelatorio) return;
    try {
      const { error } = await supabase.from('relatorios_customizados').update({
        nome: data.nome,
        descricao: data.descricao,
        template_base: data.template_base,
      }).eq('id', editRelatorio.id);
      if (error) throw error;
      toast.success(t('fin.relatorios.atualizado'));
      queryClient.invalidateQueries({ queryKey: ['relatorios-customizados'] });
      setEditRelatorio(null);
    } catch (error) {
      logger.error(t('fin.relatorios.erroEditar'), error);
      toast.error(t('fin.relatorios.erroEditar'));
    }
  };

  const handleCreateFromTemplate = async (templateKey: string) => {
    if (!empresaId || !user?.id) return;
    const config = templateConfigs[templateKey];
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('relatorios_customizados').insert({
        empresa_id: empresaId,
        nome: t(config.nome),
        descricao: t(config.descricao),
        tipo: 'template',
        template_base: templateKey,
        configuracao: { widgets: [], template: templateKey },
        status: 'rascunho',
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(t('fin.relatorios.criadoTemplate', { nome: t(config.nome) }));
      queryClient.invalidateQueries({ queryKey: ['relatorios-customizados'] });
      setActiveTab('meus');
    } catch (error) {
      logger.error('Erro ao criar relatório de template', error);
      toast.error(t('fin.relatorios.erroCriar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.relatorios.title')}
        description={t('modules.relatorios.description')}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: t('fin.relatorios.title') }]}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Relatório
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title={t('fin.relatorios.total')} value={stats.total} icon={<FileText />} variant="primary" showAccent emptyHint={t('fin.relatorios.emptyHint')} />
        <StatCard title="Publicados" value={stats.publicados} icon={<Eye />} variant="success" />
        <StatCard title="Rascunhos" value={stats.rascunhos} icon={<Clock />} variant="warning" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="meus">{t('fin.relatorios.meus')}</TabsTrigger>
          <TabsTrigger value="templates">{t('residuos.geral.templatesPredefinidos')}</TabsTrigger>
        </TabsList>

        <TabsContent value="meus" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6"><div className="h-24 bg-muted rounded" /></CardContent>
                </Card>
              ))}
            </div>
          ) : relatorios.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">{t('fin.relatorios.nenhum')}</h3>
                <p className="text-muted-foreground text-sm mt-1 mb-4">{t('fin.relatorios.vazioDesc')}</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Novo Relatório
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatorios.map((rel: any) => (
                <Card key={rel.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{rel.nome}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{rel.descricao || t('fin.comum.semDescricao')}</p>
                      </div>
                      <Badge variant={rel.status === 'publicado' ? 'success' : rel.status === 'arquivado' ? 'secondary' : 'warning'}>
                        {rel.status === 'publicado' ? 'Publicado' : rel.status === 'arquivado' ? 'Arquivado' : 'Rascunho'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {rel.template_base && templateConfigs[rel.template_base] && (
                      <Badge variant="outline" className="mb-3 text-xs">
                        {t(templateConfigs[rel.template_base].nome)}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mb-3">
                      Criado em {formatDateOnly(rel.created_at)}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {rel.template_base && templateConfigs[rel.template_base] && (
                          <DropdownMenuItem onClick={() => setPreviewRelatorio(rel)}>
                            <Eye className="h-4 w-4 mr-2" />Visualizar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleExportPDF(rel)} disabled={exporting === rel.id}>
                          {exporting === rel.id ? <AkurisPulse size={16} className="mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                          Exportar PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditRelatorio(rel)}>
                          <Pencil className="h-4 w-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(rel.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />{t('fin.comum.excluir')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(templateConfigs).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <Card key={key} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => handleCreateFromTemplate(key)}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg bg-primary/10 ${config.cor}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{t(config.nome)}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{t(config.descricao)}</p>
                        <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-xs group-hover:underline">
                          Usar este template →
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <RelatorioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleCreate}
        loading={saving}
      />

      <RelatorioDialog
        open={!!editRelatorio}
        onOpenChange={(open) => !open && setEditRelatorio(null)}
        onSave={handleEdit}
        relatorio={editRelatorio}
        loading={saving}
      />

      {previewRelatorio && empresaId && (
        <RelatorioPreviewDialog
          open={!!previewRelatorio}
          onOpenChange={(open) => !open && setPreviewRelatorio(null)}
          relatorio={previewRelatorio}
          empresaId={empresaId}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('fin.relatorios.excluirTitle')}
        description={t('fin.relatorios.excluirDesc')}
        confirmText={t('fin.comum.excluir')}
        cancelText={t('fin.comum.cancelar')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
