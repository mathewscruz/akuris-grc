import React, { useState, useRef } from 'react';
import { IconClose, IconDownload, IconUpload, IconSuccess, IconWarning } from '@/components/icons';
;
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';

interface ImportacaoAtivosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportedAtivo {
  nome: string;
  tipo: string;
  descricao?: string;
  proprietario?: string;
  localizacao?: string;
  valor_negocio?: string;
  criticidade: string;
  status: string;
  data_aquisicao?: string;
  fornecedor?: string;
  versao?: string;
  tags?: string;
  imei?: string;
  cliente?: string;
  quantidade?: number;
  valid: boolean;
  errors: string[];
  line: number;
}

const ImportacaoAtivos: React.FC<ImportacaoAtivosProps> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
  const [importedData, setImportedData] = useState<ImportedAtivo[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const tiposAtivo = [
    // Tecnologia da Informação
    'servidor', 'aplicacao', 'banco_dados', 'rede', 'endpoint', 'dispositivo_movel', 'armazenamento', 'software', 'hardware',
    // Almoxarifado
    'almoxarifado_equipamento', 'almoxarifado_ferramenta', 'almoxarifado_material', 'almoxarifado_epi',
    // Escritório
    'mobiliario', 'equipamento_escritorio', 'equipamento_comunicacao', 'material_escritorio',
    // Veículos e Transporte
    'veiculo_terrestre', 'veiculo_aereo', 'maquina_pesada', 'equipamento_transporte',
    // Instalações e Infraestrutura
    'imovel', 'estrutura_fisica', 'instalacao_eletrica', 'instalacao_hidraulica',
    // Segurança
    'equipamento_seguranca', 'sistema_monitoramento', 'controle_acesso', 'equipamento_bombeiro',
    // Produção e Operações
    'maquina_producao', 'ferramenta_producao', 'equipamento_medicao', 'equipamento_teste',
    // Outros
    'equipamento_medico', 'equipamento_laboratorio', 'outros'
  ];

  const criticidades = ['critico', 'alto', 'medio', 'baixo'];
  const statusOptions = ['ativo', 'inativo', 'descontinuado'];
  const valoresNegocio = ['alto', 'medio', 'baixo'];

  const downloadTemplate = () => {
    const template = [
      ['nome*', 'tipo*', 'descricao', 'proprietario', 'localizacao', 'valor_negocio', 'criticidade*', 'status*', 'data_aquisicao', 'fornecedor', 'versao', 'tags', 'imei', 'cliente', 'quantidade'],
      ['Servidor Web Principal', 'servidor', 'Servidor web para aplicação principal', 'TI', 'Data Center A', 'alto', 'critico', 'ativo', '2024-01-15', 'Dell', '1.0', 'web,critico', '', 'Cliente A', '1'],
      ['Notebook HP', 'hardware', 'Notebook para desenvolvimento', 'João Silva', 'Escritório SP', 'medio', 'medio', 'ativo', '2024-02-01', 'HP', '2.0', 'desenvolvimento', '', '', '1']
    ];

    const csvContent = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template-ativos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateAtivo = (ativo: any, lineNumber: number): ImportedAtivo => {
    const errors: string[] = [];

    // Validações obrigatórias
    if (!ativo.nome?.trim()) errors.push(t('contratosAtivos.importacaoAtivos.errorRequiredName'));
    if (!ativo.tipo?.trim()) errors.push(t('contratosAtivos.importacaoAtivos.errorRequiredType'));
    if (!ativo.criticidade?.trim()) errors.push(t('contratosAtivos.importacaoAtivos.errorRequiredCriticality'));
    if (!ativo.status?.trim()) errors.push(t('contratosAtivos.importacaoAtivos.errorRequiredStatus'));

    // Validações de valores permitidos
    if (ativo.tipo && !tiposAtivo.includes(ativo.tipo.toLowerCase())) {
      errors.push(t('contratosAtivos.importacaoAtivos.errorInvalidType', { values: tiposAtivo.join(', ') }));
    }
    if (ativo.criticidade && !criticidades.includes(ativo.criticidade.toLowerCase())) {
      errors.push(t('contratosAtivos.importacaoAtivos.errorInvalidCriticality', { values: criticidades.join(', ') }));
    }
    if (ativo.status && !statusOptions.includes(ativo.status.toLowerCase())) {
      errors.push(t('contratosAtivos.importacaoAtivos.errorInvalidStatus', { values: statusOptions.join(', ') }));
    }
    if (ativo.valor_negocio && !valoresNegocio.includes(ativo.valor_negocio.toLowerCase())) {
      errors.push(t('contratosAtivos.importacaoAtivos.errorInvalidBusinessValue', { values: valoresNegocio.join(', ') }));
    }

    // Validação de data
    if (ativo.data_aquisicao && ativo.data_aquisicao.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(ativo.data_aquisicao)) {
        errors.push(t('contratosAtivos.importacaoAtivos.errorInvalidDate'));
      }
    }

    // Validação de quantidade
    if (ativo.quantidade && isNaN(Number(ativo.quantidade))) {
      errors.push(t('contratosAtivos.importacaoAtivos.errorInvalidQuantity'));
    }

    return {
      nome: ativo.nome?.trim() || '',
      tipo: ativo.tipo?.toLowerCase().trim() || '',
      descricao: ativo.descricao?.trim() || '',
      proprietario: ativo.proprietario?.trim() || '',
      localizacao: ativo.localizacao?.trim() || '',
      valor_negocio: ativo.valor_negocio?.toLowerCase().trim() || '',
      criticidade: ativo.criticidade?.toLowerCase().trim() || 'medio',
      status: ativo.status?.toLowerCase().trim() || 'ativo',
      data_aquisicao: ativo.data_aquisicao?.trim() || '',
      fornecedor: ativo.fornecedor?.trim() || '',
      versao: ativo.versao?.trim() || '',
      tags: ativo.tags?.trim() || '',
      imei: ativo.imei?.trim() || '',
      cliente: ativo.cliente?.trim() || '',
      quantidade: ativo.quantidade ? Number(ativo.quantidade) : 1,
      valid: errors.length === 0,
      errors,
      line: lineNumber
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length < 2) {
          toast.error(t('contratosAtivos.importacaoAtivos.errorEmptyFile'));
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace('*', ''));
        const data: ImportedAtivo[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const ativo: any = {};
          
          headers.forEach((header, index) => {
            ativo[header] = values[index] || '';
          });

          data.push(validateAtivo(ativo, i + 1));
        }

        setImportedData(data);
        setValidCount(data.filter(a => a.valid).length);
        setErrorCount(data.filter(a => !a.valid).length);
        setStep('preview');
      } catch (error) {
        toast.error(t('contratosAtivos.importacaoAtivos.errorParseFile'));
      }
    };
    reader.readAsText(file);
  };

  const performImport = async () => {
    if (!profile?.empresa_id) {
      toast.error(t('contratosAtivos.importacaoAtivos.errorNoEmpresa'));
      return;
    }

    setStep('importing');
    setImportProgress(0);

    const validAtivos = importedData.filter(ativo => ativo.valid);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validAtivos.length; i++) {
      const ativo = validAtivos[i];
      
      try {
        const ativoData = {
          nome: ativo.nome,
          tipo: ativo.tipo,
          descricao: ativo.descricao || null,
          proprietario: ativo.proprietario || null,
          localizacao: ativo.localizacao || null,
          valor_negocio: ativo.valor_negocio || null,
          criticidade: ativo.criticidade,
          status: ativo.status,
          data_aquisicao: ativo.data_aquisicao || null,
          fornecedor: ativo.fornecedor || null,
          versao: ativo.versao || null,
          tags: ativo.tags ? ativo.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : null,
          imei: ativo.imei || null,
          cliente: ativo.cliente || null,
          quantidade: ativo.quantidade,
          empresa_id: profile.empresa_id,
        };

        const { error } = await supabase
          .from('ativos')
          .insert(ativoData);

        if (error) {
          console.error(`Erro ao importar ativo linha ${ativo.line}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`Erro ao processar ativo linha ${ativo.line}:`, error);
        errorCount++;
      }

      setImportProgress(Math.round(((i + 1) / validAtivos.length) * 100));
    }

    setStep('success');
    
    if (successCount > 0) {
      toast.success(t('contratosAtivos.importacaoAtivos.toastImportSuccess', { count: successCount }));
      onSuccess();
    }
    if (errorCount > 0) {
      toast.error(t('contratosAtivos.importacaoAtivos.toastImportError', { count: errorCount }));
    }
  };

  const resetImport = () => {
    setStep('upload');
    setImportedData([]);
    setImportProgress(0);
    setValidCount(0);
    setErrorCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconUpload className="h-5 w-5" />
            {t('contratosAtivos.importacaoAtivos.title')}
          </DialogTitle>
          <DialogDescription>
            {t('contratosAtivos.importacaoAtivos.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <Alert>
                <IconWarning className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t('contratosAtivos.importacaoAtivos.alertTitle')}</strong> {t('contratosAtivos.importacaoAtivos.alertDescription')}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('contratosAtivos.importacaoAtivos.step1Title')}</CardTitle>
                    <CardDescription>
                      {t('contratosAtivos.importacaoAtivos.step1Description')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={downloadTemplate} variant="outline" className="w-full">
                      <IconDownload className="h-4 w-4 mr-2" />
                      {t('contratosAtivos.importacaoAtivos.downloadTemplateButton')}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('contratosAtivos.importacaoAtivos.step2Title')}</CardTitle>
                    <CardDescription>
                      {t('contratosAtivos.importacaoAtivos.step2Description')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                      <IconUpload className="h-4 w-4 mr-2" />
                      {t('contratosAtivos.importacaoAtivos.selectFileButton')}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('contratosAtivos.importacaoAtivos.fieldsAvailableTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <strong>{t('contratosAtivos.importacaoAtivos.fieldsRequired')}</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>nome</li>
                        <li>tipo</li>
                        <li>criticidade</li>
                        <li>status</li>
                      </ul>
                    </div>
                    <div>
                      <strong>{t('contratosAtivos.importacaoAtivos.fieldsOptional')}</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>descricao</li>
                        <li>proprietario</li>
                        <li>localizacao</li>
                        <li>valor_negocio</li>
                        <li>data_aquisicao</li>
                      </ul>
                    </div>
                    <div>
                      <strong>{t('contratosAtivos.importacaoAtivos.fieldsOther')}</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>fornecedor</li>
                        <li>versao</li>
                        <li>tags</li>
                        <li>imei</li>
                        <li>cliente</li>
                        <li>quantidade</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{t('contratosAtivos.importacaoAtivos.previewTitle')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('contratosAtivos.importacaoAtivos.previewDescription')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{validCount} {t('contratosAtivos.importacaoAtivos.badgeValid')}</Badge>
                  {errorCount > 0 && <Badge variant="destructive">{errorCount} {t('contratosAtivos.importacaoAtivos.badgeError')}</Badge>}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('contratosAtivos.importacaoAtivos.columnLine')}</TableHead>
                      <TableHead>{t('contratosAtivos.importacaoAtivos.columnStatus')}</TableHead>
                      <TableHead>{t('contratosAtivos.importacaoAtivos.columnName')}</TableHead>
                      <TableHead>{t('contratosAtivos.importacaoAtivos.columnType')}</TableHead>
                      <TableHead>{t('contratosAtivos.importacaoAtivos.columnCriticality')}</TableHead>
                      <TableHead>{t('contratosAtivos.importacaoAtivos.columnErrors')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedData.map((ativo, index) => (
                      <TableRow key={index}>
                        <TableCell>{ativo.line}</TableCell>
                        <TableCell>
                          {ativo.valid ? (
                            <IconSuccess className="h-4 w-4 text-success" />
                          ) : (
                            <IconClose className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>{ativo.nome}</TableCell>
                        <TableCell>{formatStatus(ativo.tipo)}</TableCell>
                        <TableCell>
                          <StatusBadge {...resolveCriticidadeTone(ativo.criticidade)}>
                            {formatStatus(ativo.criticidade)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {ativo.errors.length > 0 && (
                            <ul className="text-xs text-destructive">
                              {ativo.errors.map((error, i) => (
                                <li key={i}>• {error}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={resetImport}>
                  {t('contratosAtivos.importacaoAtivos.backButton')}
                </Button>
                <Button 
                  onClick={performImport} 
                  disabled={validCount === 0}
                >
                  {t('contratosAtivos.importacaoAtivos.importButton', { count: validCount })}
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-lg font-semibold">{t('contratosAtivos.importacaoAtivos.importingTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('contratosAtivos.importacaoAtivos.importingDescription')}
                </p>
              </div>
              <Progress value={importProgress} className="w-full" />
              <p className="text-sm">{t('contratosAtivos.importacaoAtivos.importingPercent', { percent: importProgress })}</p>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-6 text-center">
              <IconSuccess className="h-16 w-16 text-success mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">{t('contratosAtivos.importacaoAtivos.successTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('contratosAtivos.importacaoAtivos.successDescription')}
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)}>
                {t('contratosAtivos.importacaoAtivos.closeButton')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportacaoAtivos;