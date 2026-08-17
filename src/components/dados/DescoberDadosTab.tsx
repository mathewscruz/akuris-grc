import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe, Trash2, Eye, Plus, Search, ExternalLink, FileText, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDialog from "@/components/ConfirmDialog";
import { UrlScannerDialog } from "@/components/dados/UrlScannerDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDateOnly } from "@/lib/date-utils";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FormField {
  name: string;
  type: string;
  id: string;
  placeholder: string;
  label: string;
  required: boolean;
  dataType: string;
  lgpdCategory: string;
  sensitivity: string;
}

interface DetectedForm {
  formId: string;
  formName: string;
  action: string;
  method: string;
  fields: FormField[];
}

interface Descoberta {
  id: string;
  url: string;
  titulo_pagina: string;
  total_formularios: number;
  total_campos: number;
  campos_sensiveis: number;
  campos_criticos: number;
  resultado_scan: DetectedForm[];
  campos_importados: number;
  status: string;
  created_at: string;
}

const getSensitivityBadge = (sensitivity: string, t: (key: string) => string) => {
  switch (sensitivity) {
    case 'critico':
      return <StatusBadge size="sm" tone="destructive" intensity="high">{t('dadosDashboard.descobertaDadosTab.sensitivityCritico')}</StatusBadge>;
    case 'sensivel':
      return <StatusBadge size="sm" tone="warning">{t('dadosDashboard.descobertaDadosTab.sensitivitySensivel')}</StatusBadge>;
    default:
      return <StatusBadge size="sm" tone="neutral">{t('dadosDashboard.descobertaDadosTab.sensitivityComum')}</StatusBadge>;
  }
};

const getCategoryLabel = (category: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    identificacao: t('dadosDashboard.descobertaDadosTab.categoriaIdentificacao'),
    contato: t('dadosDashboard.descobertaDadosTab.categoriaContato'),
    localizacao: t('dadosDashboard.descobertaDadosTab.categoriaLocalizacao'),
    financeiro: t('dadosDashboard.descobertaDadosTab.categoriaFinanceiro'),
    credenciais: t('dadosDashboard.descobertaDadosTab.categoriaCredenciais'),
    saude: t('dadosDashboard.descobertaDadosTab.categoriaSaude'),
    documentos: t('dadosDashboard.descobertaDadosTab.categoriaDocumentos'),
    texto_livre: t('dadosDashboard.descobertaDadosTab.categoriaTextoLivre'),
    outros: t('dadosDashboard.descobertaDadosTab.categoriaOutros')
  };
  return labels[category] || category;
};

const getDataTypeLabel = (dataType: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    email: t('dadosDashboard.descobertaDadosTab.tipoEmail'),
    nome: t('dadosDashboard.descobertaDadosTab.tipoNome'),
    cpf: t('dadosDashboard.descobertaDadosTab.tipoCpf'),
    rg: t('dadosDashboard.descobertaDadosTab.tipoRg'),
    cnpj: t('dadosDashboard.descobertaDadosTab.tipoCnpj'),
    telefone: t('dadosDashboard.descobertaDadosTab.tipoTelefone'),
    endereco: t('dadosDashboard.descobertaDadosTab.tipoEndereco'),
    data_nascimento: t('dadosDashboard.descobertaDadosTab.tipoDataNascimento'),
    senha: t('dadosDashboard.descobertaDadosTab.tipoSenha'),
    cartao_credito: t('dadosDashboard.descobertaDadosTab.tipoCartaoCredito'),
    conta_bancaria: t('dadosDashboard.descobertaDadosTab.tipoContaBancaria'),
    saude: t('dadosDashboard.descobertaDadosTab.tipoSaude'),
    genero: t('dadosDashboard.descobertaDadosTab.tipoGenero'),
    arquivo: t('dadosDashboard.descobertaDadosTab.tipoArquivo'),
    comentario: t('dadosDashboard.descobertaDadosTab.tipoComentario'),
    desconhecido: t('dadosDashboard.descobertaDadosTab.tipoDesconhecido')
  };
  return labels[dataType] || dataType;
};

interface DescoberDadosTabProps {
  onRefresh: () => void;
}

