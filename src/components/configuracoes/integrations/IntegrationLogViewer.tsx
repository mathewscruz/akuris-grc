import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { formatDateOnly } from '@/lib/date-utils';

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
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getEventLabel = (evento: string) => {
    const labels: Record<string, string> = {
      incidente_criado: 'Incidente Criado',
      incidente_atualizado: 'Incidente Atualizado',
      incidente_resolvido: 'Incidente Resolvido',
      incidente_critico: 'Incidente Crítico',
      risco_identificado: 'Risco Identificado',
      risco_atualizado: 'Risco Atualizado',
      risco_nivel_alterado: 'Nível de Risco Alterado',
      documento_criado: 'Documento Criado',
      documento_aprovado: 'Documento Aprovado',
      documento_rejeitado: 'Documento Rejeitado',
      controle_criado: 'Controle Criado',
      controle_atualizado: 'Controle Atualizado',
      controle_vencendo: 'Controle Vencendo',
      auditoria_criada: 'Auditoria Criada',
      auditoria_item_atribuido: 'Item de Auditoria Atribuído',
      denuncia_recebida: 'Denúncia Recebida',
      sync_devices: 'Sincronização Dispositivos'
    };
    return labels[evento] || evento;
  };

  const successCount = logs.filter(l => l.sucesso).length;
  const errorCount = logs.filter(l => !l.sucesso).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Logs de Integrações
          </DialogTitle>
          <DialogDescription>
            Histórico de notificações enviadas para integrações externas
          </DialogDescription>
        </DialogHeader>

        {/* Resumo + Filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
              ✓ {successCount} sucesso
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
              ✗ {errorCount} falha{errorCount !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Falhas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Hoje</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="h-8">
              {loading ? <AkurisPulse size={12} className="mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Atualizar
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum log encontrado</p>
              <p className="text-sm">Os logs aparecerão aqui quando eventos forem disparados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
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
                      <Badge variant={log.sucesso ? 'default' : 'destructive'}>
                        HTTP {log.status_code || 'N/A'}
                      </Badge>
                    </div>
                  </div>

                  {log.payload && (
                    <div className="mt-3 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                      <strong>Payload:</strong> {typeof log.payload === 'object' ? (log.payload.titulo || JSON.stringify(log.payload).substring(0, 100)) : String(log.payload).substring(0, 100)}...
                    </div>
                  )}

                  {!log.sucesso && log.resposta && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-600 dark:text-red-400">
                      <strong>Erro:</strong> {typeof log.resposta === 'string' ? log.resposta.substring(0, 200) : JSON.stringify(log.resposta).substring(0, 200)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
