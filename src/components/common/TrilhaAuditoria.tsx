
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/date-utils';
import { IconAdd, IconEdit, IconDelete, IconView, IconCalendar, IconHistory, IconPerson } from '@/components/icons';
/**
 * Trilha de auditoria de um registro, lida de `audit_logs`.
 *
 * Nasceu presa a Documentos (`TrilhaAuditoriaDocumentos`) — numa época em que
 * nem Documentos tinha gatilho de auditoria, portanto abria vazia para sempre.
 * Agora que `documentos` e `contratos` escrevem em `audit_logs`, o visor é o
 * mesmo para qualquer tabela: muda o `tabela` e o registro.
 */
interface TrilhaAuditoriaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registroId: string;
  registroNome: string;
  /** Nome da tabela em `audit_logs.table_name` (ex.: 'documentos', 'contratos'). */
  tabela: string;
}

interface AuditLog {
  id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  changed_fields?: string[];
  created_at: string;
  user_id?: string;
  profiles?: {
    nome: string;
    email: string;
  } | null;
}

export function TrilhaAuditoria({
  open,
  onOpenChange,
  registroId,
  registroNome,
  tabela,
}: TrilhaAuditoriaProps) {
  const { t } = useLanguage();
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', tabela, registroId],
    queryFn: async () => {
      // O nome do autor vem numa segunda consulta, de propósito.
      //
      // A versão anterior pedia o embed `profiles(nome, email)` — e
      // `audit_logs.user_id` só tem FK para `auth.users`, não para `profiles`.
      // O PostgREST devolvia **400 em toda chamada**, o erro era engolido e a
      // tela dizia "Nenhum histórico de alterações encontrado" com o histórico
      // lá, gravado. Dois defeitos com o mesmo sintoma: ninguém escrevia a
      // trilha (faltava o gatilho) e ninguém conseguia lê-la.
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, old_values, new_values, changed_fields, created_at, user_id')
        .eq('table_name', tabela)
        .eq('record_id', registroId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const autores = [...new Set((data || []).map(l => l.user_id).filter(Boolean))] as string[];
      const porAutor = new Map<string, { nome: string; email: string }>();
      if (autores.length > 0) {
        const { data: perfis } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .in('user_id', autores);
        (perfis || []).forEach(p => {
          if (p.user_id) porAutor.set(p.user_id, { nome: p.nome || p.email || '', email: p.email || '' });
        });
      }

      const mappedData: AuditLog[] = (data || []).map(item => ({
        id: item.id,
        action: item.action,
        old_values: item.old_values,
        new_values: item.new_values,
        changed_fields: item.changed_fields,
        created_at: item.created_at,
        user_id: item.user_id ?? undefined,
        profiles: item.user_id ? porAutor.get(item.user_id) ?? null : null,
      }));

      return mappedData;
    },
    enabled: open && !!registroId,
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <IconAdd className="h-4 w-4 text-success" />;
      case 'UPDATE':
        return <IconEdit className="h-4 w-4 text-info" />;
      case 'DELETE':
        return <IconDelete className="h-4 w-4 text-destructive" />;
      default:
        return <IconView className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <StatusBadge tone="success">{t('documentosExtras.auditoria.criado')}</StatusBadge>;
      case 'UPDATE':
        return <StatusBadge tone="info">{t('documentosExtras.auditoria.atualizado')}</StatusBadge>;
      case 'DELETE':
        return <StatusBadge tone="destructive">{t('documentosExtras.auditoria.excluido')}</StatusBadge>;
      default:
        return <StatusBadge tone="neutral" variant="outline">{action}</StatusBadge>;
    }
  };

  /**
   * Rótulo humano de uma coluna alterada, por tabela.
   *
   * Este mapa cobria só campos de documento — herança de quando o componente
   * era `TrilhaAuditoriaDocumentos`. Ao generalizá-lo para contratos, um
   * UPDATE passava a listar "data_fim, valor, gestor_contrato" cru na tela,
   * porque o gatilho grava `changed_fields` com o nome da coluna e aqui não
   * havia entrada para nenhum deles.
   */
  const rotuloDoCampo = (field: string): string => {
    const comuns: Record<string, string> = {
      nome: t('documentosExtras.auditoria.campoNome'),
      descricao: t('documentosExtras.auditoria.campoDescricao'),
      tipo: t('documentosExtras.auditoria.campoTipo'),
      status: t('documentosExtras.auditoria.campoStatus'),
    };
    const porTabela: Record<string, Record<string, string>> = {
      documentos: {
        categoria: t('documentosExtras.auditoria.campoCategoria'),
        categoria_id: t('documentosExtras.auditoria.campoCategoria'),
        confidencial: t('documentosExtras.auditoria.campoConfidencial'),
        classificacao: t('documentosExtras.auditoria.campoConfidencial'),
        data_vencimento: t('documentosExtras.auditoria.campoDataVencimento'),
        tags: t('documentosExtras.auditoria.campoTags'),
        arquivo_url: t('documentosExtras.auditoria.campoArquivoUrl'),
        aprovado_por: t('documentosExtras.auditoria.campoAprovadoPor'),
        data_aprovacao: t('documentosExtras.auditoria.campoDataAprovacao'),
        responsavel_id: t('documentos.lista.responsavel'),
        versao: t('documentos.lista.versao'),
      },
      contratos: {
        numero_contrato: t('fin.comum.numero'),
        fornecedor_id: t('fin.comum.fornecedor'),
        valor: t('fin.comum.valor'),
        moeda: t('trilhaCampos.moeda'),
        data_inicio: t('fin.comum.dataInicio'),
        data_fim: t('detalheRegisto.dataFim'),
        data_assinatura: t('trilhaCampos.dataAssinatura'),
        gestor_contrato: t('detalheRegisto.responsavel'),
        area_solicitante: t('trilhaCampos.areaSolicitante'),
        objeto: t('fin.contratos.objeto'),
        observacoes: t('detalheRegisto.observacoes'),
        renovacao_automatica: t('fin.contratos.renovacaoAutomatica'),
        prazo_renovacao: t('trilhaCampos.prazoRenovacao'),
        sla_principal: t('trilhaCampos.sla'),
        confidencial: t('documentosExtras.auditoria.campoConfidencial'),
      },
      contrato_aditivos: {
        numero_aditivo: t('trilhaCampos.numeroAditivo'),
        motivo: t('trilhaCampos.motivo'),
        valor_anterior: t('trilhaCampos.valorAnterior'),
        valor_novo: t('trilhaCampos.valorNovo'),
        data_fim_nova: t('trilhaCampos.novaDataFim'),
        data_assinatura: t('trilhaCampos.dataAssinatura'),
        justificativa: t('trilhaCampos.justificativa'),
      },
    };
    return porTabela[tabela]?.[field] ?? comuns[field] ?? field;
  };

  const formatChangedFields = (fields?: string[]) => {
    if (!fields || fields.length === 0) return t('documentosExtras.auditoria.naoDisponivel');
    return fields.map(rotuloDoCampo).join(', ');
  };

  const formatJsonData = (data: any) => {
    if (!data) return t('documentosExtras.auditoria.naoDisponivel');
    
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const getValueDifference = (oldVal: any, newVal: any) => {
    if (oldVal === newVal) return null;
    
    return {
      old: oldVal || t('documentosExtras.auditoria.naoDisponivel'),
      new: newVal || t('documentosExtras.auditoria.naoDisponivel')
    };
  };

  const renderValueComparison = (log: AuditLog) => {
    if (!log.old_values || !log.new_values) return null;

    const changes = log.changed_fields?.map(field => {
      const diff = getValueDifference(log.old_values[field], log.new_values[field]);
      if (!diff) return null;

      return (
        <div key={field} className="border rounded p-3">
          <h5 className="font-medium mb-2">{rotuloDoCampo(field)}</h5>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-destructive/10 p-2 rounded">
              <p className="text-xs font-medium text-destructive">{t('documentosExtras.auditoria.anterior')}</p>
              <p className="text-sm text-destructive">{String(diff.old)}</p>
            </div>
            <div className="bg-success/10 p-2 rounded">
              <p className="text-xs font-medium text-success">{t('documentosExtras.auditoria.novo')}</p>
              <p className="text-sm text-success">{String(diff.new)}</p>
            </div>
          </div>
        </div>
      );
    }).filter(Boolean);

    return changes;
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center h-64">
            <AkurisPulse size={48} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconHistory className="h-5 w-5" />
            {t('documentosExtras.auditoria.titulo').replace('{nome}', registroNome)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!auditLogs || auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <IconHistory className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {t('documentosExtras.auditoria.nenhumHistorico')}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            <CardTitle className="text-lg">
                              {log.action === 'INSERT' ? t('documentosExtras.auditoria.criado') :
                                log.action === 'UPDATE' ? t('documentosExtras.auditoria.atualizado') :
                                t('documentosExtras.auditoria.excluido')}
                            </CardTitle>
                            {getActionBadge(log.action)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <IconPerson className="h-4 w-4" />
                              {log.profiles?.nome || t('documentosExtras.historico.sistema')}
                            </div>
                            <div className="flex items-center gap-1">
                              <IconCalendar className="h-4 w-4" />
                              {formatDateTime(log.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <Tabs defaultValue="resumo">
                        <TabsList>
                          <TabsTrigger value="resumo">{t('documentosExtras.auditoria.resumo')}</TabsTrigger>
                          {log.action === 'UPDATE' && (
                            <TabsTrigger value="comparacao">{t('documentosExtras.auditoria.comparacao')}</TabsTrigger>
                          )}
                          {log.old_values && (
                            <TabsTrigger value="antes">{t('documentosExtras.auditoria.dadosAnteriores')}</TabsTrigger>
                          )}
                          {log.new_values && (
                            <TabsTrigger value="depois">{t('documentosExtras.auditoria.dadosNovos')}</TabsTrigger>
                          )}
                        </TabsList>

                        <TabsContent value="resumo" className="space-y-3">
                          <div className="grid grid-cols-1 gap-4 text-sm">
                            <div>
                              <strong>{t('documentosExtras.auditoria.camposAlterados')}</strong>
                              <p className="text-muted-foreground">
                                {formatChangedFields(log.changed_fields)}
                              </p>
                            </div>
                            {log.profiles && (
                              <div>
                                <strong>{t('documentosExtras.auditoria.usuario')}</strong>
                                <p className="text-muted-foreground">
                                  {log.profiles.nome} ({log.profiles.email})
                                </p>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        {log.action === 'UPDATE' && (
                          <TabsContent value="comparacao">
                            <div className="space-y-4">
                              {renderValueComparison(log)}
                            </div>
                          </TabsContent>
                        )}

                        {log.old_values && (
                          <TabsContent value="antes">
                            <div className="bg-destructive/10 p-4 rounded-md">
                              <h4 className="font-medium text-destructive mb-2">{t('documentosExtras.auditoria.dadosAnteriores')}</h4>
                              <pre className="text-xs text-destructive overflow-x-auto whitespace-pre-wrap">
                                {formatJsonData(log.old_values)}
                              </pre>
                            </div>
                          </TabsContent>
                        )}

                        {log.new_values && (
                          <TabsContent value="depois">
                            <div className="bg-success/10 p-4 rounded-md">
                              <h4 className="font-medium text-success mb-2">{t('documentosExtras.auditoria.dadosNovos')}</h4>
                              <pre className="text-xs text-success overflow-x-auto whitespace-pre-wrap">
                                {formatJsonData(log.new_values)}
                              </pre>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
