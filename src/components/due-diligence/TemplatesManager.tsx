import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCategoriaTone, resolveAtivoTone } from '@/lib/status-tone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Copy, Trash2, FileText, Settings as SettingsIcon, Star, Filter, X, Shield, Scale, Leaf } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { TemplateDialog } from './TemplateDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly } from '@/lib/date-utils';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Template {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  ativo: boolean;
  versao: number;
  created_at: string;
  padrao?: boolean;
  _count?: {
    questions: number;
    assessments: number;
  };
}

const fetchTemplates = async (): Promise<Template[]> => {
  console.log('🔄 Iniciando busca de templates...');
  
  const { data: templatesData, error: templatesError } = await supabase
    .from('due_diligence_templates')
    .select(`
      id,
      nome,
      descricao,
      categoria,
      ativo,
      versao,
      created_at,
      padrao
    `)
    .order('padrao', { ascending: false })
    .order('created_at', { ascending: false });

  if (templatesError) {
    console.error('❌ Erro ao buscar templates:', templatesError);
    throw templatesError;
  }

  console.log('✅ Templates encontrados:', templatesData?.length || 0);

  const templatesWithCounts = await Promise.all(
    (templatesData || []).map(async (template) => {
      console.log(`🔍 Buscando dados para template: ${template.nome} (ID: ${template.id})`);
      
      const [questionsResult, assessmentsResult] = await Promise.all([
        supabase
          .from('due_diligence_questions')
          .select('id', { count: 'exact', head: true })
          .eq('template_id', template.id),
        supabase
          .from('due_diligence_assessments')
          .select('id', { count: 'exact', head: true })
          .eq('template_id', template.id)
      ]);

      const questionsCount = questionsResult.count || 0;
      const assessmentsCount = assessmentsResult.count || 0;
      
      console.log(`📊 Template ${template.nome}: ${questionsCount} perguntas, ${assessmentsCount} avaliações`);

      if (questionsResult.error) {
        console.error('❌ Erro ao buscar perguntas:', questionsResult.error);
      }
      
      if (assessmentsResult.error) {
        console.error('❌ Erro ao buscar avaliações:', assessmentsResult.error);
      }

      return {
        ...template,
        _count: {
          questions: questionsCount,
          assessments: assessmentsCount
        }
      };
    })
  );

  console.log('✅ Templates com contagens processados:', templatesWithCounts);
  return templatesWithCounts;
};

