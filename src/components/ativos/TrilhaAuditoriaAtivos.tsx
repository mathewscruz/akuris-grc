import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { formatarDiaParaDB } from '@/lib/date-utils';
interface TrilhaAuditoriaProps {
  ativoId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  changed_fields?: string[];
  created_at: string;
  profiles?: {
    nome: string;
    email: string;
  } | null;
}

const TrilhaAuditoriaAtivos: React.FC<TrilhaAuditoriaProps> = ({ ativoId, open, onOpenChange }) => {
  const { t } = useLanguage();
  const [filtroAcao, setFiltroAcao] = useState<string>('');

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['audit-logs-ativos', ativoId, filtroAcao],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (nome, email)
        `)
        .eq('table_name', 'ativos')
        .order('created_at', { ascending: false });

      if (ativoId) {
        query = query.eq('record_id', ativoId);
      }

      if (filtroAcao && filtroAcao !== 'ALL') {
        query = query.eq('action', filtroAcao);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        profiles: item.profiles && typeof item.profiles === 'object' && !Array.isArray(item.profiles) && 'nome' in item.profiles 
          ? item.profiles as { nome: string; email: string }
          : null
      })) as AuditLog[];
    },
    enabled: open,
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <Badge variant="default">{t('contratosAtivos.trilhaAuditoriaAtivos.actionInsert')}</Badge>;
      case 'UPDATE':
        return <Badge variant="secondary">{t('contratosAtivos.trilhaAuditoriaAtivos.actionUpdate')}</Badge>;
      case 'DELETE':
        return <Badge variant="destructive">{t('contratosAtivos.trilhaAuditoriaAtivos.actionDelete')}</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatChangedFields = (fields?: string[]) => {
    if (!fields || fields.length === 0) return '-';
    return fields.join(', ');
  };

  const formatJsonData = (data: any) => {
    if (!data) return 'N/A';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return t('contratosAtivos.trilhaAuditoriaAtivos.invalidData');
    }
  };

  const getFieldDisplayName = (fieldName: string) => {
    const fieldMap: { [key: string]: string } = {
      nome: t('contratosAtivos.trilhaAuditoriaAtivos.fieldNome'),
      tipo: t('contratosAtivos.trilhaAuditoriaAtivos.fieldTipo'),
      descricao: t('contratosAtivos.trilhaAuditoriaAtivos.fieldDescricao'),
      proprietario: t('contratosAtivos.trilhaAuditoriaAtivos.fieldProprietario'),
      localizacao: t('contratosAtivos.trilhaAuditoriaAtivos.fieldLocalizacao'),
      valor_negocio: t('contratosAtivos.trilhaAuditoriaAtivos.fieldValorNegocio'),
      criticidade: t('contratosAtivos.trilhaAuditoriaAtivos.fieldCriticidade'),
      status: t('contratosAtivos.trilhaAuditoriaAtivos.fieldStatus'),
      data_aquisicao: t('contratosAtivos.trilhaAuditoriaAtivos.fieldDataAquisicao'),
      fornecedor: t('contratosAtivos.trilhaAuditoriaAtivos.fieldFornecedor'),
      versao: t('contratosAtivos.trilhaAuditoriaAtivos.fieldVersao'),
      tags: t('contratosAtivos.trilhaAuditoriaAtivos.fieldTags'),
      imei: t('contratosAtivos.trilhaAuditoriaAtivos.fieldImei'),
      cliente: t('contratosAtivos.trilhaAuditoriaAtivos.fieldCliente'),
      quantidade: t('contratosAtivos.trilhaAuditoriaAtivos.fieldQuantidade'),
    };
    return fieldMap[fieldName] || fieldName;
  };

  const exportLogs = () => {
    const csvContent = [
      [t('contratosAtivos.trilhaAuditoriaAtivos.csvHeaderDate'), t('contratosAtivos.trilhaAuditoriaAtivos.csvHeaderAction'), t('contratosAtivos.trilhaAuditoriaAtivos.csvHeaderUser'), t('contratosAtivos.trilhaAuditoriaAtivos.csvHeaderChangedFields'), t('contratosAtivos.trilhaAuditoriaAtivos.csvHeaderIp')].join(','),
      ...auditLogs.map(log => [
        new Date(log.created_at).toLocaleString('pt-BR'),
        log.action,
        log.profiles?.nome || t('contratosAtivos.trilhaAuditoriaAtivos.systemFallback'),
        formatChangedFields(log.changed_fields),
        'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria-ativos-${formatarDiaParaDB(new Date())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('contratosAtivos.trilhaAuditoriaAtivos.title')}</DialogTitle>
          <DialogDescription>
            {t('contratosAtivos.trilhaAuditoriaAtivos.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="filtro-acao">{t('contratosAtivos.trilhaAuditoriaAtivos.filterLabel')}</Label>
              <Select value={filtroAcao} onValueChange={setFiltroAcao}>
                <SelectTrigger>
                  <SelectValue placeholder={t('contratosAtivos.trilhaAuditoriaAtivos.filterPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('contratosAtivos.trilhaAuditoriaAtivos.filterAll')}</SelectItem>
                  <SelectItem value="INSERT">{t('contratosAtivos.trilhaAuditoriaAtivos.actionInsert')}</SelectItem>
                  <SelectItem value="UPDATE">{t('contratosAtivos.trilhaAuditoriaAtivos.actionUpdate')}</SelectItem>
                  <SelectItem value="DELETE">{t('contratosAtivos.trilhaAuditoriaAtivos.actionDelete')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={exportLogs} variant="outline">
                {t('contratosAtivos.trilhaAuditoriaAtivos.exportButton')}
              </Button>
            </div>
          </div>

          {/* Lista de Logs */}
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <AkurisPulse size={32} />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('contratosAtivos.trilhaAuditoriaAtivos.emptyState')}
              </div>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <Card key={log.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getActionBadge(log.action)}
                          <CardTitle className="text-base">
                            {log.action === 'INSERT' ? t('contratosAtivos.trilhaAuditoriaAtivos.assetCreated') :
                             log.action === 'UPDATE' ? t('contratosAtivos.trilhaAuditoriaAtivos.assetUpdated') :
                             log.action === 'DELETE' ? t('contratosAtivos.trilhaAuditoriaAtivos.assetDeleted') : log.action}
                          </CardTitle>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <CardDescription>
                        {t('contratosAtivos.trilhaAuditoriaAtivos.byLabel', { name: log.profiles?.nome || t('contratosAtivos.trilhaAuditoriaAtivos.systemFallback'), email: log.profiles?.email || 'N/A' })}
                        {log.changed_fields && log.changed_fields.length > 0 && (
                          <span className="ml-2">
                            {t('contratosAtivos.trilhaAuditoriaAtivos.changedFieldsLabel', { fields: log.changed_fields.map(getFieldDisplayName).join(', ') })}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>

                    {(log.old_values || log.new_values) && (
                      <CardContent>
                        <Tabs defaultValue="resumo" className="w-full">
                          <TabsList>
                            <TabsTrigger value="resumo">{t('contratosAtivos.trilhaAuditoriaAtivos.tabSummary')}</TabsTrigger>
                            {log.old_values && <TabsTrigger value="anterior">{t('contratosAtivos.trilhaAuditoriaAtivos.tabOldValues')}</TabsTrigger>}
                            {log.new_values && <TabsTrigger value="novos">{t('contratosAtivos.trilhaAuditoriaAtivos.tabNewValues')}</TabsTrigger>}
                          </TabsList>

                          <TabsContent value="resumo" className="space-y-2">
                            <div className="text-sm">
                              <strong>{t('contratosAtivos.trilhaAuditoriaAtivos.summaryAction')}</strong> {log.action === 'INSERT' ? t('contratosAtivos.trilhaAuditoriaAtivos.summaryActionInsert') :
                                                    log.action === 'UPDATE' ? t('contratosAtivos.trilhaAuditoriaAtivos.summaryActionUpdate') :
                                                    log.action === 'DELETE' ? t('contratosAtivos.trilhaAuditoriaAtivos.summaryActionDelete') : log.action}
                            </div>
                            {log.changed_fields && log.changed_fields.length > 0 && (
                              <div className="text-sm">
                                <strong>{t('contratosAtivos.trilhaAuditoriaAtivos.summaryModifiedFields')}</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {log.changed_fields.map((field) => (
                                    <Badge key={field} variant="outline" className="text-xs">
                                      {getFieldDisplayName(field)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          {log.old_values && (
                            <TabsContent value="anterior">
                              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                                {formatJsonData(log.old_values)}
                              </pre>
                            </TabsContent>
                          )}

                          {log.new_values && (
                            <TabsContent value="novos">
                              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                                {formatJsonData(log.new_values)}
                              </pre>
                            </TabsContent>
                          )}
                        </Tabs>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrilhaAuditoriaAtivos;