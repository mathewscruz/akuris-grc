import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { formatarDiaParaDB } from '@/lib/date-utils';

export type ScoreHistoryPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ScoreHistoryPoint {
  date: string;
  score: number;
  totalRequirements: number;
  evaluatedRequirements: number;
}

export const useScoreHistory = (frameworkId: string, period: ScoreHistoryPeriod = 'daily') => {
  const [history, setHistory] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  useEffect(() => {
    if (!frameworkId || !empresaId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Calcular data de início baseado no período
        const now = new Date();
        let startDate = new Date();
        
        switch (period) {
          case 'daily':
            startDate.setDate(now.getDate() - 30); // Últimos 30 dias
            break;
          case 'weekly':
            startDate.setDate(now.getDate() - 90); // Últimas ~13 semanas
            break;
          case 'monthly':
            startDate.setMonth(now.getMonth() - 12); // Últimos 12 meses
            break;
          case 'yearly':
            startDate.setFullYear(now.getFullYear() - 5); // Últimos 5 anos
            break;
        }

        const { data, error } = await supabase
          .from('gap_analysis_score_history')
          .select('*')
          .eq('framework_id', frameworkId)
          .eq('empresa_id', empresaId)
          .gte('recorded_at', startDate.toISOString())
          .order('recorded_at', { ascending: true });

        if (error) throw error;

        // Agrupar dados conforme período
        const groupedData = groupDataByPeriod(data || [], period);
        setHistory(groupedData);
      } catch (error) {
        console.error('Error fetching score history:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [frameworkId, empresaId, period]);

  return { history, loading };
};

// Função auxiliar para agrupar dados por período
const groupDataByPeriod = (data: any[], period: ScoreHistoryPeriod): ScoreHistoryPoint[] => {
  if (!data.length) return [];

  const grouped = new Map<string, any[]>();

  data.forEach(item => {
    const date = new Date(item.recorded_at);
    let key: string;

    switch (period) {
      case 'daily':
        key = formatarDiaParaDB(date); // YYYY-MM-DD
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = formatarDiaParaDB(weekStart);
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'yearly':
        key = String(date.getFullYear());
        break;
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });

  // Calcular média de scores para cada grupo
  return Array.from(grouped.entries()).map(([date, items]) => {
    const avgScore = items.reduce((sum, item) => sum + parseFloat(item.score), 0) / items.length;
    const lastItem = items[items.length - 1];

    return {
      date: formatDateForDisplay(date, period),
      score: Math.round(avgScore * 100) / 100,
      totalRequirements: lastItem.total_requirements,
      evaluatedRequirements: lastItem.evaluated_requirements
    };
  });
};

const formatDateForDisplay = (dateStr: string, period: ScoreHistoryPeriod): string => {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  switch (period) {
    case 'daily':
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}`;
    case 'weekly':
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}`;
    case 'monthly':
      const [yr, mn] = dateStr.split('-');
      return months[parseInt(mn) - 1];
    case 'yearly':
      return dateStr;
    default:
      return dateStr;
  }
};

// Função para salvar histórico de score
export const saveScoreHistory = async (
  frameworkId: string,
  empresaId: string,
  score: number,
  totalRequirements: number,
  evaluatedRequirements: number
) => {
  try {
    const { error } = await supabase
      .from('gap_analysis_score_history')
      .insert({
        framework_id: frameworkId,
        empresa_id: empresaId,
        score: score,
        total_requirements: totalRequirements,
        evaluated_requirements: evaluatedRequirements,
        recorded_at: new Date().toISOString()
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving score history:', error);
    return false;
  }
};
