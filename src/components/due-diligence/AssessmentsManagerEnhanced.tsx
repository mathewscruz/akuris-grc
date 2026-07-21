import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogShell } from '@/components/ui/dialog-shell';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatCard } from '@/components/ui/stat-card';
import { Plus, Send, Clock, AlertTriangle, FileText, Eye, User, Edit2, Trash2, RefreshCw, Award, TrendingUp, Filter, CheckCircle, Users, ArrowUpDown, MoreHorizontal, X, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDueDiligenceStats } from '@/hooks/useDueDiligenceStats';
import { AssessmentDialog } from './AssessmentDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ScoreVisualization } from './ScoreVisualization';
import { AssessmentResponsesViewer } from './AssessmentResponsesViewer';
import { ReportsSidebar } from './ReportsSidebar';
import { IntegrationSuggestions } from './IntegrationSuggestions';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { resolveDueDiligenceStatusTone } from '@/lib/status-tone';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Assessment {
  id: string;
  fornecedor_nome: string;
  fornecedor_email: string;
  status: string;
  data_inicio?: string;
  data_conclusao?: string;
  data_expiracao: string;
  data_envio?: string;
  score_final?: number;
  token: string;
  link_token: string;
  template: {
    id: string;
    nome: string;
    categoria: string;
  };
}

interface ReminderDialogProps {
  assessment: Assessment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function ReminderDialog({ assessment, open, onOpenChange, onSuccess }: ReminderDialogProps) {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const sendReminder = async () => {
    if (!assessment) return;

    try {
      setSending(true);
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let empresaNome = 'Akuris';
      let empresaLogoUrl = null;

      if (profileData?.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('nome, logo_url')
          .eq('id', profileData.empresa_id)
          .single();
        
        if (empresaData) {
          empresaNome = empresaData.nome;
          empresaLogoUrl = empresaData.logo_url;
        }
      }

      const assessmentLink = `${window.location.origin}/assessment/${assessment.link_token}`;
      
      await supabase.functions.invoke('send-due-diligence-email', {
        body: {
          type: 'reminder',
          assessment_id: assessment.id,
          fornecedor_nome: assessment.fornecedor_nome,
          fornecedor_email: assessment.fornecedor_email,
          template_nome: assessment.template.nome,
          assessment_link: assessmentLink,
          data_expiracao: assessment.data_expiracao,
          empresa_nome: empresaNome,
          empresa_logo_url: empresaLogoUrl
        }
      });

      await supabase
        .from('due_diligence_assessments')
        .update({ ultimo_lembrete_enviado: new Date().toISOString() })
        .eq('id', assessment.id);

      toast({
        title: "Lembrete enviado",
        description: `Lembrete enviado para ${assessment.fornecedor_nome}`,
      });

      onSuccess();
      onOpenChange(false);

    } catch (error: any) {
      toast({
        title: "Erro ao enviar lembrete",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Mail}
      title="Enviar Lembrete"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={sendReminder} disabled={sending}>
            {sending ? 'Enviando...' : 'Enviar Lembrete'}
          </Button>
        </div>
      }
    >
        {assessment && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p><strong>Fornecedor:</strong> {assessment.fornecedor_nome}</p>
              <p><strong>Email:</strong> {assessment.fornecedor_email}</p>
              <p><strong>Template:</strong> {assessment.template.nome}</p>
              <p><strong>Status:</strong> {formatStatus(assessment.status)}</p>
            </div>
          </div>
        )}
    </DialogShell>
  );
}

interface AssessmentsManagerEnhancedProps {
  filter?: {
    fornecedorId?: string;
    fornecedorNome?: string;
  } | null;
}

// Número de itens por página
const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50];

