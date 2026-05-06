import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDueDiligenceStatusTone, resolveCategoriaTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { Input } from '@/components/ui/input';
import { Plus, Search, Mail, Eye, BarChart3, Calendar, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AssessmentDialog } from './AssessmentDialog';

interface Assessment {
  id: string;
  fornecedor_nome: string;
  fornecedor_email: string;
  status: string;
  data_envio: string;
  data_conclusao: string | null;
  score_final: number | null;
  link_token: string;
  template: {
    nome: string;
    categoria: string;
  };
}

export function AssessmentsManager() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assessmentDialog, setAssessmentDialog] = useState<{
    open: boolean;
    assessment?: Assessment;
    mode?: 'create' | 'view';
  }>({ open: false });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchAssessments();
  }, []);

  useEffect(() => {
    filterAssessments();
  }, [assessments, searchTerm, statusFilter]);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('due_diligence_assessments')
        .select(`
          id,
          fornecedor_nome,
          fornecedor_email,
          status,
          data_envio,
          data_conclusao,
          score_final,
          link_token,
          due_diligence_templates!inner (
            nome,
            categoria
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        id: item.id,
        fornecedor_nome: item.fornecedor_nome,
        fornecedor_email: item.fornecedor_email,
        status: item.status,
        data_envio: item.data_envio,
        data_conclusao: item.data_conclusao,
        score_final: item.score_final,
        link_token: item.link_token,
        template: {
          nome: (item.due_diligence_templates as any)?.nome || '',
          categoria: (item.due_diligence_templates as any)?.categoria || ''
        }
      })) || [];

      setAssessments(formattedData);
    } catch (error: any) {
      console.error('Erro ao buscar avaliações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as avaliações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAssessments = () => {
    let filtered = assessments;

    if (searchTerm) {
      filtered = filtered.filter(assessment =>
        assessment.fornecedor_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.fornecedor_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.template.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(assessment => assessment.status === statusFilter);
    }

    setFilteredAssessments(filtered);
  };

  const getStatusBadge = (status: string) => {
    return <StatusBadge size="sm" {...resolveDueDiligenceStatusTone(status)}>{formatStatus(status)}</StatusBadge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Categoria badge agora usa resolveCategoriaTone (StatusBadge)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-muted rounded w-1/3 animate-pulse"></div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Avaliações de Fornecedores</h2>
          <p className="text-muted-foreground">
            Gerencie e acompanhe as avaliações enviadas aos fornecedores
          </p>
        </div>
        <Button 
          onClick={() => setAssessmentDialog({ open: true, mode: 'create' })}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Avaliação
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por fornecedor, email ou template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="all">Todos os status</option>
          <option value="enviado">Enviado</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluido">Concluído</option>
          <option value="expirado">Expirado</option>
        </select>
      </div>

      {/* Lista de Avaliações */}
      {filteredAssessments.length > 0 ? (
        <div className="space-y-4">
          {filteredAssessments.map((assessment) => (
            <Card key={assessment.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{assessment.fornecedor_nome}</h3>
                      {getStatusBadge(assessment.status)}
                      <StatusBadge size="sm" {...resolveCategoriaTone(assessment.template.categoria)}>
                        {assessment.template.categoria}
                      </StatusBadge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {assessment.fornecedor_email}
                    </p>
                    
                    <p className="text-sm font-medium">
                      Template: {assessment.template.nome}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        Enviado em {new Date(assessment.data_envio).toLocaleDateString('pt-BR')}
                      </div>
                      
                      {assessment.data_conclusao && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Concluído em {new Date(assessment.data_conclusao).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                      
                      {assessment.score_final && (
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4" />
                          <span className={`font-medium ${getScoreColor(assessment.score_final)}`}>
                            Score: {assessment.score_final.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssessmentDialog({ 
                        open: true, 
                        assessment, 
                        mode: 'view' 
                      })}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Visualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'Nenhuma avaliação encontrada' 
                : 'Nenhuma avaliação criada'
              }
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Crie sua primeira avaliação para começar a avaliar fornecedores'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button 
                onClick={() => setAssessmentDialog({ open: true, mode: 'create' })}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Primeira Avaliação
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <AssessmentDialog
        open={assessmentDialog.open}
        onOpenChange={(open) => setAssessmentDialog({ open })}
        assessment={assessmentDialog.assessment}
        mode={assessmentDialog.mode}
        onSuccess={() => {
          fetchAssessments();
          setAssessmentDialog({ open: false });
        }}
      />
    </div>
  );
}