import React, { useState, useRef } from 'react';
import { Upload, Download, AlertTriangle, CheckCircle, X } from 'lucide-react';
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
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Componente genérico de importação CSV, extraído do padrão original de
 * Ativos (ver src/components/ativos/ImportacaoAtivos.tsx). Cada módulo
 * chamador define suas próprias colunas, textos (i18n) e forma de montar o
 * payload de inserção. O componente garante:
 * - Download de modelo CSV
 * - Upload/parse simples de CSV
 * - Validação por linha (obrigatórios, enums, datas, números)
 * - Datas aceitam ISO (yyyy-MM-dd) e dd/MM/yyyy, sempre normalizadas para ISO
 * - Pré-visualização com contagem de válidas/erradas
 * - Inserção em lote sempre com empresa_id do usuário autenticado
 * - Resumo final de importadas/rejeitadas
 */

export type ImportCsvColumnType = 'string' | 'number' | 'date' | 'tags' | 'boolean';

export interface ImportCsvColumn {
  /** cabeçalho esperado no CSV (minúsculo, sem "*") */
  key: string;
  /** rótulo amigável usado na lista de campos disponíveis */
  label: string;
  required?: boolean;
  type?: ImportCsvColumnType;
  /** valores permitidos (case-insensitive); armazenados em minúsculo */
  enumValues?: string[];
  /** valor padrão quando vazio e não obrigatório */
  defaultValue?: string;
}

export interface ImportCsvPreviewColumn {
  key: string;
  label: string;
  render?: (value: any, row: Record<string, any>) => React.ReactNode;
}

export interface ImportCsvRow {
  data: Record<string, any>;
  valid: boolean;
  errors: string[];
  line: number;
}

export interface ImportCsvDialogTexts {
  title: string;
  description: string;
  alertTitle: string;
  alertDescription: string;
  step1Title: string;
  step1Description: string;
  downloadTemplateButton: string;
  step2Title: string;
  step2Description: string;
  selectFileButton: string;
  fieldsAvailableTitle: string;
  fieldsRequired: string;
  fieldsOptional: string;
  previewTitle: string;
  previewDescription: string;
  badgeValid: string;
  badgeError: string;
  columnLine: string;
  columnStatus: string;
  columnErrors: string;
  backButton: string;
  importButton: string;
  importingTitle: string;
  importingDescription: string;
  importingPercent: string;
  successTitle: string;
  successDescription: string;
  closeButton: string;
  errorEmptyFile: string;
  errorParseFile: string;
  errorNoEmpresa: string;
  toastImportSuccess: string;
  toastImportError: string;
  errorRequiredField: string;
  errorInvalidEnum: string;
  errorInvalidDate: string;
  errorInvalidNumber: string;
}

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  texts: ImportCsvDialogTexts;
  columns: ImportCsvColumn[];
  /** nome da tabela supabase de destino */
  tableName: string;
  /** linhas de exemplo (sem cabeçalho) usadas no modelo CSV */
  templateSample: string[][];
  templateFileName: string;
  previewColumns: ImportCsvPreviewColumn[];
  /**
   * Monta o payload final de inserção a partir dos dados normalizados da linha.
   * `empresa_id` é sempre adicionado pelo próprio componente após a chamada,
   * portanto não é necessário (nem deve) incluí-lo aqui.
   * Pode lançar erro (throw) para rejeitar a linha durante a importação
   * (ex.: validação assíncrona, lookups).
   */
  buildPayload: (row: Record<string, any>) => Promise<Record<string, any>> | Record<string, any>;
}

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const brDateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Converte para ISO (yyyy-MM-dd). Aceita ISO ou dd/MM/yyyy. Retorna null se inválida. */
export function normalizeDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isoDateRegex.test(trimmed)) return trimmed;
  const match = trimmed.match(brDateRegex);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  return line.split(',').map((v) => v.trim());
}