export function AssessmentsManagerEnhanced({ filter }: AssessmentsManagerEnhancedProps = {}) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoriaFilter, setCategoriaFilter] = useState('all');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [reminderDialog, setReminderDialog] = useState<{ open: boolean; assessment: Assessment | null }>({
    open: false,
    assessment: null
  });
  const [assessmentDialog, setAssessmentDialog] = useState<{ 
    open: boolean; 
    assessment: Assessment | null; 
    mode: 'create' | 'view' 
  }>({
    open: false,
    assessment: null,
    mode: 'create'
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; assessment: Assessment | null }>({
    open: false,
    assessment: null
  });
  const [scoreDialog, setScoreDialog] = useState<{ 
    open: boolean; 
    assessment: Assessment | null; 
    scoreData: any 
  }>({
    open: false,
    assessment: null,
    scoreData: null
  });
  const [responsesDialog, setResponsesDialog] = useState<{ 
    open: boolean; 
    assessment: Assessment | null; 
  }>({
    open: false,
    assessment: null
  });
  const { toast } = useToast();
  const { data: stats, isLoading: statsLoading } = useDueDiligenceStats();

  useEffect(() => {
    fetchAssessments();
  }, []);

  useEffect(() => {
    if (filter?.fornecedorNome) {
      setSearchTerm(filter.fornecedorNome);
    }
  }, [filter]);

  useEffect(() => {
    const handleCreateAssessment = (event: CustomEvent) => {
      setAssessmentDialog({ 
        open: true, 
        assessment: {
          fornecedor_nome: event.detail.fornecedorNome,
          fornecedor_id: event.detail.fornecedorId
        } as any, 
        mode: 'create' 
      });
    };
    
    window.addEventListener('createAssessment', handleCreateAssessment as EventListener);
    
    return () => {
      window.removeEventListener('createAssessment', handleCreateAssessment as EventListener);
    };
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('due_diligence_assessments')
        .select(`
          *,
          templates:template_id(id, nome, categoria)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedAssessments: Assessment[] = (data || []).map(assessment => {
        let status = assessment.status;
        
        if (new Date() > new Date(assessment.data_expiracao) && status !== 'concluido') {
          status = 'expirado';
        }
        
        return {
          id: assessment.id,
          fornecedor_nome: assessment.fornecedor_nome,
          fornecedor_email: assessment.fornecedor_email,
          status: status,
          data_inicio: assessment.data_inicio,
          data_conclusao: assessment.data_conclusao,
          data_expiracao: assessment.data_expiracao,
          data_envio: assessment.data_envio,
          score_final: assessment.score_final,
          token: assessment.link_token,
          link_token: assessment.link_token,
          template: {
            id: assessment.template_id,
            nome: assessment.templates?.nome || 'Template não encontrado',
            categoria: assessment.templates?.categoria || 'N/A'
          }
        };
      });

      setAssessments(formattedAssessments);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar assessments",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Lista de categorias únicas
  const categorias = useMemo(() => {
    const cats = new Set(assessments.map(a => a.template.categoria));
    return Array.from(cats).filter(Boolean);
  }, [assessments]);

  // Filtrar e ordenar assessments
  const filteredAndSortedAssessments = useMemo(() => {
    let filtered = assessments;

    if (searchTerm) {
      filtered = filtered.filter(assessment =>
        assessment.fornecedor_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.fornecedor_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.template.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(assessment => assessment.status === statusFilter);
    }

    if (categoriaFilter && categoriaFilter !== 'all') {
      filtered = filtered.filter(assessment => assessment.template.categoria === categoriaFilter);
    }

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof Assessment];
      let bValue: any = b[sortField as keyof Assessment];

      if (sortField === 'template.nome') {
        aValue = a.template.nome;
        bValue = b.template.nome;
      } else if (sortField === 'score_final') {
        aValue = a.score_final || 0;
        bValue = b.score_final || 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [assessments, searchTerm, statusFilter, categoriaFilter, sortField, sortDirection]);

  // Paginação
  const paginatedAssessments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedAssessments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedAssessments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedAssessments.length / itemsPerPage);

  // Reset page quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoriaFilter]);

  const getStatusBadge = (status: string) => {
    return <StatusBadge size="sm" {...resolveDueDiligenceStatusTone(status)}>{formatStatus(status)}</StatusBadge>;
  };

  const getScoreColor = (score?: number) => {
    if (!score || score === 0) return 'text-muted-foreground';
    if (score >= 8) return 'text-success font-semibold';
    if (score >= 6) return 'text-info font-semibold';
    if (score >= 4) return 'text-warning font-semibold';
    return 'text-destructive font-semibold';
  };

  const getScoreBadge = (score?: number): { text: string; tone: StatusTone } => {
    if (!score || score === 0) return { text: "Aguardando", tone: "neutral" };
    if (score >= 8) return { text: "Excelente", tone: "success" };
    if (score >= 6) return { text: "Bom", tone: "info" };
    if (score >= 4) return { text: "Regular", tone: "warning" };
    return { text: "Ruim", tone: "destructive" };
  };

  const isExpired = (dateString: string) => {
    return new Date() > new Date(dateString);
  };

  const isExpiringSoon = (dateString: string) => {
    const expirationDate = new Date(dateString);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 7;
  };

  const getDaysUntilExpiration = (dateString: string) => {
    const expirationDate = new Date(dateString);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const canSendReminder = (assessment: Assessment) => {
    return assessment.status !== 'concluido' && !isExpired(assessment.data_expiracao);
  };

  const viewAssessment = (assessment: Assessment) => {
    const url = `${window.location.origin}/assessment/${assessment.link_token}`;
    window.open(url, '_blank');
  };

  const resendAssessment = async (assessment: Assessment) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let empresaNome = 'Akuris';
      let empresaLogoUrl = null;

      if (profileData?.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('nome, logo_url')
          .eq('id', profileData.empresa_id)
          .single();
        
        if (empresaData) {
          empresaNome = empresaData.nome;
          empresaLogoUrl = empresaData.logo_url;
        }
      }

      const assessmentLink = `${window.location.origin}/assessment/${assessment.link_token}`;
      
      await supabase.functions.invoke('send-due-diligence-email', {
        body: {
          type: 'send',
          assessment_id: assessment.id,
          fornecedor_nome: assessment.fornecedor_nome,
          fornecedor_email: assessment.fornecedor_email,
          template_nome: assessment.template.nome,
          assessment_link: assessmentLink,
          data_expiracao: assessment.data_expiracao,
          empresa_nome: empresaNome,
          empresa_logo_url: empresaLogoUrl
        }
      });

      toast({
        title: "Avaliação reenviada",
        description: `Convite reenviado para ${assessment.fornecedor_nome}`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao reenviar avaliação",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteAssessment = async (assessment: Assessment) => {
    try {
      const { error } = await supabase
        .from('due_diligence_assessments')
        .delete()
        .eq('id', assessment.id);

      if (error) throw error;

      toast({
        title: "Avaliação excluída",
        description: "Avaliação foi excluída com sucesso",
      });

      fetchAssessments();
      setDeleteDialog({ open: false, assessment: null });

    } catch (error: any) {
      toast({
        title: "Erro ao excluir avaliação",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoriaFilter('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || categoriaFilter !== 'all';

  if (loading) {
    return <div className="text-center p-8">Carregando assessments...</div>;
  }

  const calcularScoreMedio = () => {
    const concluidas = assessments.filter(a => 
      a.status === 'concluido' && a.score_final != null && a.score_final > 0
    );
    
    if (concluidas.length === 0) return 0;
    
    return (concluidas.reduce((sum, a) => sum + ((a.score_final || 0) * 10), 0) / concluidas.length);
  };

  const handleScoreClick = async (assessment: Assessment) => {
    try {
      const { data: scoreData } = await supabase
        .from('due_diligence_scores')
        .select('*')
        .eq('assessment_id', assessment.id)
        .single();
      
      if (scoreData) {
        setScoreDialog({
          open: true,
          assessment,
          scoreData
        });
      } else {
        toast({
          title: "Score não encontrado",
          description: "Não foi possível carregar os detalhes do score",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Função para obter classe de borda baseada na expiração
  const getExpirationBorderClass = (assessment: Assessment) => {
    if (assessment.status === 'concluido') return '';
    if (isExpired(assessment.data_expiracao)) return 'border-l-4 border-l-destructive';
    if (isExpiringSoon(assessment.data_expiracao)) return 'border-l-4 border-l-amber-500';
    return '';
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="rounded-lg border overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Input
                    placeholder="Buscar por fornecedor ou template..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <ReportsSidebar />
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setAssessmentDialog({ open: true, assessment: null, mode: 'create' })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Avaliação
                  </Button>
                </div>
              </div>
              
              {showFilters && (
                <div className="bg-muted/50 rounded-lg p-4 mb-4 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Status:</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filtrar por status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="expirado">Expirado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Categoria:</Label>
                    <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {categorias.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={clearFilters}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Lista de assessments */}
            <div className="grid gap-4 p-6 pt-0">
              {paginatedAssessments.map((assessment) => (
                <Card key={assessment.id} className={getExpirationBorderClass(assessment)}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assessment.fornecedor_nome}</CardTitle>
                        <CardDescription>{assessment.fornecedor_email}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(assessment.status)}
                        {isExpired(assessment.data_expiracao) && assessment.status !== 'concluido' && (
                          <StatusBadge size="sm" tone="destructive" intensity="high" icon={<AlertTriangle className="h-3 w-3" />}>
                            Expirado
                          </StatusBadge>
                        )}
                        {isExpiringSoon(assessment.data_expiracao) && assessment.status !== 'concluido' && !isExpired(assessment.data_expiracao) && (
                          <StatusBadge size="sm" tone="warning" icon={<Clock className="h-3 w-3" />}>
                            Vence em {getDaysUntilExpiration(assessment.data_expiracao)}d
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Template:</span>
                        <p className="font-medium">{assessment.template.nome}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Categoria:</span>
                        <p className="font-medium">{assessment.template.categoria}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expira em:</span>
                        <p className="font-medium">
                          {formatDateOnly(assessment.data_expiracao)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Score:</span>
                        <div className="flex items-center gap-2">
                          {assessment.score_final && assessment.score_final > 0 ? (
                            <button
                              onClick={() => handleScoreClick(assessment)}
                              className="hover:underline cursor-pointer flex items-center gap-2"
                            >
                              <StatusBadge
                                size="sm"
                                tone={getScoreBadge(assessment.score_final).tone}
                                icon={<Award className="h-3 w-3" />}
                                className="transition-all hover:scale-105"
                              >
                                {getScoreBadge(assessment.score_final).text}
                                <span className="ml-1 font-mono">
                                  {(assessment.score_final * 10).toFixed(1)}%
                                </span>
                              </StatusBadge>
                            </button>
                          ) : assessment.status === 'concluido' ? (
                            <span className="text-sm text-muted-foreground">Calculando...</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Pendente</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {assessment.data_inicio ? (
                          <span>Iniciado em {formatDateOnly(assessment.data_inicio)}</span>
                        ) : (
                          <span>Ainda não iniciado</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewAssessment(assessment)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Abrir formulário de avaliação</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Mais ações</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end">
                            {assessment.score_final && assessment.score_final > 0 && (
                              <DropdownMenuItem onClick={() => setScoreDialog({ open: true, assessment, scoreData: null })}>
                                <Award className="h-4 w-4 mr-2" />
                                Ver Score
                              </DropdownMenuItem>
                            )}
                            {assessment.status === 'concluido' && (
                              <DropdownMenuItem onClick={() => setResponsesDialog({ open: true, assessment })}>
                                <FileText className="h-4 w-4 mr-2" />
                                Ver Respostas
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setAssessmentDialog({ open: true, assessment, mode: 'view' })}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => resendAssessment(assessment)}
                              disabled={assessment.status === 'concluido'}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reenviar
                            </DropdownMenuItem>
                            {canSendReminder(assessment) && (
                              <DropdownMenuItem onClick={() => setReminderDialog({ open: true, assessment })}>
                                <Send className="h-4 w-4 mr-2" />
                                Lembrete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteDialog({ open: true, assessment })}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Paginação */}
            {filteredAndSortedAssessments.length > 0 && (
              <div className="flex items-center justify-between p-6 pt-0 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedAssessments.length)} de {filteredAndSortedAssessments.length}</span>
                  <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>por página</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {currentPage} de {totalPages || 1}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          {filteredAndSortedAssessments.length === 0 && !loading && (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum assessment encontrado</h3>
                <p className="text-muted-foreground">
                  {hasActiveFilters 
                    ? 'Tente ajustar os filtros para encontrar assessments'
                    : 'Crie seu primeiro assessment para começar'}
                </p>
              </CardContent>
            </Card>
          )}

          <ReminderDialog
            assessment={reminderDialog.assessment}
            open={reminderDialog.open}
            onOpenChange={(open) => setReminderDialog({ open, assessment: null })}
            onSuccess={fetchAssessments}
          />

          <AssessmentDialog
            open={assessmentDialog.open}
            onOpenChange={(open) => setAssessmentDialog({ open, assessment: null, mode: 'create' })}
            assessment={assessmentDialog.assessment as any}
            mode={assessmentDialog.mode}
            onSuccess={fetchAssessments}
          />

          <ConfirmDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open, assessment: null })}
            title="Confirmar Exclusão"
            description={`Tem certeza que deseja excluir a avaliação de ${deleteDialog.assessment?.fornecedor_nome}? Esta ação não pode ser desfeita.`}
            onConfirm={() => deleteDialog.assessment && deleteAssessment(deleteDialog.assessment)}
            confirmText="Excluir"
            cancelText="Cancelar"
          />

          {/* Dialog de Score com Integrações */}
          <DialogShell
            open={scoreDialog.open}
            onOpenChange={(open) => setScoreDialog({ open, assessment: null, scoreData: null })}
            icon={Award}
            title={`Resultado da Avaliação — ${scoreDialog.assessment?.fornecedor_nome ?? ''}`}
            size="xl"
            hideFooter
          >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  {scoreDialog.assessment && (
                    <ScoreVisualizationWrapper assessment={scoreDialog.assessment} />
                  )}
                </div>
                
                <div className="lg:col-span-1">
                  {scoreDialog.assessment && scoreDialog.assessment.score_final && (
                    <IntegrationSuggestions 
                      assessment={{
                        id: scoreDialog.assessment.id,
                        fornecedor_nome: scoreDialog.assessment.fornecedor_nome,
                        score_final: scoreDialog.assessment.score_final
                      }}
                    />
                  )}
                </div>
              </div>
          </DialogShell>

          {/* Dialog de Respostas */}
          <AssessmentResponsesViewer
            open={responsesDialog.open}
            onOpenChange={(open) => setResponsesDialog({ open, assessment: null })}
            assessment={responsesDialog.assessment}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

// Wrapper component para buscar dados do score
function ScoreVisualizationWrapper({ assessment }: { assessment: Assessment }) {
  const [scoreData, setScoreData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScoreData = async () => {
      try {
        const { data, error } = await supabase
          .from('due_diligence_scores')
          .select('*')
          .eq('assessment_id', assessment.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        setScoreData(data);
      } catch (error) {
        console.error('Erro ao buscar dados do score:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScoreData();
  }, [assessment.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Score ainda não calculado para esta avaliação.</p>
      </div>
    );
  }

  return (
    <ScoreVisualization 
      scoreData={scoreData}
      assessmentData={{
        fornecedor_nome: assessment.fornecedor_nome,
        template: assessment.template
      }}
    />
  );
}
