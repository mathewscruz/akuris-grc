import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, Shield, Users, Calendar, Building, MessageSquareWarning, Activity as ActivityIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatStatus } from '@/lib/text-utils';
import { useQuery } from '@tanstack/react-query';
import { CornerAccent } from '@/components/identity/CornerAccent';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  module: string;
  iconName: string;
  status?: string;
}

const getIcon = (module: string) => {
  switch (module) {
    case 'riscos': return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'controles': return <Shield className="h-4 w-4 text-primary" />;
    case 'documentos': return <FileText className="h-4 w-4 text-info" />;
    case 'auditorias': return <Calendar className="h-4 w-4 text-warning" />;
    case 'usuarios': return <Users className="h-4 w-4 text-muted-foreground" />;
    case 'contratos': return <Building className="h-4 w-4 text-secondary-foreground" />;
    case 'denuncias': return <MessageSquareWarning className="h-4 w-4 text-orange-500" />;
    default: return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "neutral"; label: string }> = {
  'critico': { variant: 'destructive', label: 'Crítico' },
  'alto': { variant: 'destructive', label: 'Alto' },
  'medio': { variant: 'warning', label: 'Médio' },
  'médio': { variant: 'warning', label: 'Médio' },
  'baixo': { variant: 'success', label: 'Baixo' },
  'ativo': { variant: 'success', label: 'Ativo' },
  'inativo': { variant: 'neutral', label: 'Inativo' },
  'vencido': { variant: 'destructive', label: 'Vencido' },
  'em_avaliacao': { variant: 'warning', label: 'Em Avaliação' },
  'pendente': { variant: 'warning', label: 'Pendente' },
  'pendente_aprovacao': { variant: 'warning', label: 'Pendente Aprovação' },
  'aprovado': { variant: 'success', label: 'Aprovado' },
  'rejeitado': { variant: 'destructive', label: 'Rejeitado' },
  'planejada': { variant: 'warning', label: 'Planejada' },
  'em_andamento': { variant: 'info', label: 'Em Andamento' },
  'em_analise': { variant: 'info', label: 'Em Análise' },
  'em_investigacao': { variant: 'info', label: 'Em Investigação' },
  'concluida': { variant: 'success', label: 'Concluída' },
  'concluído': { variant: 'success', label: 'Concluído' },
  'concluido': { variant: 'success', label: 'Concluído' },
  'cancelada': { variant: 'neutral', label: 'Cancelada' },
  'nova': { variant: 'info', label: 'Nova' },
  'resolvida': { variant: 'success', label: 'Resolvida' },
  'arquivada': { variant: 'neutral', label: 'Arquivada' },
};

const getStatusBadge = (status?: string) => {
  if (!status) return null;
  const normalizedStatus = status.toLowerCase().trim();
  const statusInfo = statusMap[normalizedStatus] || {
    variant: 'outline' as const,
    label: formatStatus(status)
  };
  return (
    <Badge variant={statusInfo.variant} className="text-[10px] px-1.5 py-0 whitespace-nowrap">
      {statusInfo.label}
    </Badge>
  );
};

async function fetchActivities(empresaId: string, t: any): Promise<Activity[]> {
  const activities: Activity[] = [];

  const [riscosRes, controlesRes, documentosRes, auditoriasRes, denunciasRes] = await Promise.all([
    supabase.from('riscos').select('id, nome, nivel_risco_inicial, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('controles').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('documentos').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('auditorias').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2),
    supabase.from('denuncias').select('id, titulo, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2),
  ]);

  riscosRes.data?.forEach(r => activities.push({ id: `risco-${r.id}`, type: 'creation', title: r.nome, description: t('activities.newRisk'), created_at: r.created_at, module: 'riscos', iconName: 'riscos', status: r.nivel_risco_inicial }));
  controlesRes.data?.forEach(c => activities.push({ id: `controle-${c.id}`, type: 'creation', title: c.nome, description: t('activities.newControl'), created_at: c.created_at, module: 'controles', iconName: 'controles', status: c.status }));
  documentosRes.data?.forEach(d => activities.push({ id: `documento-${d.id}`, type: 'creation', title: d.nome, description: t('activities.documentAdded'), created_at: d.created_at, module: 'documentos', iconName: 'documentos', status: d.status }));
  auditoriasRes.data?.forEach(a => activities.push({ id: `auditoria-${a.id}`, type: 'creation', title: a.nome, description: t('activities.newAudit'), created_at: a.created_at, module: 'auditorias', iconName: 'auditorias', status: a.status }));
  denunciasRes.data?.forEach(d => activities.push({ id: `denuncia-${d.id}`, type: 'creation', title: d.titulo, description: t('activities.newComplaint'), created_at: d.created_at, module: 'denuncias', iconName: 'denuncias', status: d.status }));

  return activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
}

export function RecentActivities({ className }: { className?: string }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const empresaId = profile?.empresa_id;

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['recent-activities', empresaId],
    queryFn: () => fetchActivities(empresaId!, t),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  const routeMap: Record<string, string> = {
    'riscos': '/riscos',
    'controles': '/governanca?tab=controles',
    'documentos': '/documentos',
    'auditorias': '/governanca?tab=auditorias',
    'denuncias': '/denuncia'
  };

  const handleActivityClick = (activity: Activity) => {
    const route = routeMap[activity.module];
    if (route) navigate(route);
  };

  return (
    <Card className={`relative w-full min-w-0 overflow-hidden ${className || ''}`}>
      <CornerAccent />
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-muted-foreground" /> {t('dashboard.recentActivities')}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[400px] overflow-y-auto pt-0 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-3 p-3 rounded-lg border bg-card/50 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleActivityClick(activity)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleActivityClick(activity)}
              >
                <div className="flex-shrink-0 mt-1 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  {getIcon(activity.module)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                    {getStatusBadge(activity.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: locale === 'pt' ? ptBR : enUS })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
              <Calendar className="h-12 w-12" />
            </div>
            <p className="text-muted-foreground">{t('dashboard.noActivities')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
