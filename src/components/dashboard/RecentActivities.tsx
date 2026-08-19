import React from 'react';
import { IconWarning, IconCalendar, IconFile, IconShield, IconUsers, IconOrg, IconMessage, IconActivity } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatStatus } from '@/lib/text-utils';
import { getEnumLabel } from '@/lib/enum-labels';
import { useQuery } from '@tanstack/react-query';
import { CornerAccent } from '@/components/identity/CornerAccent';
import { dateFnsLocale } from '@/lib/date-utils';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  module: string;
  iconName: string;
  status?: string;
  isSeverity?: boolean;
}

const getIcon = (module: string) => {
  switch (module) {
    case 'riscos': return <IconWarning className="h-4 w-4 text-destructive" />;
    case 'controles': return <IconShield className="h-4 w-4 text-primary" />;
    case 'documentos': return <IconFile className="h-4 w-4 text-info" />;
    case 'auditorias': return <IconCalendar className="h-4 w-4 text-warning" />;
    case 'usuarios': return <IconUsers className="h-4 w-4 text-muted-foreground" />;
    case 'contratos': return <IconOrg className="h-4 w-4 text-secondary-foreground" />;
    case 'denuncias': return <IconMessage className="h-4 w-4 text-warning" />;
    default: return <IconFile className="h-4 w-4 text-muted-foreground" />;
  }
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "neutral";

/** Apenas o tom visual; o rótulo vem de formatStatus (sensível ao idioma). */
const statusVariantMap: Record<string, BadgeVariant> = {
  'critico': 'destructive',
  'alto': 'destructive',
  'medio': 'warning',
  'médio': 'warning',
  'baixo': 'success',
  'ativo': 'success',
  'inativo': 'neutral',
  'vencido': 'destructive',
  'em_avaliacao': 'warning',
  'pendente': 'warning',
  'pendente_aprovacao': 'warning',
  'aprovado': 'success',
  'rejeitado': 'destructive',
  'planejada': 'warning',
  'em_andamento': 'info',
  'em_analise': 'info',
  'em_investigacao': 'info',
  'concluida': 'success',
  'concluído': 'success',
  'concluido': 'success',
  'cancelada': 'neutral',
  'nova': 'info',
  'resolvida': 'success',
  'arquivada': 'neutral',
};

const getStatusBadge = (status: string | undefined, t: (key: string) => string, isSeverity: boolean) => {
  if (!status) return null;
  const normalizedStatus = status.toLowerCase().trim();
  const variant = statusVariantMap[normalizedStatus] || 'outline';
  const label = isSeverity ? getEnumLabel(t, 'severidade', status) : formatStatus(status);
  return (
    <Badge variant={variant} className="text-micro px-1.5 py-0 whitespace-nowrap">
      {label}
    </Badge>
  );
};

/**
 * Só estas tabelas têm trigger de auditoria hoje. Alargar a cobertura às
 * restantes (documentos, incidentes, denúncias, contratos, fornecedores)
 * exige uma migration — enquanto isso, o feed mostra alterações apenas destas.
 */
const AUDIT_TABLE_TO_MODULE: Record<string, { module: string; iconName: string }> = {
  riscos: { module: 'riscos', iconName: 'riscos' },
  controles: { module: 'controles', iconName: 'controles' },
  ativos: { module: 'ativos', iconName: 'ativos' },
  auditorias: { module: 'auditorias', iconName: 'auditorias' },
};

async function fetchActivities(empresaId: string, t: any): Promise<Activity[]> {
  const activities: Activity[] = [];

  const [riscosRes, controlesRes, documentosRes, auditoriasRes, denunciasRes] = await Promise.all([
    supabase.from('riscos').select('id, nome, nivel_risco_inicial, nivel_risco_residual, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('controles').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('documentos').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('auditorias').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2),
    supabase.from('denuncias').select('id, titulo, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2),
  ]);

  riscosRes.data?.forEach(r => activities.push({ id: `risco-${r.id}`, type: 'creation', title: r.nome, description: t('activities.newRisk'), created_at: r.created_at, module: 'riscos', iconName: 'riscos', status: r.nivel_risco_residual || r.nivel_risco_inicial, isSeverity: true }));
  controlesRes.data?.forEach(c => activities.push({ id: `controle-${c.id}`, type: 'creation', title: c.nome, description: t('activities.newControl'), created_at: c.created_at, module: 'controles', iconName: 'controles', status: c.status }));
  documentosRes.data?.forEach(d => activities.push({ id: `documento-${d.id}`, type: 'creation', title: d.nome, description: t('activities.documentAdded'), created_at: d.created_at, module: 'documentos', iconName: 'documentos', status: d.status }));
  auditoriasRes.data?.forEach(a => activities.push({ id: `auditoria-${a.id}`, type: 'creation', title: a.nome, description: t('activities.newAudit'), created_at: a.created_at, module: 'auditorias', iconName: 'auditorias', status: a.status }));
  denunciasRes.data?.forEach(d => activities.push({ id: `denuncia-${d.id}`, type: 'creation', title: d.titulo, description: t('activities.newComplaint'), created_at: d.created_at, module: 'denuncias', iconName: 'denuncias', status: d.status }));

  // Alterações e remoções vêm da trilha de auditoria. As criações continuam a
  // ser lidas das próprias tabelas porque só 10 tabelas têm trigger de
  // auditoria — usar apenas audit_logs perderia documentos e denúncias.
  const { data: auditRes } = await supabase
    .from('audit_logs')
    .select('id, table_name, record_id, action, old_values, new_values, created_at')
    .eq('empresa_id', empresaId)
    .in('action', ['UPDATE', 'DELETE'])
    .order('created_at', { ascending: false })
    .limit(10);

  auditRes?.forEach((log: any) => {
    const modulo = AUDIT_TABLE_TO_MODULE[log.table_name];
    if (!modulo) return;
    const valores = log.action === 'DELETE' ? log.old_values : log.new_values;
    const titulo = valores?.nome || valores?.titulo;
    if (!titulo) return;
    activities.push({
      id: `audit-${log.id}`,
      type: log.action === 'DELETE' ? 'deletion' : 'update',
      title: titulo,
      description: log.action === 'DELETE' ? t('activities.recordDeleted') : t('activities.recordUpdated'),
      created_at: log.created_at,
      module: modulo.module,
      iconName: modulo.iconName,
    });
  });

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
    'controles': '/governanca/controles',
    'documentos': '/documentos',
    'auditorias': '/governanca/auditorias',
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
          <IconActivity className="h-4 w-4 text-muted-foreground" /> {t('dashboard.recentActivities')}
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
                className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-surface-2/60 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleActivityClick(activity)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleActivityClick(activity)}
              >
                <div className="flex-shrink-0 mt-1 h-8 w-8 flex items-center justify-center">
                  {getIcon(activity.module)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                    {getStatusBadge(activity.status, t, !!activity.isSeverity)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: dateFnsLocale() })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
              <IconCalendar className="h-12 w-12" />
            </div>
            <p className="text-muted-foreground">{t('dashboard.noActivities')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