const SUGGESTED_TEMPLATES = [
  {
    nome: 'Segurança da Informação',
    descricao: 'Avalia controles de segurança, gestão de acessos, criptografia e resposta a incidentes do fornecedor.',
    categoria: 'Segurança',
    icon: Shield,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    perguntas: [
      { titulo: 'Política de Segurança', pergunta: 'A empresa possui uma política de segurança da informação formalizada e atualizada?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Governança', configuracoes: { mostrar_evidencia_quando: 'sim', label_evidencia: 'Anexe a política de segurança vigente' } },
      { titulo: 'Controle de Acesso', pergunta: 'Existe controle de acesso baseado em papéis (RBAC) e autenticação multifator (MFA)?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Controle de Acesso', configuracoes: { mostrar_evidencia_quando: 'sim', label_evidencia: 'Descreva os controles implementados' } },
      { titulo: 'Gestão de Vulnerabilidades', pergunta: 'A empresa realiza análise de vulnerabilidades e testes de penetração periodicamente?', tipo: 'radio', opcoes: ['Sim, mensalmente', 'Sim, trimestralmente', 'Sim, anualmente', 'Não realiza'], obrigatoria: true, peso: 2, secao: 'Segurança Técnica' },
      { titulo: 'Backup e Recuperação', pergunta: 'Existem procedimentos de backup e recuperação de desastres documentados e testados?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Continuidade', configuracoes: { mostrar_evidencia_quando: 'sim', label_evidencia: 'Anexe evidência dos testes de restore' } },
      { titulo: 'Resposta a Incidentes', pergunta: 'A empresa possui um plano de resposta a incidentes de segurança?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Incidentes', configuracoes: { mostrar_justificativa_quando: 'nao', label_justificativa: 'Quais são os planos para implementar?' } },
      { titulo: 'Treinamento em Segurança', pergunta: 'Os colaboradores recebem treinamento periódico em segurança da informação?', tipo: 'radio', opcoes: ['Sim, trimestral', 'Sim, semestral', 'Sim, anual', 'Não há programa'], obrigatoria: true, peso: 2, secao: 'Pessoas' },
      { titulo: 'Criptografia', pergunta: 'Dados sensíveis são criptografados em trânsito e em repouso?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Segurança Técnica' },
      { titulo: 'Certificações', pergunta: 'A empresa possui certificações de segurança (ISO 27001, SOC 2, etc.)?', tipo: 'texto', obrigatoria: false, peso: 2, secao: 'Governança' },
    ]
  },
  {
    nome: 'LGPD - Proteção de Dados',
    descricao: 'Verifica conformidade com a Lei Geral de Proteção de Dados, mapeamento de dados e direitos dos titulares.',
    categoria: 'Privacidade',
    icon: Scale,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    perguntas: [
      { titulo: 'DPO / Encarregado', pergunta: 'A empresa possui um Encarregado de Proteção de Dados (DPO) nomeado?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Governança', configuracoes: { mostrar_evidencia_quando: 'sim', label_evidencia: 'Informe nome e contato do DPO' } },
      { titulo: 'Mapeamento de Dados', pergunta: 'Existe um inventário/mapeamento dos dados pessoais tratados?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Mapeamento' },
      { titulo: 'Base Legal', pergunta: 'O tratamento de dados pessoais está fundamentado em bases legais adequadas?', tipo: 'radio', opcoes: ['Sim, todas documentadas', 'Parcialmente documentadas', 'Em processo de documentação', 'Não documentado'], obrigatoria: true, peso: 3, secao: 'Conformidade' },
      { titulo: 'Direitos dos Titulares', pergunta: 'Existem procedimentos para atender solicitações de titulares de dados?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Direitos', configuracoes: { mostrar_justificativa_quando: 'nao', label_justificativa: 'Como pretende implementar?' } },
      { titulo: 'Compartilhamento com Terceiros', pergunta: 'Existe controle sobre o compartilhamento de dados pessoais com terceiros?', tipo: 'booleano', obrigatoria: true, peso: 2, secao: 'Compartilhamento' },
      { titulo: 'Notificação de Incidentes', pergunta: 'Existe procedimento para notificação de incidentes envolvendo dados pessoais à ANPD?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Incidentes' },
      { titulo: 'Política de Privacidade', pergunta: 'A empresa possui política de privacidade pública e atualizada?', tipo: 'booleano', obrigatoria: true, peso: 2, secao: 'Transparência', configuracoes: { mostrar_evidencia_quando: 'sim', label_evidencia: 'Informe o link da política' } },
    ]
  },
  {
    nome: 'ESG Básico',
    descricao: 'Avalia práticas ambientais, sociais e de governança corporativa do parceiro.',
    categoria: 'ESG',
    icon: Leaf,
    color: 'text-green-600 bg-green-50 border-green-200',
    perguntas: [
      { titulo: 'Política Ambiental', pergunta: 'A empresa possui política ambiental formalizada?', tipo: 'booleano', obrigatoria: true, peso: 2, secao: 'Ambiental' },
      { titulo: 'Emissões de Carbono', pergunta: 'A empresa mensura e reporta suas emissões de gases de efeito estufa?', tipo: 'radio', opcoes: ['Sim, com metas de redução', 'Sim, sem metas', 'Em processo de implementação', 'Não'], obrigatoria: true, peso: 2, secao: 'Ambiental' },
      { titulo: 'Diversidade e Inclusão', pergunta: 'Existem programas de diversidade e inclusão na empresa?', tipo: 'booleano', obrigatoria: true, peso: 2, secao: 'Social' },
      { titulo: 'Trabalho Escravo/Infantil', pergunta: 'A empresa possui política contra trabalho escravo e infantil em sua cadeia?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Social' },
      { titulo: 'Código de Conduta', pergunta: 'Existe um código de conduta e ética formalizado?', tipo: 'booleano', obrigatoria: true, peso: 2, secao: 'Governança', configuracoes: { mostrar_evidencia_quando: 'sim', label_evidencia: 'Anexe o código de conduta' } },
      { titulo: 'Canal de Denúncias', pergunta: 'A empresa possui canal de denúncias independente?', tipo: 'booleano', obrigatoria: true, peso: 2, secao: 'Governança' },
      { titulo: 'Anticorrupção', pergunta: 'Existem políticas e treinamentos anticorrupção?', tipo: 'booleano', obrigatoria: true, peso: 3, secao: 'Governança' },
    ]
  }
];

