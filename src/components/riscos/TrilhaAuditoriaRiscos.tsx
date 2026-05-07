
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User, Calendar, Edit, Plus, Trash, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface TrilhaAuditoriaRiscosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riscoId: string;
  riscoNome: string;
}

interface AuditLog {
  id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  changed_fields?: string[];
  created_at: string;
  user_id?: string;
  profiles?: { nome: string; email: string } | null;
}

const fieldTranslations: Record<string, string> = {
  'nome': 'Nome',
  'descricao': 'Descrição',
  'status': 'Status',
  'categoria_id': 'Categoria',
  'matriz_id': 'Matriz',
  'probabilidade_inicial': 'Probabilidade Inicial',
  'impacto_inicial': 'Impacto Inicial',
  'nivel_risco_inicial': 'Nível Risco Inicial',
  'probabilidade_residual': 'Probabilidade Residual',
  'impacto_residual': 'Impacto Residual',
  'nivel_risco_residual': 'Nível Risco Residual',
  'responsavel': 'Responsável',
  'causas': 'Causas',
  'consequencias': 'Consequências',
  'controles_existentes': 'Controles Existentes',
  'aceito': 'Aceito',
  'justificativa_aceite': 'Justificativa Aceite',
  'data_proxima_revisao': 'Próxima Revisão',
  'status_aprovacao': 'Status Aprovação',
  'aprovador_id': 'Aprovador',
  'data_aprovacao': 'Data Aprovação',
};

export function TrilhaAuditoriaRiscos({ open, onOpenChange, riscoId, riscoNome }: TrilhaAuditoriaRiscosProps) {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['risco-audit-logs', riscoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, old_values, new_values, changed_fields, created_at, user_id, profiles(nome, email)')
        .eq('table_name', 'riscos')
        .eq('record_id', riscoId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        profiles: Array.isArray(item.profiles) && item.profiles.length > 0 ? item.profiles[0] : null
      })) as AuditLog[];
    },
    enabled: open && !!riscoId,
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return <Plus className="h-4 w-4 text-green-600" />;
      case 'UPDATE': return <Edit className="h-4 w-4 text-blue-600" />;
      case 'DELETE': return <Trash className="h-4 w-4 text-red-600" />;
      default: return <Eye className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT': return <StatusBadge size="sm" tone="success">Criado</StatusBadge>;
      case 'UPDATE': return <StatusBadge size="sm" tone="info">Atualizado</StatusBadge>;
      case 'DELETE': return <StatusBadge size="sm" tone="destructive">Excluído</StatusBadge>;
      default: return <StatusBadge size="sm" tone="neutral" variant="outline">{action}</StatusBadge>;
    }
  };

  const translateField = (field: string) => fieldTranslations[field] || field;

  const renderValueComparison = (log: AuditLog) => {
    if (!log.old_values || !log.new_values || !log.changed_fields) return null;

    return log.changed_fields.map(field => {
      const oldVal = log.old_values[field];
      const newVal = log.new_values[field];
      if (oldVal === newVal) return null;

      return (
        <div key={field} className="border rounded p-3">
          <h5 className="font-medium mb-2">{translateField(field)}</h5>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2">
              <p className="text-xs font-medium text-destructive">Anterior</p>
              <p className="text-sm text-destructive">{String(oldVal ?? 'N/A')}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Novo</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{String(newVal ?? 'N/A')}</p>
            </div>
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-4xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Trilha de auditoria
              </span>
              <span className="text-base font-semibold leading-tight">{riscoNome}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="pl-[48px]">
            Registro detalhado de todas as alterações realizadas neste risco.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <AkurisPulse size={48} />
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Nenhum histórico de alterações encontrado.
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
                              Risco {log.action === 'INSERT' ? 'Criado' : log.action === 'UPDATE' ? 'Atualizado' : 'Excluído'}
                            </CardTitle>
                            {getActionBadge(log.action)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {log.profiles?.nome || 'Sistema'}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="resumo">
                        <TabsList>
                          <TabsTrigger value="resumo">Resumo</TabsTrigger>
                          {log.action === 'UPDATE' && <TabsTrigger value="comparacao">Comparação</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="resumo" className="space-y-3">
                          <div className="text-sm">
                            <strong>Campos Alterados:</strong>
                            <p className="text-muted-foreground">
                              {log.changed_fields?.map(translateField).join(', ') || 'N/A'}
                            </p>
                          </div>
                        </TabsContent>
                        {log.action === 'UPDATE' && (
                          <TabsContent value="comparacao">
                            <div className="space-y-4">{renderValueComparison(log)}</div>
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
