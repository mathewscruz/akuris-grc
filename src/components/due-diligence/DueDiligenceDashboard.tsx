import { useState, useEffect } from 'react';
import { IconWarning } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDueDiligenceStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { StatStrip } from '@/components/ui/stat-strip';
import { supabase } from '@/integrations/supabase/client';
import { formatDateOnly, parseDataLocal } from '@/lib/date-utils';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface DashboardStats {
  totalFornecedores: number;
  totalAssessments: number;
  completedAssessments: number;
  pendingAssessments: number;
  expiredAssessments: number;
  averageScore: number;
  scoredAssessments: number;
  recentAssessments: any[];
  totalTemplates: number;
}

export function DueDiligenceDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalFornecedores: 0,
    totalTemplates: 0,
    totalAssessments: 0,
    completedAssessments: 0,
    pendingAssessments: 0,
    expiredAssessments: 0,
    averageScore: 0,
    scoredAssessments: 0,
    recentAssessments: []
  });
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.empresa_id) return;

      const [templatesRes, assessmentsRes, fornecedoresRes] = await Promise.all([
        supabase.from('due_diligence_templates').select('id').eq('ativo', true),
        supabase.from('due_diligence_assessments').select('id, status, score_final, fornecedor_nome, created_at, data_expiracao').eq('empresa_id', profile.empresa_id),
        supabase.from('fornecedores').select('id').eq('empresa_id', profile.empresa_id).eq('status', 'ativo')
      ]);

      const assessments = assessmentsRes.data || [];
      const now = new Date();
      
      const completedAssessments = assessments.filter(a => a.status === 'concluido').length;
      const expiredAssessments = assessments.filter(a => 
        a.data_expiracao && parseDataLocal(a.data_expiracao) < now && a.status !== 'concluido'
      ).length;
      const pendingAssessments = assessments.filter(a => 
        a.status !== 'concluido' && !(a.data_expiracao && parseDataLocal(a.data_expiracao) < now)
      ).length;
      
      const completedWithScores = assessments.filter(a => a.status === 'concluido' && a.score_final != null);
      const averageScore = completedWithScores.length > 0 
        // Sem `* 10`: `score_final` já é percentagem. O KPI mostrava 750% para
        // uma avaliação de 75.
        ? completedWithScores.reduce((sum, a) => sum + (a.score_final || 0), 0) / completedWithScores.length
        : 0;

      const recentAssessments = assessments
        .filter(a => a.status !== 'concluido' || (a.data_expiracao && parseDataLocal(a.data_expiracao) < now))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setStats({
        totalFornecedores: fornecedoresRes.data?.length || 0,
        totalTemplates: templatesRes.data?.length || 0,
        totalAssessments: assessments.length,
        completedAssessments,
        pendingAssessments,
        expiredAssessments,
        averageScore,
        scoredAssessments: completedWithScores.length,
        recentAssessments
      });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  // (status mapping removido — usar resolveDueDiligenceStatusTone + formatStatus)

  /**
   * Expira no fim do dia do prazo, não no instante em que o relógio passa.
   * `new Date() > new Date(date)` marcava como expirada, desde a madrugada,
   * uma avaliação cujo prazo é hoje — e com `new Date` cru sobre uma data sem
   * hora ainda perdia um dia por causa do fuso.
   */
  const attentionState = (assessment: any) => {
    if (assessment.status === 'rascunho') {
      return { tone: 'warning' as const, label: t('dueDiligence.dashboard.readyToSend') };
    }
    if (!assessment.data_expiracao) {
      return { tone: 'warning' as const, label: t('dueDiligence.dashboard.noDeadline') };
    }
    const days = differenceInCalendarDays(startOfDay(parseDataLocal(assessment.data_expiracao)), startOfDay(new Date()));
    if (days < 0) {
      return { tone: 'destructive' as const, label: t('dueDiligence.dashboard.overdueBy', { count: Math.abs(days) }) };
    }
    if (days === 0) {
      return { tone: 'warning' as const, label: t('dueDiligence.dashboard.dueToday') };
    }
    return { tone: 'warning' as const, label: t('dueDiligence.dashboard.awaitingSupplier', { count: days }) };
  };

  return (
    <div className="space-y-4">
      <StatStrip
        loading={loading}
        items={[
          { key: 'fornecedores', label: t('dueDiligence.dashboard.statSuppliersTitle'), value: stats.totalFornecedores, drillDown: 'due_diligence_fornecedores' },
          { key: 'concluidos', label: t('dueDiligence.dashboard.statCompletedTitle'), value: stats.completedAssessments, drillDown: 'due_diligence_concluidos' },
          { key: 'expirados', label: t('dueDiligence.dashboard.statExpiredTitle'), value: stats.expiredAssessments, tone: 'destructive', drillDown: 'due_diligence_expirados' },
          {
            key: 'scoreMedio',
            label: t('dueDiligence.dashboard.statAverageScoreTitle'),
            value: stats.scoredAssessments > 0 ? `${stats.averageScore.toFixed(0)}%` : '—',
            hint: stats.scoredAssessments > 0 ? undefined : t('dueDiligence.dashboard.noScoreYet'),
            target: 80,
            direction: 'higher-is-better',
          },
        ]}
      />

      {/* Assessments que precisam de atenção */}
      {stats.recentAssessments.length > 0 && (
        <Card className="overflow-hidden border-warning/25">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b border-warning/20 bg-warning/[0.045] px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-warning/25 bg-card text-warning">
                <IconWarning className="h-4 w-4" />
              </span>
              <h3 className="min-w-0 flex-1 text-sm font-semibold">
                {t('dueDiligence.dashboard.attentionCardTitle')}
              </h3>
              <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning">
                {stats.recentAssessments.length}
              </span>
            </div>
            <div className="divide-y divide-border/70">
              {stats.recentAssessments.map((assessment, index) => {
                const attention = attentionState(assessment);
                return (
                <div key={assessment.id ?? index} className="flex flex-col gap-2.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                      <p className="font-medium text-sm">{assessment.fornecedor_nome}</p>
                      {/*
                        O painel chama-se "precisam de atenção" e mostrava a
                        data de CRIAÇÃO — que não é o que exige a atenção. O
                        que interessa é o prazo: quando expira, ou há quanto
                        tempo já expirou.
                      */}
                      <p className="text-xs text-muted-foreground">
                        {assessment.data_expiracao
                          ? t('dueDiligence.dashboard.prazoEm', { data: formatDateOnly(assessment.data_expiracao) })
                          : formatDateOnly(assessment.created_at)}
                      </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusBadge tone={attention.tone}>{attention.label}</StatusBadge>
                    <StatusBadge {...resolveDueDiligenceStatusTone(assessment.status)}>
                      {formatStatus(assessment.status)}
                    </StatusBadge>
                  </div>
                </div>
              )})}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
