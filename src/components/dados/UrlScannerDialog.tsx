import { useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Search, Globe, FileText, AlertTriangle, Shield, Plus, ExternalLink, Settings2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
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

interface PageResult {
  url: string;
  title: string;
  forms: DetectedForm[];
  totalFields: number;
}

interface ScanResult {
  url: string;
  title: string;
  forms: DetectedForm[];
  totalFields: number;
  sensitiveFieldsCount: number;
  criticalFieldsCount: number;
  // For domain mode
  mode?: 'single' | 'domain';
  pagesScanned?: number;
  pagesWithForms?: number;
  pages?: PageResult[];
}

interface UrlScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (fields: FormField[], scanResult?: ScanResult) => void;
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

export const UrlScannerDialog = ({ isOpen, onClose, onImport }: UrlScannerDialogProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [scanMode, setScanMode] = useState<'single' | 'domain'>('single');
  const [pageLimit, setPageLimit] = useState(50);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, phase: '' });
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const handleScan = async () => {
    if (!url.trim()) {
      toast({
        title: "URL obrigatória",
        description: "Insira uma URL válida para escanear",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setSelectedFields(new Set());
    setScanProgress({ current: 0, total: 0, phase: scanMode === 'domain' ? 'Descobrindo URLs...' : 'Escaneando página...' });

    try {
      const { data, error } = await supabase.functions.invoke('scan-url-forms', {
        body: { 
          url,
          mode: scanMode,
          limit: pageLimit,
          includeSubdomains
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao escanear URL');
      }

      setScanResult(data.data);
      
      if (scanMode === 'domain') {
        const pagesWithForms = data.data.pagesWithForms || 0;
        const pagesScanned = data.data.pagesScanned || 0;
        
        if (pagesWithForms === 0) {
          toast({
            title: "Nenhum formulário encontrado",
            description: `${pagesScanned} página(s) escaneada(s), nenhuma contém formulários com campos de dados`,
          });
        } else {
          toast({
            title: "Scan concluído",
            description: `${pagesWithForms} página(s) com formulários encontrada(s) de ${pagesScanned} escaneadas`,
          });
        }
      } else {
        if (data.data.forms.length === 0) {
          toast({
            title: "Nenhum formulário encontrado",
            description: "A página não contém formulários com campos de entrada de dados",
          });
        } else {
          toast({
            title: "Scan concluído",
            description: `Encontrados ${data.data.forms.length} formulário(s) com ${data.data.totalFields} campo(s)`,
          });
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: "Erro ao escanear",
        description: error instanceof Error ? error.message : "Não foi possível escanear a URL",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
      setScanProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleFieldToggle = (fieldKey: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey);
    } else {
      newSelected.add(fieldKey);
    }
    setSelectedFields(newSelected);
  };

  const getAllFieldKeys = (): Set<string> => {
    const allKeys = new Set<string>();
    if (!scanResult) return allKeys;
    
    if (scanResult.pages && scanResult.pages.length > 0) {
      // Domain mode - pages array
      scanResult.pages.forEach((page, pageIndex) => {
        page.forms.forEach((form, formIndex) => {
          form.fields.forEach((_, fieldIndex) => {
            allKeys.add(`${pageIndex}-${formIndex}-${fieldIndex}`);
          });
        });
      });
    } else {
      // Single mode
      scanResult.forms.forEach((form, formIndex) => {
        form.fields.forEach((_, fieldIndex) => {
          allKeys.add(`0-${formIndex}-${fieldIndex}`);
        });
      });
    }
    return allKeys;
  };

  const handleSelectAll = () => {
    const allKeys = getAllFieldKeys();
    if (selectedFields.size === allKeys.size) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(allKeys);
    }
  };

  const getTotalFieldsCount = (): number => {
    if (!scanResult) return 0;
    if (scanResult.pages && scanResult.pages.length > 0) {
      return scanResult.pages.reduce((sum, page) => sum + page.totalFields, 0);
    }
    return scanResult.totalFields;
  };

  const handleImport = () => {
    if (!scanResult || selectedFields.size === 0) return;

    const fieldsToImport: FormField[] = [];
    
    if (scanResult.pages && scanResult.pages.length > 0) {
      // Domain mode
      scanResult.pages.forEach((page, pageIndex) => {
        page.forms.forEach((form, formIndex) => {
          form.fields.forEach((field, fieldIndex) => {
            if (selectedFields.has(`${pageIndex}-${formIndex}-${fieldIndex}`)) {
              fieldsToImport.push(field);
            }
          });
        });
      });
    } else {
      // Single mode
      scanResult.forms.forEach((form, formIndex) => {
        form.fields.forEach((field, fieldIndex) => {
          if (selectedFields.has(`0-${formIndex}-${fieldIndex}`)) {
            fieldsToImport.push(field);
          }
        });
      });
    }

    onImport(fieldsToImport, scanResult);
    handleClose();
  };

  const handleClose = () => {
    setUrl('');
    setScanMode('single');
    setPageLimit(50);
    setIncludeSubdomains(false);
    setShowAdvanced(false);
    setScanResult(null);
    setSelectedFields(new Set());
    setScanProgress({ current: 0, total: 0, phase: '' });
    onClose();
  };

  const renderFormFields = (form: DetectedForm, formIndex: number, pagePrefix: string = '0') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Campo</TableHead>
          <TableHead>Tipo HTML</TableHead>
          <TableHead>Tipo de Dado</TableHead>
          <TableHead>Categoria LGPD</TableHead>
          <TableHead>Sensibilidade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {form.fields.map((field, fieldIndex) => {
          const fieldKey = `${pagePrefix}-${formIndex}-${fieldIndex}`;
          return (
            <TableRow key={fieldIndex}>
              <TableCell>
                <Checkbox
                  checked={selectedFields.has(fieldKey)}
                  onCheckedChange={() => handleFieldToggle(fieldKey)}
                />
              </TableCell>
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
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={handleClose}
      icon={Globe}
      title="Scanner de Formulários Web"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Fechar
          </Button>
          {scanResult && selectedFields.size > 0 && (
            <Button size="sm" onClick={handleImport}>
              <Plus className="h-4 w-4 mr-2" />
              Importar {selectedFields.size} Campo(s) para Catálogo
            </Button>
          )}
        </div>
      }
    >
        <div className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url">URL para escanear</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                placeholder="https://exemplo.com.br"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isScanning && handleScan()}
                disabled={isScanning}
              />
              <Button onClick={handleScan} disabled={isScanning}>
                {isScanning ? (
                  <>
                    <AkurisPulse size={16} className="mr-2" />
                    Escaneando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Escanear
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Scan Mode Selection */}
          <div className="space-y-3">
            <Label>Modo de Escaneamento</Label>
            <RadioGroup
              value={scanMode}
              onValueChange={(value) => setScanMode(value as 'single' | 'domain')}
              className="flex gap-4"
              disabled={isScanning}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="cursor-pointer font-normal">
                  Página única
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="domain" id="domain" />
                <Label htmlFor="domain" className="cursor-pointer font-normal">
                  Descobrir todo o domínio
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {scanMode === 'single' 
                ? 'Escaneia apenas a página informada'
                : 'Descobre todas as páginas do domínio (ex: /contato, /cadastro) e escaneia cada uma'}
            </p>
          </div>

          {/* Advanced Options for Domain Mode */}
          {scanMode === 'domain' && (
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Opções avançadas
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="pageLimit">Limite de páginas</Label>
                    <Input
                      id="pageLimit"
                      type="number"
                      min={10}
                      max={200}
                      value={pageLimit}
                      onChange={(e) => setPageLimit(parseInt(e.target.value) || 50)}
                      disabled={isScanning}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox
                      id="subdomains"
                      checked={includeSubdomains}
                      onCheckedChange={(checked) => setIncludeSubdomains(!!checked)}
                      disabled={isScanning}
                    />
                    <Label htmlFor="subdomains" className="cursor-pointer font-normal">
                      Incluir subdomínios
                    </Label>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Scan Progress */}
          {isScanning && scanProgress.phase && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{scanProgress.phase}</p>
                  {scanProgress.total > 0 && (
                    <>
                      <Progress value={(scanProgress.current / scanProgress.total) * 100} />
                      <p className="text-xs text-muted-foreground">
                        {scanProgress.current} de {scanProgress.total}
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scan Results */}
          {scanResult && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">
                          {scanResult.pages ? scanResult.pages.reduce((sum, p) => sum + p.forms.length, 0) : scanResult.forms.length}
                        </p>
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
                        <p className="text-2xl font-bold">{getTotalFieldsCount()}</p>
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
                        <p className="text-2xl font-bold">{scanResult.sensitiveFieldsCount}</p>
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
                        <p className="text-2xl font-bold">{scanResult.criticalFieldsCount}</p>
                        <p className="text-xs text-muted-foreground">Críticos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Domain mode - Pages info */}
              {scanResult.mode === 'domain' && scanResult.pagesScanned && (
                <Card>
                  <CardContent className="py-3">
                    <p className="text-sm">
                      <span className="font-medium">{scanResult.pagesScanned}</span> página(s) escaneada(s) • 
                      <span className="font-medium ml-1">{scanResult.pagesWithForms}</span> com formulários
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Page Info (single mode) */}
              {(!scanResult.pages || scanResult.pages.length === 0) && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      {scanResult.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <a 
                      href={scanResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      {scanResult.url}
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Forms Display */}
              {(getTotalFieldsCount() > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Campos Detectados</Label>
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedFields.size === getAllFieldKeys().size ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </Button>
                  </div>

                  <Accordion type="multiple" className="w-full">
                    {scanResult.pages && scanResult.pages.length > 0 ? (
                      // Domain mode - show pages
                      scanResult.pages.map((page, pageIndex) => (
                        <AccordionItem key={pageIndex} value={`page-${pageIndex}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3 flex-wrap">
                              <Globe className="h-4 w-4" />
                              <span className="font-medium truncate max-w-[300px]">{page.title || page.url}</span>
                              <StatusBadge size="sm" tone="neutral">
                                {page.forms.length} form(s)
                              </StatusBadge>
                              <StatusBadge size="sm" tone="neutral" variant="outline">
                                {page.totalFields} campos
                              </StatusBadge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pl-4 space-y-4">
                              <a 
                                href={page.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                {page.url}
                              </a>
                              {page.forms.map((form, formIndex) => (
                                <div key={formIndex} className="border rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-3">
                                    <FileText className="h-4 w-4" />
                                    <span className="font-medium">{form.formName}</span>
                                    {form.method && (
                                      <StatusBadge size="sm" tone="neutral" variant="outline">{form.method}</StatusBadge>
                                    )}
                                  </div>
                                  {renderFormFields(form, formIndex, String(pageIndex))}
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))
                    ) : (
                      // Single mode - show forms directly
                      scanResult.forms.map((form, formIndex) => (
                        <AccordionItem key={formIndex} value={`form-${formIndex}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">{form.formName}</span>
                              <StatusBadge size="sm" tone="neutral">
                                {form.fields.length} campos
                              </StatusBadge>
                              {form.method && (
                                <StatusBadge size="sm" tone="neutral" variant="outline">
                                  {form.method}
                                </StatusBadge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {renderFormFields(form, formIndex)}
                          </AccordionContent>
                        </AccordionItem>
                      ))
                    )}
                  </Accordion>
                </div>
              )}
            </div>
          )}
        </div>

    </DialogShell>
  );
};