const ImportCsvDialog: React.FC<ImportCsvDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  texts,
  columns,
  tableName,
  templateSample,
  templateFileName,
  previewColumns,
  buildPayload,
}) => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
  const [rows, setRows] = useState<ImportCsvRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const requiredColumns = columns.filter((c) => c.required);
  const optionalColumns = columns.filter((c) => !c.required);

  const downloadTemplate = () => {
    const header = columns.map((c) => `${c.key}${c.required ? '*' : ''}`);
    const template = [header, ...templateSample];
    const csvContent = template.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', templateFileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateRow = (raw: Record<string, string>, lineNumber: number): ImportCsvRow => {
    const errors: string[] = [];
    const data: Record<string, any> = {};

    for (const col of columns) {
      const rawValue = (raw[col.key] ?? '').trim();

      if (col.required && !rawValue) {
        errors.push(t(texts.errorRequiredField, { field: col.label }));
        data[col.key] = '';
        continue;
      }

      if (!rawValue) {
        data[col.key] = col.defaultValue ?? '';
        continue;
      }

      if (col.enumValues && !col.enumValues.includes(rawValue.toLowerCase())) {
        errors.push(t(texts.errorInvalidEnum, { field: col.label, values: col.enumValues.join(', ') }));
        data[col.key] = rawValue.toLowerCase();
        continue;
      }

      switch (col.type) {
        case 'date': {
          const iso = normalizeDateToIso(rawValue);
          if (!iso) {
            errors.push(t(texts.errorInvalidDate, { field: col.label }));
            data[col.key] = rawValue;
          } else {
            data[col.key] = iso;
          }
          break;
        }
        case 'number': {
          if (isNaN(Number(rawValue))) {
            errors.push(t(texts.errorInvalidNumber, { field: col.label }));
            data[col.key] = rawValue;
          } else {
            data[col.key] = Number(rawValue);
          }
          break;
        }
        case 'tags': {
          data[col.key] = rawValue
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
          break;
        }
        case 'boolean': {
          data[col.key] = ['true', '1', 'sim', 'yes'].includes(rawValue.toLowerCase());
          break;
        }
        default: {
          data[col.key] = col.enumValues ? rawValue.toLowerCase() : rawValue;
        }
      }
    }

    return { data, valid: errors.length === 0, errors, line: lineNumber };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map((line) => line.trim()).filter((line) => line);

        if (lines.length < 2) {
          toast.error(texts.errorEmptyFile);
          return;
        }

        const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace('*', ''));
        const parsed: ImportCsvRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          const raw: Record<string, string> = {};
          headers.forEach((header, index) => {
            raw[header] = values[index] || '';
          });
          parsed.push(validateRow(raw, i + 1));
        }

        setRows(parsed);
        setValidCount(parsed.filter((r) => r.valid).length);
        setErrorCount(parsed.filter((r) => !r.valid).length);
        setStep('preview');
      } catch (error) {
        toast.error(texts.errorParseFile);
      }
    };
    reader.readAsText(file);
  };

  const performImport = async () => {
    if (!profile?.empresa_id) {
      toast.error(texts.errorNoEmpresa);
      return;
    }

    setStep('importing');
    setImportProgress(0);

    const validRows = rows.filter((r) => r.valid);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const payload = await buildPayload(row.data);
        const { error } = await supabase
          .from(tableName as any)
          .insert({ ...payload, empresa_id: profile.empresa_id });

        if (error) {
          console.error(`Erro ao importar linha ${row.line} (${tableName}):`, error);
          failCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`Erro ao processar linha ${row.line} (${tableName}):`, error);
        failCount++;
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setStep('success');

    if (successCount > 0) {
      toast.success(t(texts.toastImportSuccess, { count: successCount }));
      onSuccess();
    }
    if (failCount > 0) {
      toast.error(t(texts.toastImportError, { count: failCount }));
    }
  };

  const resetImport = () => {
    setStep('upload');
    setRows([]);
    setImportProgress(0);
    setValidCount(0);
    setErrorCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetImport(); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {texts.title}
          </DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{texts.alertTitle}</strong> {texts.alertDescription}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{texts.step1Title}</CardTitle>
                    <CardDescription>{texts.step1Description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={downloadTemplate} variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      {texts.downloadTemplateButton}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{texts.step2Title}</CardTitle>
                    <CardDescription>{texts.step2Description}</CardDescription>
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
                      <Upload className="h-4 w-4 mr-2" />
                      {texts.selectFileButton}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{texts.fieldsAvailableTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <strong>{texts.fieldsRequired}</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {requiredColumns.map((c) => (
                          <li key={c.key}>{c.label}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>{texts.fieldsOptional}</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {optionalColumns.map((c) => (
                          <li key={c.key}>{c.label}</li>
                        ))}
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
                  <h3 className="text-lg font-semibold">{texts.previewTitle}</h3>
                  <p className="text-sm text-muted-foreground">{texts.previewDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{validCount} {texts.badgeValid}</Badge>
                  {errorCount > 0 && <Badge variant="destructive">{errorCount} {texts.badgeError}</Badge>}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{texts.columnLine}</TableHead>
                      <TableHead>{texts.columnStatus}</TableHead>
                      {previewColumns.map((pc) => (
                        <TableHead key={pc.key}>{pc.label}</TableHead>
                      ))}
                      <TableHead>{texts.columnErrors}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.line}</TableCell>
                        <TableCell>
                          {row.valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        {previewColumns.map((pc) => (
                          <TableCell key={pc.key}>
                            {pc.render ? pc.render(row.data[pc.key], row.data) : String(row.data[pc.key] ?? '')}
                          </TableCell>
                        ))}
                        <TableCell>
                          {row.errors.length > 0 && (
                            <ul className="text-xs text-red-600">
                              {row.errors.map((error, i) => (
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
                  {texts.backButton}
                </Button>
                <Button onClick={performImport} disabled={validCount === 0}>
                  {t(texts.importButton, { count: validCount })}
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-lg font-semibold">{texts.importingTitle}</h3>
                <p className="text-sm text-muted-foreground">{texts.importingDescription}</p>
              </div>
              <Progress value={importProgress} className="w-full" />
              <p className="text-sm">{t(texts.importingPercent, { percent: importProgress })}</p>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">{texts.successTitle}</h3>
                <p className="text-sm text-muted-foreground">{texts.successDescription}</p>
              </div>
              <Button onClick={() => onOpenChange(false)}>{texts.closeButton}</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportCsvDialog;
