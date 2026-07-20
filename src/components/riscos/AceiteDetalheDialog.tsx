import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Separator } from '@/components/ui/separator';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone } from '@/lib/status-tone';
import { CheckCircle, User, Calendar, FileText, Clock, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risco: {
    id: string;
    nome: string;
    nivel_risco_inicial: string;
    nivel_risco_residual?: string;
    justificativa_aceite?: string;
    data_aceite?: string;
    aprovador_aceite?: string;
    data_proxima_revisao?: string;
    responsavel?: string;
    aprovador_nome?: string;
    responsavel_nome?: string;
  };
}

export function AceiteDetalheDialog({ open, onOpenChange, risco }: Props) {
  const { profile } = useAuth();

  // Buscar histórico de auditoria do aceite
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['risco-aceite-audit', risco.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'riscos')
        .eq('record_id', risco.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Filtrar apenas logs que envolvem campo 'aceito'
      return (data || []).filter(log => {
        const fields = log.changed_fields as string[] | null;
        return fields?.includes('aceito') || 
               fields?.includes('justificativa_aceite') || 
               fields?.includes('data_aceite') || 
               fields?.includes('aprovador_aceite') ||
               fields?.includes('data_proxima_revisao');
      });
    },
    enabled: open && !!risco.id,
  });

  // Buscar anexos de aceite
  const { data: anexos = [] } = useQuery({
    queryKey: ['risco-aceite-anexos', risco.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos_anexos')
        .select('*')
        .eq('risco_id', risco.id)
        .eq('tipo_anexo', 'aceite')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!risco.id,
  });

  const getRevisaoStatus = () => {
    if (!risco.data_proxima_revisao) return null;
    const dias = differenceInDays(new Date(risco.data_proxima_revisao), new Date());
    if (dias < 0) return { label: 'Vencida', tone: 'destructive' as const, dias: Math.abs(dias) };
    if (dias <= 7) return { label: `${dias} dias restantes`, tone: 'warning' as const, dias };
    return { label: `${dias} dias restantes`, tone: 'success' as const, dias };
  };

  const revisaoStatus = getRevisaoStatus();

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={CheckCircle}
      title="Detalhes do Aceite de Risco"
      description="Informações completas do aceite formal, anexos e histórico de auditoria."
      size="md"
      hideFooter
    >
        <div className="space-y-6">
          {/* Info do Risco */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">{risco.nome}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Nível Inicial:</span>
              <StatusBadge {...resolveNivelRiscoTone(risco.nivel_risco_inicial)}>{formatStatus(risco.nivel_risco_inicial)}</StatusBadge>
              {risco.nivel_risco_residual && (
                <>
                  <span className="text-sm text-muted-foreground ml-2">Residual:</span>
                  <StatusBadge {...resolveNivelRiscoTone(risco.nivel_risco_residual)}>{formatStatus(risco.nivel_risco_residual)}</StatusBadge>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Dados do Aceite */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Data do Aceite
              </div>
              <p className="text-sm font-medium">
                {risco.data_aceite ? formatDateOnly(risco.data_aceite) : 'Não registrada'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Aprovador
              </div>
              <p className="text-sm font-medium">
                {risco.aprovador_nome || 'Não registrado'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Responsável
              </div>
              <p className="text-sm font-medium">
                {risco.responsavel_nome || 'Não designado'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Próxima Revisão
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {risco.data_proxima_revisao ? formatDateOnly(risco.data_proxima_revisao) : 'Não agendada'}
                </p>
                {revisaoStatus && (
                  <StatusBadge size="sm" tone={revisaoStatus.tone}>{revisaoStatus.label}</StatusBadge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Justificativa */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Justificativa do Aceite
            </h4>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              {risco.justificativa_aceite || 'Nenhuma justificativa registrada.'}
            </p>
          </div>

          {/* Anexos */}
          {anexos.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Anexos do Aceite ({anexos.length})</h4>
                <div className="space-y-1">
                  {anexos.map(anexo => (
                    <a
                      key={anexo.id}
                      href={anexo.url_arquivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline p-2 rounded-md hover:bg-muted/50"
                    >
                      <FileText className="h-4 w-4" />
                      {anexo.nome_arquivo}
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Timeline de Auditoria */}
          {auditLogs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Histórico de Alterações
                </h4>
                <div className="space-y-3">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground">
                          {formatDateOnly(log.created_at || '')} — {log.action}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Campos: {(log.changed_fields as string[] || []).join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
    </DialogShell>
  );
}
