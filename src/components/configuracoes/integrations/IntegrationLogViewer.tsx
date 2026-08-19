import { useState, useEffect } from 'react';
import { IconFilter, IconSuccess, IconError, IconTime, IconRefresh } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { DialogShell } from '@/components/ui/dialog-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
;
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { formatDateOnly } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface WebhookLog {
  id: string;
  integracao_id: string;
  evento: string;
  payload: any;
  status_code: number;
  resposta: string;
  sucesso: boolean;
  created_at: string;
}

interface IntegrationLogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntegrationLogViewer({ open, onOpenChange }: IntegrationLogViewerProps) {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('7d');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!profile?.empresa_id) return;

      let query = supabase
        .from('integracoes_webhook_logs')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false })
        .limit(200);

      // Filtro de período
      if (filterPeriod !== 'all') {
        const now = new Date();
        let since: Date;
        switch (filterPeriod) {
          case '1d': since = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
          case '7d': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case '30d': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
          default: since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        query = query.gte('created_at', since.toISOString());
      }

      // Filtro de status
      if (filterStatus === 'success') {
        query = query.eq('sucesso', true);
      } else if (filterStatus === 'error') {
        query = query.eq('sucesso', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data || []).map(d => ({
        id: d.id,
        integracao_id: d.integracao_id,
        evento: d.evento,
        payload: d.payload,
        status_code: d.status_code,
        resposta: d.resposta,
        sucesso: d.sucesso,
        created_at: d.created_at
      })));
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open, filterStatus, filterPeriod]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${formatDateOnly(dateString)} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <IconSuccess className="h-4 w-4 text-success" />;
    }
    return <IconError className="h-4 w-4 text-destructive" />;
  };

  const getEventLabel = (evento: string) => {
    const key = `configIntegrations.logViewer.eventLabels.${evento}`;
    const translated = t(key);
    return translated === key ? evento : translated;
  };

  const successCount = logs.filter(l => l.sucesso).length;
  const errorCount = logs.filter(l => !l.sucesso).length;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconTime}
      title={t('configIntegrations.logViewer.title')}
      description={t('configIntegrations.logViewer.description')}
      size="lg"
      hideFooter
    >
        {/* Resumo + Filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 text-sm">
            <StatusBadge tone="success">
              ✓ {successCount} {t('configIntegrations.logViewer.sucesso')}
            </StatusBadge>
            <StatusBadge tone="destructive">
              ✗ {errorCount} {errorCount !== 1 ? t('configIntegrations.logViewer.falhas') : t('configIntegrations.logViewer.falha')}
            </StatusBadge>
          </div>
          <div className="flex items-center gap-2">
            <IconFilter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('configIntegrations.logViewer.statusAll')}</SelectItem>
                <SelectItem value="success">{t('configIntegrations.logViewer.statusSuccess')}</SelectItem>
                <SelectItem value="error">{t('configIntegrations.logViewer.statusError')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">{t('configIntegrations.logViewer.periodToday')}</SelectItem>
                <SelectItem value="7d">{t('configIntegrations.logViewer.period7d')}</SelectItem>
                <SelectItem value="30d">{t('configIntegrations.logViewer.period30d')}</SelectItem>
                <SelectItem value="all">{t('configIntegrations.logViewer.periodAll')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="h-8">
              {loading ? <AkurisPulse size={12} className="mr-1" /> : <IconRefresh className="h-3 w-3 mr-1" />}
              {t('configIntegrations.logViewer.btnAtualizar')}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <IconTime className="h-12 w-12 mb-4 opacity-50" />
              <p>{t('configIntegrations.logViewer.emptyTitle')}</p>
              <p className="text-sm">{t('configIntegrations.logViewer.emptyDesc')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.sucesso)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{getEventLabel(log.evento)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={log.sucesso ? 'success' : 'destructive'}>
                        HTTP {log.status_code || 'N/A'}
                      </StatusBadge>
                    </div>
                  </div>

                  {log.payload && (
                    <div className="mt-3 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                      <strong>{t('configIntegrations.logViewer.payloadLabel')}</strong> {typeof log.payload === 'object' ? (log.payload.titulo || JSON.stringify(log.payload).substring(0, 100)) : String(log.payload).substring(0, 100)}...
                    </div>
                  )}

                  {!log.sucesso && log.resposta && (
                    <div className="mt-2 p-2 bg-destructive/10 dark:bg-destructive/10 rounded text-xs text-destructive dark:text-destructive">
                      <strong>{t('configIntegrations.logViewer.erroLabel')}</strong> {typeof log.resposta === 'string' ? log.resposta.substring(0, 200) : JSON.stringify(log.resposta).substring(0, 200)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
    </DialogShell>
  );
}
