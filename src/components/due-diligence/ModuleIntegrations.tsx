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
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
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
        title: t('dueDiligence.moduleIntegrations.errorTitle'),
        description: t('dueDiligence.moduleIntegrations.errorRequiredFieldsDescription'),
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
      title: t('dueDiligence.moduleIntegrations.toastSuccessTitle'),
      description: rule ? t('dueDiligence.moduleIntegrations.toastUpdatedDescription') : t('dueDiligence.moduleIntegrations.toastCreatedDescription'),
    });
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Workflow}
      title={rule ? t('dueDiligence.moduleIntegrations.editTitle') : t('dueDiligence.moduleIntegrations.createTitle')}
      size="md"
      onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
      submitLabel={rule ? t('dueDiligence.moduleIntegrations.update') : t('dueDiligence.moduleIntegrations.create')}
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">{t('dueDiligence.moduleIntegrations.fieldName')}</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder={t('dueDiligence.moduleIntegrations.namePlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="descricao">{t('dueDiligence.moduleIntegrations.fieldDescription')}</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder={t('dueDiligence.moduleIntegrations.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo_integracao">{t('dueDiligence.moduleIntegrations.fieldType')}</Label>
              <Select value={formData.tipo_integracao} onValueChange={(value) => setFormData({ ...formData, tipo_integracao: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="riscos">{t('dueDiligence.moduleIntegrations.typeRiscos')}</SelectItem>
                  <SelectItem value="contratos">{t('dueDiligence.moduleIntegrations.typeContratos')}</SelectItem>
                  <SelectItem value="documentos">{t('dueDiligence.moduleIntegrations.typeDocumentos')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="acao">{t('dueDiligence.moduleIntegrations.fieldAction')}</Label>
              <Select value={formData.acao} onValueChange={(value) => setFormData({ ...formData, acao: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_risk">{t('dueDiligence.moduleIntegrations.actionCreateRisk')}</SelectItem>
                  <SelectItem value="flag_contract">{t('dueDiligence.moduleIntegrations.actionFlagContract')}</SelectItem>
                  <SelectItem value="request_document">{t('dueDiligence.moduleIntegrations.actionRequestDocument')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="condicao">{t('dueDiligence.moduleIntegrations.fieldCondition')}</Label>
              <Select value={formData.condicao} onValueChange={(value) => setFormData({ ...formData, condicao: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_below">{t('dueDiligence.moduleIntegrations.conditionScoreBelow')}</SelectItem>
                  <SelectItem value="score_above">{t('dueDiligence.moduleIntegrations.conditionScoreAbove')}</SelectItem>
                  <SelectItem value="classification_equals">{t('dueDiligence.moduleIntegrations.conditionClassificationEquals')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="valor_condicao">{t('dueDiligence.moduleIntegrations.fieldValue')}</Label>
              <Input
                id="valor_condicao"
                value={formData.valor_condicao}
                onChange={(e) => setFormData({ ...formData, valor_condicao: e.target.value })}
                placeholder={t('dueDiligence.moduleIntegrations.valuePlaceholder')}
              />
            </div>
          </div>
          
        </form>
    </DialogShell>
  );
}

export function ModuleIntegrations() {
  const { t } = useLanguage();
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
        title: t('dueDiligence.moduleIntegrations.toastSuccessTitle'),
        description: t('dueDiligence.moduleIntegrations.toastCreatedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('dueDiligence.moduleIntegrations.errorTitle'),
        description: t('dueDiligence.moduleIntegrations.toastCreateErrorDescription', { error: error.message }),
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
        title: t('dueDiligence.moduleIntegrations.toastSuccessTitle'),
        description: t('dueDiligence.moduleIntegrations.toastUpdatedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('dueDiligence.moduleIntegrations.errorTitle'),
        description: t('dueDiligence.moduleIntegrations.toastUpdateErrorDescription', { error: error.message }),
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
      case 'riscos': return t('dueDiligence.moduleIntegrations.typeRiscos');
      case 'contratos': return t('dueDiligence.moduleIntegrations.typeContratos');
      case 'documentos': return t('dueDiligence.moduleIntegrations.typeDocumentos');
      default: return t('dueDiligence.moduleIntegrations.typeUnknown');
    }
  };

  const getConditionLabel = (condicao: string, valor: string) => {
    switch (condicao) {
      case 'score_below': return `${t('dueDiligence.moduleIntegrations.conditionScoreBelow')} ${valor}`;
      case 'score_above': return `${t('dueDiligence.moduleIntegrations.conditionScoreAbove')} ${valor}`;
      case 'classification_equals': return `${t('dueDiligence.moduleIntegrations.conditionClassificationEquals')} ${valor}`;
      default: return t('dueDiligence.moduleIntegrations.conditionUndefined');
    }
  };

  const getActionLabel = (acao: string) => {
    switch (acao) {
      case 'create_risk': return t('dueDiligence.moduleIntegrations.actionCreateRisk');
      case 'flag_contract': return t('dueDiligence.moduleIntegrations.actionFlagContract');
      case 'request_document': return t('dueDiligence.moduleIntegrations.actionRequestDocument');
      default: return t('dueDiligence.moduleIntegrations.actionUndefined');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('dueDiligence.moduleIntegrations.pageTitle')}</h2>
          <p className="text-muted-foreground">
            {t('dueDiligence.moduleIntegrations.pageDescription')}
          </p>
        </div>
        
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          {t('dueDiligence.moduleIntegrations.newIntegration')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-8 h-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{integrations.filter(i => i.ativo).length}</p>
                <p className="text-sm text-muted-foreground">{t('dueDiligence.moduleIntegrations.activeIntegrations')}</p>
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
                <p className="text-sm text-muted-foreground">{t('dueDiligence.moduleIntegrations.inactiveIntegrations')}</p>
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
                <p className="text-sm text-muted-foreground">{t('dueDiligence.moduleIntegrations.totalRules')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p>{t('dueDiligence.moduleIntegrations.loading')}</p>
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
                <h3 className="text-lg font-semibold mb-2">{t('dueDiligence.moduleIntegrations.emptyTitle')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('dueDiligence.moduleIntegrations.emptyDescription')}
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('dueDiligence.moduleIntegrations.createFirst')}
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
