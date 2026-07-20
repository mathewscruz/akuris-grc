import { useState, useEffect } from "react";
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

const getSensitivityBadge = (sensitivity: string) => {
  switch (sensitivity) {
    case 'critico':
      return <StatusBadge size="sm" tone="destructive" intensity="high">Crítico</StatusBadge>;
    case 'sensivel':
      return <StatusBadge size="sm" tone="warning">Sensível</StatusBadge>;
    default:
      return <StatusBadge size="sm" tone="neutral">Comum</StatusBadge>;
  }
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    identificacao: 'Identificação',
    contato: 'Contato',
    localizacao: 'Localização',
    financeiro: 'Financeiro',
    credenciais: 'Credenciais',
    saude: 'Saúde',
    documentos: 'Documentos',
    texto_livre: 'Texto Livre',
    outros: 'Outros'
  };
  return labels[category] || category;
};

const getDataTypeLabel = (dataType: string) => {
  const labels: Record<string, string> = {
    email: 'E-mail',
    nome: 'Nome',
    cpf: 'CPF',
    rg: 'RG',
    cnpj: 'CNPJ',
    telefone: 'Telefone',
    endereco: 'Endereço',
    data_nascimento: 'Data de Nascimento',
    senha: 'Senha',
    cartao_credito: 'Cartão de Crédito',
    conta_bancaria: 'Conta Bancária',
    saude: 'Dados de Saúde',
    genero: 'Gênero',
    arquivo: 'Arquivo',
    comentario: 'Comentário/Mensagem',
    desconhecido: 'Não Classificado'
  };
  return labels[dataType] || dataType;
};

interface DescoberDadosTabProps {
  onRefresh: () => void;
}

export function DescoberDadosTab({ onRefresh }: DescoberDadosTabProps) {
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
        title: "Sucesso",
        description: "Descoberta excluída com sucesso"
      });

      refetch();
      setDeleteConfirm({ open: false, id: '' });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir",
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
      label: 'Página',
      sortable: true,
      render: (value: string, row: Descoberta) => (
        <div className="max-w-[200px]">
          <p className="font-medium truncate">{value || 'Sem título'}</p>
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
      label: 'Formulários',
      sortable: true,
      render: (value: number) => (
        <StatusBadge size="sm" tone="neutral" variant="outline">{value}</StatusBadge>
      )
    },
    {
      key: 'total_campos',
      label: 'Campos',
      sortable: true,
      render: (value: number) => (
        <StatusBadge size="sm" tone="neutral">{value}</StatusBadge>
      )
    },
    {
      key: 'campos_sensiveis',
      label: 'Sensíveis',
      sortable: true,
      render: (value: number) => (
        value > 0 ? (
          <StatusBadge size="sm" tone="warning">{value}</StatusBadge>
        ) : <span className="text-muted-foreground">0</span>
      )
    },
    {
      key: 'campos_criticos',
      label: 'Críticos',
      sortable: true,
      render: (value: number) => (
        value > 0 ? (
          <StatusBadge size="sm" tone="destructive" intensity="high">{value}</StatusBadge>
        ) : <span className="text-muted-foreground">0</span>
      )
    },
    {
      key: 'campos_importados',
      label: 'Importados',
      sortable: true,
      render: (value: number) => (
        value > 0 ? (
          <StatusBadge size="sm" tone="success">{value}</StatusBadge>
        ) : <span className="text-muted-foreground">0</span>
      )
    },
    {
      key: 'created_at',
      label: 'Data',
      sortable: true,
      render: (value: string) => formatDateOnly(value)
    },
    {
      key: 'actions',
      label: 'Ações',
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
              <TooltipContent>Ver Detalhes</TooltipContent>
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
              <TooltipContent>Excluir</TooltipContent>
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
            <h3 className="text-lg font-semibold">Descobertas de Dados</h3>
            <p className="text-sm text-muted-foreground">
              Histórico de escaneamentos de formulários web
            </p>
          </div>
          <Button size="sm" onClick={() => setShowUrlScanner(true)}>
            <Globe className="h-4 w-4 mr-2" />
            Nova Descoberta
          </Button>
        </div>

        <DataTable
          data={descobertas}
          columns={columns}
          searchPlaceholder="Buscar descobertas..."
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
            title: "Nenhuma descoberta registrada",
            description: "Use o scanner para detectar dados pessoais coletados em formulários web.",
            action: {
              label: "Nova Descoberta",
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
            const nome = field.label || field.name || field.id || `Campo ${field.dataType}`;
            const { error } = await supabase.from('dados_pessoais').insert({
              nome: nome,
              descricao: `Detectado via scanner - Campo: ${field.name || field.id}${field.placeholder ? `, Placeholder: ${field.placeholder}` : ''}`,
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
            title: "Importação concluída",
            description: `${created} dado(s) pessoal(is) adicionado(s) ao catálogo`,
          });
          onRefresh();
        }}
      />

      {/* Detail Dialog */}
      <DialogShell
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        icon={Globe}
        title="Detalhes da Descoberta"
        size="lg"
        hideFooter
      >
          {selectedDescoberta && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">{selectedDescoberta.total_formularios}</p>
                        <p className="text-xs text-muted-foreground">Formulários</p>
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
                        <p className="text-xs text-muted-foreground">Campos</p>
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
                        <p className="text-xs text-muted-foreground">Sensíveis</p>
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
                        <p className="text-xs text-muted-foreground">Críticos</p>
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
                    <span className="font-medium">{selectedDescoberta.titulo_pagina || 'Sem título'}</span>
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
                    Escaneado em: {formatDateOnly(selectedDescoberta.created_at)}
                    {selectedDescoberta.campos_importados > 0 && (
                      <> • {selectedDescoberta.campos_importados} campo(s) importado(s)</>
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
                            {form.fields.length} campos
                          </StatusBadge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Campo</TableHead>
                              <TableHead>Tipo HTML</TableHead>
                              <TableHead>Tipo de Dado</TableHead>
                              <TableHead>Categoria LGPD</TableHead>
                              <TableHead>Sensibilidade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {form.fields.map((field, fieldIndex) => (
                              <TableRow key={fieldIndex}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{field.label || field.name || field.id || 'Sem nome'}</p>
                                    {field.placeholder && (
                                      <p className="text-xs text-muted-foreground">"{field.placeholder}"</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{field.type}</code>
                                </TableCell>
                                <TableCell>{getDataTypeLabel(field.dataType)}</TableCell>
                                <TableCell>{getCategoryLabel(field.lgpdCategory)}</TableCell>
                                <TableCell>{getSensitivityBadge(field.sensitivity)}</TableCell>
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
        title="Excluir Descoberta"
        description="Tem certeza que deseja excluir esta descoberta? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
