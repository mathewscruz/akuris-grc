import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, Target, FileText, Building, TrendingUp, AlertTriangle, CheckCircle, Workflow } from 'lucide-react';

interface IntegrationRule {
  id: string;
  nome: string;
  descricao?: string;
  tipo_integracao: 'riscos' | 'contratos' | 'documentos';
  condicao: 'score_below' | 'score_above' | 'classification_equals';
  valor_condicao: string;
  acao: 'create_risk' | 'flag_contract' | 'request_document';
  parametros_acao?: any;
  ativo: boolean;
}

interface IntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: IntegrationRule;
  onSave: (rule: Partial<IntegrationRule>) => void;
}

function IntegrationDialog({ rule, open, onOpenChange, onSave }: IntegrationDialogProps) {
  const [formData, setFormData] = useState({
    nome: rule?.nome || '',
    descricao: rule?.descricao || '',
    tipo_integracao: rule?.tipo_integracao || 'riscos' as const,
    condicao: rule?.condicao || 'score_below' as const,
    valor_condicao: rule?.valor_condicao || '',
    acao: rule?.acao || 'create_risk' as const,
  });

  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.valor_condicao) {
      toast({
        title: "Erro",
        description: "Nome e valor da condição são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const newRule: Partial<IntegrationRule> = {
      id: rule?.id,
      nome: formData.nome,
      descricao: formData.descricao,
      tipo_integracao: formData.tipo_integracao,
      condicao: formData.condicao,
      valor_condicao: formData.valor_condicao,
      acao: formData.acao,
      ativo: rule?.ativo ?? true,
    };

    onSave(newRule);
    onOpenChange(false);
    
    toast({
      title: "Sucesso",
      description: rule ? "Integração atualizada com sucesso!" : "Integração criada com sucesso!",
    });
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Workflow}
      title={rule ? 'Editar Integração' : 'Nova Integração'}
      size="md"
      onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
      submitLabel={rule ? 'Atualizar' : 'Criar'}
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome da Integração</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Criar riscos para fornecedores com score baixo"
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva como esta integração funciona"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo_integracao">Tipo de Integração</Label>
              <Select value={formData.tipo_integracao} onValueChange={(value) => setFormData({ ...formData, tipo_integracao: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="riscos">Riscos</SelectItem>
                  <SelectItem value="contratos">Contratos</SelectItem>
                  <SelectItem value="documentos">Documentos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="acao">Ação</Label>
              <Select value={formData.acao} onValueChange={(value) => setFormData({ ...formData, acao: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_risk">Criar Risco</SelectItem>
                  <SelectItem value="flag_contract">Sinalizar Contrato</SelectItem>
                  <SelectItem value="request_document">Solicitar Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="condicao">Condição</Label>
              <Select value={formData.condicao} onValueChange={(value) => setFormData({ ...formData, condicao: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_below">Score abaixo de</SelectItem>
                  <SelectItem value="score_above">Score acima de</SelectItem>
                  <SelectItem value="classification_equals">Classificação igual a</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="valor_condicao">Valor</Label>
              <Input
                id="valor_condicao"
                value={formData.valor_condicao}
                onChange={(e) => setFormData({ ...formData, valor_condicao: e.target.value })}
                placeholder="Ex: 5.0 ou 'ruim'"
              />
            </div>
          </div>
          
        </form>
    </DialogShell>
  );
}

export function ModuleIntegrations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IntegrationRule | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['due-diligence-integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('due_diligence_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as IntegrationRule[];
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<IntegrationRule>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user?.id)
        .single();

      const { error } = await supabase
        .from('due_diligence_integrations')
        .insert({
          nome: data.nome!,
          descricao: data.descricao,
          tipo_integracao: data.tipo_integracao!,
          condicao: data.condicao!,
          valor_condicao: data.valor_condicao!,
          acao: data.acao!,
          parametros_acao: data.parametros_acao,
          ativo: data.ativo ?? true,
          empresa_id: profile?.empresa_id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['due-diligence-integrations'] });
      toast({
        title: "Sucesso",
        description: "Integração criada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao criar integração: " + error.message,
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IntegrationRule> }) => {
      const { error } = await supabase
        .from('due_diligence_integrations')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['due-diligence-integrations'] });
      toast({
        title: "Sucesso",
        description: "Integração atualizada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar integração: " + error.message,
        variant: "destructive",
      });
    }
  });

  const toggleIntegration = (rule: IntegrationRule) => {
    updateMutation.mutate({
      id: rule.id,
      data: { ativo: !rule.ativo }
    });
  };

  const handleEdit = (rule: IntegrationRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleSave = (rule: Partial<IntegrationRule>) => {
    if (editingRule) {
      updateMutation.mutate({
        id: editingRule.id,
        data: rule
      });
    } else {
      createMutation.mutate(rule);
    }
  };

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'riscos': return <TrendingUp className="w-5 h-5" />;
      case 'contratos': return <FileText className="w-5 h-5" />;
      case 'documentos': return <Building className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (tipo: string) => {
    switch (tipo) {
      case 'riscos': return 'Riscos';
      case 'contratos': return 'Contratos';
      case 'documentos': return 'Documentos';
      default: return 'Desconhecido';
    }
  };

  const getConditionLabel = (condicao: string, valor: string) => {
    switch (condicao) {
      case 'score_below': return `Score < ${valor}`;
      case 'score_above': return `Score > ${valor}`;
      case 'classification_equals': return `Classificação = ${valor}`;
      default: return 'Condição não definida';
    }
  };

  const getActionLabel = (acao: string) => {
    switch (acao) {
      case 'create_risk': return 'Criar Risco';
      case 'flag_contract': return 'Sinalizar Contrato';
      case 'request_document': return 'Solicitar Documento';
      default: return 'Ação não definida';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Integrações com Outros Módulos</h2>
          <p className="text-muted-foreground">
            Configure ações automáticas baseadas nos resultados de questionários
          </p>
        </div>
        
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Integração
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-8 h-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{integrations.filter(i => i.ativo).length}</p>
                <p className="text-sm text-muted-foreground">Integrações Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-8 h-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{integrations.filter(i => !i.ativo).length}</p>
                <p className="text-sm text-muted-foreground">Integrações Inativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="w-8 h-8 text-info" />
              <div>
                <p className="text-2xl font-bold">{integrations.length}</p>
                <p className="text-sm text-muted-foreground">Total de Regras</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p>Carregando integrações...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => (
            <Card key={integration.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(integration.tipo_integracao)}
                      <div>
                        <h3 className="font-semibold">{integration.nome}</h3>
                        {integration.descricao && (
                          <p className="text-xs text-muted-foreground mb-1">{integration.descricao}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {getTypeLabel(integration.tipo_integracao)} • {getConditionLabel(integration.condicao, integration.valor_condicao)} → {getActionLabel(integration.acao)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Switch
                      checked={integration.ativo}
                      onCheckedChange={() => toggleIntegration(integration)}
                      disabled={updateMutation.isPending}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(integration)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {integrations.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma integração configurada</h3>
                <p className="text-muted-foreground mb-4">
                  Configure integrações automáticas baseadas nos resultados de questionários.
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Integração
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      <IntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        onSave={handleSave}
      />
    </div>
  );
}