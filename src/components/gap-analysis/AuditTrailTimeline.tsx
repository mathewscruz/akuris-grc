import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconHistory } from '@/components/icons';
interface AuditEntry {
  id: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  user_id: string | null;
  created_at: string;
  user_nome?: string;
}

interface AuditTrailTimelineProps {
  requirementId: string;
  frameworkId: string;
}

const statusLabelKeys: Record<string, string> = {
  conforme: 'conforme',
  parcial: 'parcial',
  nao_conforme: 'naoConforme',
  nao_aplicavel: 'na',
  nao_avaliado: 'naoAvaliado',
  pendente: 'pendente',
};

export const AuditTrailTimeline: React.FC<AuditTrailTimelineProps> = ({ requirementId, frameworkId }) => {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    loadAuditLog();
  }, [requirementId, empresaId]);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gap_analysis_audit_log')
        .select('*')
        .eq('requirement_id', requirementId)
        .eq('framework_id', frameworkId)
        .eq('empresa_id', empresaId!)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Load user names
      const userIds = [...new Set((data || []).map(e => e.user_id).filter(Boolean))] as string[];
      const userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nome')
          .in('user_id', userIds);
        profiles?.forEach(p => userMap.set(p.user_id, p.nome));
      }

      setEntries((data || []).map(e => ({
        ...e,
        user_nome: e.user_id ? userMap.get(e.user_id) || t('gapAnalysis.audit.user') : t('gapAnalysis.audit.system'),
      })));
    } catch (error) {
      logger.error('Erro ao carregar histórico:', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">—</Badge>;
    const variants: Record<string, 'success' | 'warning' | 'destructive' | 'outline' | 'secondary'> = {
      conforme: 'success', parcial: 'warning', nao_conforme: 'destructive', nao_aplicavel: 'outline', nao_avaliado: 'secondary',
    };
    return <Badge variant={variants[status] || 'outline'} className="text-micro">{statusLabelKeys[status] ? t(`gapAnalysis.audit.status.${statusLabelKeys[status]}`) : status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <AkurisPulse size={16} className="text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <IconHistory className="h-5 w-5 mx-auto text-muted-foreground mb-1" strokeWidth={1.5}/>
        <p className="text-xs text-muted-foreground">{t('gapAnalysis.audit.noChanges')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
            {index < entries.length - 1 && <div className="w-px h-full bg-border flex-1 mt-1" />}
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(entry.valor_anterior)}
              <span className="text-xs text-muted-foreground">→</span>
              {getStatusBadge(entry.valor_novo)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {entry.user_nome} • {new Date(entry.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
