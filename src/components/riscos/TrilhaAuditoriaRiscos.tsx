
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DialogShell } from '@/components/ui/dialog-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconAdd, IconEdit, IconDelete, IconView, IconCalendar, IconHistory, IconPerson } from '@/components/icons';
import { dateFnsLocale, datePattern } from '@/lib/date-utils';
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

const AUDIT_FIELDS = ["nome", "descricao", "status", "categoria_id", "matriz_id", "probabilidade_inicial", "impacto_inicial", "nivel_risco_inicial", "probabilidade_residual", "impacto_residual", "nivel_risco_residual", "responsavel", "causas", "consequencias", "controles_existentes", "aceito", "justificativa_aceite", "data_proxima_revisao", "status_aprovacao", "aprovador_id", "data_aprovacao"] as const;

export function TrilhaAuditoriaRiscos({ open, onOpenChange, riscoId, riscoNome }: TrilhaAuditoriaRiscosProps) {
  const { t } = useLanguage();
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
      case 'INSERT': return <IconAdd className="h-4 w-4 text-success" />;
      case 'UPDATE': return <IconEdit className="h-4 w-4 text-info" />;
      case 'DELETE': return <IconDelete className="h-4 w-4 text-destructive" />;
      default: return <IconView className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT': return <StatusBadge tone="success">Criado</StatusBadge>;
      case 'UPDATE': return <StatusBadge tone="info">Atualizado</StatusBadge>;
      case 'DELETE': return <StatusBadge tone="destructive">{t('fin.comum.excluido')}</StatusBadge>;
      default: return <StatusBadge tone="neutral" variant="outline">{action}</StatusBadge>;
    }
  };

  const translateField = (field: string) => (AUDIT_FIELDS as readonly string[]).includes(field) ? t(`fin.riscos.campos.${field}`) : field;

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
              <p className="text-xs font-medium text-destructive">{t('cardsKpi.sweep.riscos.anterior')}</p>
              <p className="text-sm text-destructive">{String(oldVal ?? 'N/A')}</p>
            </div>
            <div className="rounded-md border border-success/30 bg-success/10 p-2">
              <p className="text-xs font-medium text-success">{t('fin.comum.novo')}</p>
              <p className="text-sm text-success">{String(newVal ?? 'N/A')}</p>
            </div>
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconHistory}
      title={t('residuos.risco.trilhaAuditoria')}
      description={riscoNome}
      size="lg"
      hideFooter
    >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <AkurisPulse size={48} />
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <IconHistory className="h-12 w-12 mx-auto mb-4 opacity-50" strokeWidth={1.5} />{t('fin.riscos.trilha.vazio')}</div>
          ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            <CardTitle className="text-lg">
                              Risco {log.action === 'INSERT' ? 'Criado' : log.action === 'UPDATE' ? 'Atualizado' : t('fin.comum.excluido')}
                            </CardTitle>
                            {getActionBadge(log.action)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <IconPerson className="h-4 w-4" />
                              {log.profiles?.nome || 'Sistema'}
                            </div>
                            <div className="flex items-center gap-1">
                              <IconCalendar className="h-4 w-4" />
                              {format(new Date(log.created_at), `${datePattern()} HH:mm:ss`, { locale: dateFnsLocale() })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="resumo">
                        <TabsList>
                          <TabsTrigger value="resumo">{t('cardsKpi.sweep.riscos.resumo')}</TabsTrigger>
                          {log.action === 'UPDATE' && <TabsTrigger value="comparacao">{t('fin.comum.comparacao')}</TabsTrigger>}
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
          )}
    </DialogShell>
  );
}