export function DescoberDadosTab({ onRefresh }: DescoberDadosTabProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();
  const [showUrlScanner, setShowUrlScanner] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedDescoberta, setSelectedDescoberta] = useState<Descoberta | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data: descobertas = [], isLoading, refetch } = useQuery({
    queryKey: ['dados-descobertas', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('dados_descobertas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        resultado_scan: item.resultado_scan as DetectedForm[]
      })) as Descoberta[];
    },
    enabled: !!empresaId
  });

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, id });
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('dados_descobertas')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: t('dadosDashboard.descobertaDadosTab.toastDeleteSuccessTitle'),
        description: t('dadosDashboard.descobertaDadosTab.toastDeleteSuccessDescription')
      });

      refetch();
      setDeleteConfirm({ open: false, id: '' });
    } catch (error: any) {
      toast({
        title: t('dadosDashboard.descobertaDadosTab.toastDeleteErrorTitle'),
        description: error.message || t('dadosDashboard.descobertaDadosTab.toastDeleteErrorDefault'),
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (descoberta: Descoberta) => {
    setSelectedDescoberta(descoberta);
    setShowDetailDialog(true);
  };

  const handleScanComplete = async (scanResult: any, fieldsImported: number) => {
    if (!empresaId) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('dados_descobertas').insert({
        empresa_id: empresaId,
        url: scanResult.url,
        titulo_pagina: scanResult.title,
        total_formularios: scanResult.forms.length,
        total_campos: scanResult.totalFields,
        campos_sensiveis: scanResult.sensitiveFieldsCount,
        campos_criticos: scanResult.criticalFieldsCount,
        resultado_scan: scanResult.forms,
        campos_importados: fieldsImported,
        created_by: userData.user?.id
      } as any);

      if (error) throw error;

      refetch();
    } catch (error) {
      console.error('Erro ao salvar descoberta:', error);
    }
  };

  const columns = [
    {
      key: 'titulo_pagina',
      label: t('dadosDashboard.descobertaDadosTab.columnPagina'),
      sortable: true,
      render: (value: string, row: Descoberta) => (
        <div className="max-w-[200px]">
          <p className="font-medium truncate">{value || t('dadosDashboard.descobertaDadosTab.semTitulo')}</p>
          <a 
            href={row.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate block"
          >
            {row.url}
          </a>
        </div>
      )
    },
    {
      key: 'total_formularios',
      label: t('dadosDashboard.descobertaDadosTab.columnFormularios'),
      sortable: true,
      render: (value: number) => (
        <StatusBadge size="sm" tone="neutral" variant="outline">{value}</StatusBadge>
      )
    },
    {
      key: 'total_campos',
      label: t('dadosDashboard.descobertaDadosTab.columnCampos'),
      sortable: true,
      render: (value: number) => (
        <StatusBadge size="sm" tone="neutral">{value}</StatusBadge>
      )
    },
    {
      key: 'campos_sensiveis',
      label: t('dadosDashboard.descobertaDadosTab.columnSensiveis'),
      sortable: true,
      render: (value: number) => (
        value > 0 ? (
          <StatusBadge size="sm" tone="warning">{value}</StatusBadge>
        ) : <span className="text-muted-foreground">0</span>
      )
    },
    {
      key: 'campos_criticos',
      label: t('dadosDashboard.descobertaDadosTab.columnCriticos'),
      sortable: true,
      render: (value: number) => (
        value > 0 ? (
          <StatusBadge size="sm" tone="destructive" intensity="high">{value}</StatusBadge>
        ) : <span className="text-muted-foreground">0</span>
      )
    },
    {
      key: 'campos_importados',
      label: t('dadosDashboard.descobertaDadosTab.columnImportados'),
      sortable: true,
      render: (value: number) => (
        value > 0 ? (
          <StatusBadge size="sm" tone="success">{value}</StatusBadge>
        ) : <span className="text-muted-foreground">0</span>
      )
    },
    {
      key: 'created_at',
      label: t('dadosDashboard.descobertaDadosTab.columnData'),
      sortable: true,
      render: (value: string) => formatDateOnly(value)
    },
    {
      key: 'actions',
      label: t('dadosDashboard.descobertaDadosTab.columnAcoes'),
      render: (_: any, row: Descoberta) => (
        <TooltipProvider>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewDetails(row)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('dadosDashboard.descobertaDadosTab.tooltipVerDetalhes')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(row.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('dadosDashboard.descobertaDadosTab.tooltipExcluir')}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )
    }
  ];

  return (
    <Card className="rounded-lg border">
      <CardContent className="p-0">
        <div className="p-6 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold">{t('dadosDashboard.descobertaDadosTab.headerTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('dadosDashboard.descobertaDadosTab.headerSubtitle')}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowUrlScanner(true)}>
            <Globe className="h-4 w-4 mr-2" />
            {t('dadosDashboard.descobertaDadosTab.buttonNovaDescoberta')}
          </Button>
        </div>

        <DataTable
          data={descobertas}
          columns={columns}
          searchPlaceholder={t('dadosDashboard.descobertaDadosTab.searchPlaceholder')}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={(field) => {
            if (field === sortField) {
              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
            } else {
              setSortField(field);
              setSortDirection('desc');
            }
          }}
          emptyState={{
            icon: <Globe className="h-8 w-8" />,
            title: t('dadosDashboard.descobertaDadosTab.emptyTitle'),
            description: t('dadosDashboard.descobertaDadosTab.emptyDescription'),
            action: {
              label: t('dadosDashboard.descobertaDadosTab.buttonNovaDescoberta'),
              onClick: () => setShowUrlScanner(true)
            }
          }}
          loading={isLoading}
        />
      </CardContent>

      {/* Scanner Dialog */}
      <UrlScannerDialog
        isOpen={showUrlScanner}
        onClose={() => setShowUrlScanner(false)}
        onImport={async (fields, scanResult) => {
          let created = 0;
          for (const field of fields) {
            const nome = field.label || field.name || field.id || t('dadosDashboard.descobertaDadosTab.importCampoDefault', { dataType: field.dataType });
            const { error } = await supabase.from('dados_pessoais').insert({
              nome: nome,
              descricao: t('dadosDashboard.descobertaDadosTab.importDescricao', {
                field: field.name || field.id,
                placeholder: field.placeholder ? t('dadosDashboard.descobertaDadosTab.importPlaceholderSuffix', { placeholder: field.placeholder }) : ''
              }),
              categoria_dados: field.lgpdCategory || 'outros',
              tipo_dados: field.sensitivity === 'critico' ? 'sensivel' : 'comum',
              sensibilidade: field.sensitivity === 'critico' ? 'muito_sensivel' : field.sensitivity === 'sensivel' ? 'sensivel' : 'comum',
              origem_coleta: 'formulario_web',
              forma_coleta: 'automatica',
              finalidade_tratamento: 'A definir',
              base_legal: 'consentimento'
            } as any);
            if (!error) created++;
          }
          
          // Salvar descoberta
          if (scanResult) {
            await handleScanComplete(scanResult, created);
          }
          
          toast({
            title: t('dadosDashboard.descobertaDadosTab.toastImportSuccessTitle'),
            description: t('dadosDashboard.descobertaDadosTab.toastImportSuccessDescription', { count: created }),
          });
          onRefresh();
        }}
      />

      {/* Detail Dialog */}
      <DialogShell
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        icon={Globe}
        title={t('dadosDashboard.descobertaDadosTab.detailDialogTitle')}
        size="lg"
        hideFooter
      >
          {selectedDescoberta && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">{selectedDescoberta.total_formularios}</p>
                        <p className="text-xs text-muted-foreground">{t('dadosDashboard.descobertaDadosTab.cardFormularios')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-info" />
                      <div>
                        <p className="text-2xl font-bold">{selectedDescoberta.total_campos}</p>
                        <p className="text-xs text-muted-foreground">{t('dadosDashboard.descobertaDadosTab.cardCampos')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <div>
                        <p className="text-2xl font-bold">{selectedDescoberta.campos_sensiveis}</p>
                        <p className="text-xs text-muted-foreground">{t('dadosDashboard.descobertaDadosTab.cardSensiveis')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-destructive" />
                      <div>
                        <p className="text-2xl font-bold">{selectedDescoberta.campos_criticos}</p>
                        <p className="text-xs text-muted-foreground">{t('dadosDashboard.descobertaDadosTab.cardCriticos')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Page Info */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ExternalLink className="h-4 w-4" />
                    <span className="font-medium">{selectedDescoberta.titulo_pagina || t('dadosDashboard.descobertaDadosTab.semTitulo')}</span>
                  </div>
                  <a 
                    href={selectedDescoberta.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedDescoberta.url}
                  </a>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('dadosDashboard.descobertaDadosTab.scannedAtPrefix')}: {formatDateOnly(selectedDescoberta.created_at)}
                    {selectedDescoberta.campos_importados > 0 && (
                      <> • {selectedDescoberta.campos_importados} {t('dadosDashboard.descobertaDadosTab.importedFieldsSuffix')}</>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Forms Accordion */}
              {selectedDescoberta.resultado_scan && selectedDescoberta.resultado_scan.length > 0 && (
                <Accordion type="multiple" className="w-full">
                  {selectedDescoberta.resultado_scan.map((form, formIndex) => (
                    <AccordionItem key={formIndex} value={`form-${formIndex}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">{form.formName}</span>
                          <StatusBadge size="sm" tone="neutral">
                            {t('dadosDashboard.descobertaDadosTab.camposCount', { count: form.fields.length })}
                          </StatusBadge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('dadosDashboard.descobertaDadosTab.campoLabel')}</TableHead>
                              <TableHead>{t('dadosDashboard.descobertaDadosTab.tipoHtmlLabel')}</TableHead>
                              <TableHead>{t('dadosDashboard.descobertaDadosTab.tipoDadoLabel')}</TableHead>
                              <TableHead>{t('dadosDashboard.descobertaDadosTab.categoriaLgpdLabel')}</TableHead>
                              <TableHead>{t('dadosDashboard.descobertaDadosTab.sensibilidadeLabel')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {form.fields.map((field, fieldIndex) => (
                              <TableRow key={fieldIndex}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{field.label || field.name || field.id || t('dadosDashboard.descobertaDadosTab.semNome')}</p>
                                    {field.placeholder && (
                                      <p className="text-xs text-muted-foreground">"{field.placeholder}"</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{field.type}</code>
                                </TableCell>
                                <TableCell>{getDataTypeLabel(field.dataType, t)}</TableCell>
                                <TableCell>{getCategoryLabel(field.lgpdCategory, t)}</TableCell>
                                <TableCell>{getSensitivityBadge(field.sensitivity, t)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          )}
      </DialogShell>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t('dadosDashboard.descobertaDadosTab.deleteDialogTitle')}
        description={t('dadosDashboard.descobertaDadosTab.deleteDialogDescription')}
        confirmText={t('dadosDashboard.descobertaDadosTab.deleteDialogConfirm')}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
