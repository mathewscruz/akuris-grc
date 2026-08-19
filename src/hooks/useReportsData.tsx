import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ReportsData {
  overallMetrics: {
    averageScore: number;
    totalSuppliers: number;
    responseRate: number;
    averageCompletionTime: number;
  };
  categoryPerformance: Array<{
    category: string;
    score: number;
  }>;
  topSuppliers: Array<{
    nome: string;
    score: number;
    categoria: string;
  }>;
  lowPerformingSuppliers: Array<{
    nome: string;
    score: number;
    categoria: string;
    status: string;
  }>;
}

export const useReportsData = () => {
  return useQuery({
    queryKey: ['due-diligence-reports'],
    queryFn: async (): Promise<ReportsData> => {
      // Buscar empresa do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.empresa_id) throw new Error('Empresa não encontrada');

      const { data: assessments, error } = await supabase
        .from('due_diligence_assessments')
        .select(`
          *,
          templates:template_id(nome, categoria)
        `)
        .eq('empresa_id', profile.empresa_id)
        .eq('status', 'concluido');

      if (error) throw error;

      // `score_final` já vem em 0-100: quem grava é calculate-assessment-score,
      // que faz (média das notas 0-10 / peso) * 10. O comentário anterior dizia
      // "converter para 0-100%" e multiplicava de novo — num relatório exportável.
      const totalAssessments = assessments?.length || 0;
      const averageScore = totalAssessments > 0 
        ? (assessments.reduce((sum, a) => sum + (a.score_final || 0), 0) / totalAssessments)
        : 0;

      // Fornecedores únicos
      const uniqueSuppliers = new Set(
        assessments?.map(a => a.fornecedor_nome) || []
      ).size;

      // Taxa de resposta (assessments concluídos vs total enviados) da empresa
      const { data: allAssessments } = await supabase
        .from('due_diligence_assessments')
        .select('status')
        .eq('empresa_id', profile.empresa_id);
      
      const totalSent = allAssessments?.length || 1;
      const responseRate = (totalAssessments / totalSent) * 100;

      // Tempo médio de conclusão
      const completedWithTimes = assessments?.filter(a => 
        a.data_inicio && a.data_conclusao
      ) || [];
      
      const averageCompletionTime = completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, a) => {
            const start = new Date(a.data_inicio!);
            const end = new Date(a.data_conclusao!);
            const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / completedWithTimes.length
        : 0;

      // Performance por categoria
      const categoryGroups = assessments?.reduce((acc, a) => {
        const category = a.templates?.categoria || 'Outros';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(a.score_final || 0);
        return acc;
      }, {} as Record<string, number[]>) || {};

      const categoryPerformance = Object.entries(categoryGroups).map(([category, scores]) => ({
        category,
        // `score_final` ja vem em 0-100. O `* 10` sobrou da escala antiga e
        // so foi removido de `averageScore`: aqui uma categoria de media 75
        // saia como 750 no relatorio exportado.
        score: scores.reduce((sum, s) => sum + s, 0) / scores.length
      }));

      // Top fornecedores - converter score para 0-100%
      const supplierScores = assessments?.reduce((acc, a) => {
        const name = a.fornecedor_nome;
        if (!acc[name] || (a.score_final || 0) > acc[name].score) {
          acc[name] = {
            nome: name,
            score: (a.score_final || 0),
            categoria: a.templates?.categoria || 'N/A'
          };
        }
        return acc;
      }, {} as Record<string, any>) || {};

      const topSuppliers = Object.values(supplierScores)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 5);

      // Fornecedores com baixo desempenho - thresholds já em escala 0-100%
      const lowPerformingSuppliers = Object.values(supplierScores)
        .filter((s: any) => s.score < 70)
        .map((s: any) => ({
          ...s,
          status: s.score < 60 ? 'Crítico' : s.score < 70 ? 'Atenção' : 'Baixo'
        }))
        .sort((a: any, b: any) => a.score - b.score)
        .slice(0, 5);

      return {
        overallMetrics: {
          averageScore,
          totalSuppliers: uniqueSuppliers,
          responseRate,
          averageCompletionTime
        },
        categoryPerformance,
        topSuppliers,
        lowPerformingSuppliers
      };
    },
  });
};