export function TemplatesManager() {
  const [templateDialog, setTemplateDialog] = useState<{
    open: boolean;
    template?: Template;
    mode?: 'create' | 'edit' | 'duplicate' | 'questions';
  }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    template?: Template;
  }>({ open: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoriaFilter, setCategoriaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cloningTemplate, setCloningTemplate] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();

  const cloneSuggestedTemplate = async (suggested: typeof SUGGESTED_TEMPLATES[0]) => {
    if (!empresaId) {
      toast({ title: 'Erro', description: 'Empresa não identificada.', variant: 'destructive' });
      return;
    }
    setCloningTemplate(suggested.nome);
    try {
      // Create the template
      const { data: newTemplate, error: templateError } = await supabase
        .from('due_diligence_templates')
        .insert([{
          nome: suggested.nome,
          descricao: suggested.descricao,
          categoria: suggested.categoria,
          empresa_id: empresaId,
          ativo: true,
          versao: 1,
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      // Create all questions
      const questionsToInsert = suggested.perguntas.map((p, idx) => ({
        template_id: newTemplate.id,
        titulo: p.titulo,
        descricao: p.pergunta,
        tipo: p.tipo,
        opcoes: (p as any).opcoes || null,
        obrigatoria: p.obrigatoria,
        peso: p.peso,
        ordem: idx + 1,
        secao: p.secao,
        configuracoes: p.configuracoes || null,
      }));

      const { error: questionsError } = await supabase
        .from('due_diligence_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      toast({
        title: 'Template criado!',
        description: `"${suggested.nome}" foi adicionado com ${suggested.perguntas.length} perguntas.`,
      });

      queryClient.invalidateQueries({ queryKey: ['due-diligence-templates'] });
    } catch (error: any) {
      console.error('Erro ao clonar template:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o template.',
        variant: 'destructive',
      });
    } finally {
      setCloningTemplate(null);
    }
  };

  const {
    data: templates = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['due-diligence-templates'],
    queryFn: fetchTemplates,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  if (error) {
    console.error('❌ Erro na query de templates:', error);
    toast({
      title: "Erro",
      description: "Não foi possível carregar os templates.",
      variant: "destructive",
    });
  }

  // Lista de categorias únicas
  const categorias = useMemo(() => {
    const cats = new Set(templates.map(t => t.categoria));
    return Array.from(cats).filter(Boolean);
  }, [templates]);

  // Filtrar templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // Filtro por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !template.nome.toLowerCase().includes(term) &&
          !template.categoria.toLowerCase().includes(term) &&
          !template.descricao?.toLowerCase().includes(term)
        ) {
          return false;
        }
      }

      // Filtro por categoria
      if (categoriaFilter !== 'all' && template.categoria !== categoriaFilter) {
        return false;
      }

      // Filtro por status
      if (statusFilter !== 'all') {
        if (statusFilter === 'ativo' && !template.ativo) return false;
        if (statusFilter === 'inativo' && template.ativo) return false;
      }

      return true;
    });
  }, [templates, searchTerm, categoriaFilter, statusFilter]);

  const handleDeleteTemplate = async (template: Template) => {
    try {
      if (template._count?.assessments && template._count.assessments > 0) {
        toast({
          title: "Não é possível excluir",
          description: "Este template possui avaliações vinculadas e não pode ser excluído.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('due_diligence_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Template excluído",
        description: "O template foi excluído com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ['due-diligence-templates'] });
      refetch();
    } catch (error: any) {
      console.error('Erro ao excluir template:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o template.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialog({ open: false });
    }
  };

  const toggleTemplateStatus = async (template: Template) => {
    try {
      const { error } = await supabase
        .from('due_diligence_templates')
        .update({ ativo: !template.ativo })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Template ${!template.ativo ? 'ativado' : 'desativado'} com sucesso.`,
      });

      queryClient.invalidateQueries({ queryKey: ['due-diligence-templates'] });
      refetch();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do template.",
        variant: "destructive",
      });
    }
  };

  // Categoria agora via resolveCategoriaTone (StatusBadge)

  const clearFilters = () => {
    setSearchTerm('');
    setCategoriaFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm || categoriaFilter !== 'all' || statusFilter !== 'all';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Templates de Questionários</h2>
            <p className="text-muted-foreground">
              Carregando templates...
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="h-5 bg-muted rounded w-3/4 animate-pulse mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-3 bg-muted rounded w-16 animate-pulse"></div>
                        <div className="h-3 bg-muted rounded w-16 animate-pulse"></div>
                        <div className="h-5 bg-muted rounded w-12 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-4">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="h-8 w-8 bg-muted rounded animate-pulse"></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div>
        {/* Templates Sugeridos */}
        {templates.length < 3 && (
          <Card className="mb-6 border-dashed border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AkurisAIIcon className="h-5 w-5 text-primary" />
                Templates Sugeridos
              </CardTitle>
              <CardDescription>
                Comece rapidamente com templates pré-configurados por especialistas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SUGGESTED_TEMPLATES.map((suggested) => {
                  const Icon = suggested.icon;
                  const alreadyExists = templates.some(t => t.nome === suggested.nome);
                  return (
                    <Card key={suggested.nome} className={`border ${suggested.color} transition-all hover:shadow-md`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${suggested.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{suggested.nome}</h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {suggested.descricao}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {suggested.perguntas.length} perguntas
                          </span>
                          <Button
                            size="sm"
                            variant={alreadyExists ? "outline" : "default"}
                            disabled={alreadyExists || cloningTemplate === suggested.nome}
                            onClick={() => cloneSuggestedTemplate(suggested)}
                          >
                            {cloningTemplate === suggested.nome ? (
                              <AkurisPulse size={12} className="mr-1" />
                            ) : alreadyExists ? (
                              'Já adicionado'
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Usar
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-lg border overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Input
                    placeholder="Buscar templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
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
                    onClick={() => setTemplateDialog({ open: true, mode: 'create' })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Template
                  </Button>
                </div>
              </div>
              
              {showFilters && (
                <div className="bg-muted/50 rounded-lg p-4 mb-4 flex items-center gap-4 flex-wrap">
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
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Status:</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
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

            {filteredTemplates.length > 0 ? (
              <div className="space-y-3 p-6 pt-0">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className={`${!template.ativo ? 'opacity-60' : ''} ${template.padrao ? 'border-warning/30 bg-warning/5' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold truncate">{template.nome}</h3>
                                {template.padrao && (
                                  <StatusBadge size="sm" tone="warning" icon={<Star className="h-3 w-3" strokeWidth={1.5} />}>
                                    Padrão
                                  </StatusBadge>
                                )}
                                <StatusBadge size="sm" {...resolveCategoriaTone(template.categoria)}>
                                  {template.categoria}
                                </StatusBadge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {template.descricao || 'Sem descrição'}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{template._count?.questions || 0} perguntas</span>
                              <span>{template._count?.assessments || 0} avaliações</span>
                              <StatusBadge size="sm" {...resolveAtivoTone(template.ativo)}>
                                {template.ativo ? 'Ativo' : 'Inativo'}
                              </StatusBadge>
                              <span className="text-xs">v{template.versao}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTemplateDialog({ 
                                  open: true, 
                                  template, 
                                  mode: 'questions' 
                                })}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Gerenciar perguntas</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const event = new CustomEvent('createAssessmentFromTemplate', {
                                    detail: { templateId: template.id, templateNome: template.nome }
                                  });
                                  window.dispatchEvent(event);
                                }}
                                className="bg-primary"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Usar Template
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Criar avaliação com este template</TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTemplateDialog({ 
                                  open: true, 
                                  template, 
                                  mode: 'edit' 
                                })}
                                disabled={template.padrao}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar template</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTemplateDialog({ 
                                  open: true, 
                                  template, 
                                  mode: 'duplicate' 
                                })}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicar template</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTemplateStatus(template)}
                                disabled={template.padrao}
                              >
                                <SettingsIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Alterar status</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteDialog({ open: true, template })}
                                disabled={template.padrao || (!!template._count?.assessments && template._count.assessments > 0)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir template</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                        Criado em {formatDateOnly(template.created_at)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="m-6 mt-0">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {hasActiveFilters 
                      ? 'Tente ajustar os filtros para encontrar templates'
                      : 'Crie seu primeiro template de questionário para começar a avaliar fornecedores'
                    }
                  </p>
                  {!hasActiveFilters && (
                    <Button 
                      onClick={() => setTemplateDialog({ open: true, mode: 'create' })}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Criar Primeiro Template
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div>
          <TemplateDialog
            open={templateDialog.open}
            onOpenChange={(open) => setTemplateDialog({ open })}
            template={templateDialog.template}
            mode={templateDialog.mode}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['due-diligence-templates'] });
              refetch();
              setTemplateDialog({ open: false });
            }}
          />

          <ConfirmDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open })}
            title="Excluir Template"
            description={`Tem certeza que deseja excluir o template "${deleteDialog.template?.nome}"? Esta ação não pode ser desfeita.`}
            onConfirm={() => deleteDialog.template && handleDeleteTemplate(deleteDialog.template)}
          />
        </div>

        {/* Seção de Automações */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Automações
            </CardTitle>
            <CardDescription>
              Configure ações automáticas baseadas nos resultados das avaliações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <p className="font-medium">Alerta de Score Baixo</p>
                <p className="text-sm text-muted-foreground">
                  Notificar quando score for inferior a 50%
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <p className="font-medium">Lembrete de Expiração</p>
                <p className="text-sm text-muted-foreground">
                  Enviar lembrete 7 dias antes da expiração
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <p className="font-medium">Relatório Automático</p>
                <p className="text-sm text-muted-foreground">
                  Gerar relatório ao concluir avaliação
                </p>
              </div>
              <Switch />
            </div>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Regra de Automação
            </Button>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
