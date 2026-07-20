import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveContratoStatusTone } from '@/lib/status-tone';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, FileText, DollarSign, Calendar, Users, ClipboardList } from 'lucide-react';
import { formatStatus } from '@/lib/text-utils';

interface Contrato {
  id: string;
  numero_contrato: string;
  nome: string;
  tipo: string;
  status: string;
  valor: number;
  moeda: string;
  data_inicio: string;
  data_fim: string;
  data_assinatura: string;
  renovacao_automatica: boolean;
  prazo_renovacao: number;
  fornecedor_id: string;
  gestor_contrato: string;
  area_solicitante: string;
  objeto: string;
  observacoes: string;
  clausulas_especiais: string;
  penalidades: string;
  sla_principal: string;
  confidencial: boolean;
}

interface Fornecedor {
  id: string;
  nome: string;
}

interface ContratoDialogWizardProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  fornecedores: Fornecedor[];
}

const STEPS = [
  { id: 1, title: 'Dados Básicos', icon: FileText, description: 'Nome, número e tipo do contrato' },
  { id: 2, title: 'Valores e Datas', icon: DollarSign, description: 'Valor, moeda e período de vigência' },
  { id: 3, title: 'Partes Envolvidas', icon: Users, description: 'Fornecedor, gestor e área solicitante' },
  { id: 4, title: 'Detalhes', icon: ClipboardList, description: 'Objeto, SLA e cláusulas' },
  { id: 5, title: 'Revisão', icon: Check, description: 'Confirme as informações' }
];

export function ContratoDialogWizard({ contrato, open, onOpenChange, onSuccess, fornecedores }: ContratoDialogWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    numero_contrato: '',
    nome: '',
    tipo: 'servicos',
    status: 'rascunho',
    valor: '',
    moeda: 'BRL',
    data_inicio: '',
    data_fim: '',
    data_assinatura: '',
    renovacao_automatica: false,
    prazo_renovacao: '30',
    fornecedor_id: '',
    gestor_contrato: '',
    area_solicitante: '',
    objeto: '',
    observacoes: '',
    clausulas_especiais: '',
    penalidades: '',
    sla_principal: '',
    confidencial: false
  });
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      fetchUsuarios();
      if (contrato) {
        setFormData({
          numero_contrato: contrato.numero_contrato || '',
          nome: contrato.nome || '',
          tipo: contrato.tipo || 'servicos',
          status: contrato.status || 'rascunho',
          valor: contrato.valor?.toString() || '',
          moeda: contrato.moeda || 'BRL',
          data_inicio: contrato.data_inicio || '',
          data_fim: contrato.data_fim || '',
          data_assinatura: contrato.data_assinatura || '',
          renovacao_automatica: contrato.renovacao_automatica || false,
          prazo_renovacao: contrato.prazo_renovacao?.toString() || '30',
          fornecedor_id: contrato.fornecedor_id || '',
          gestor_contrato: contrato.gestor_contrato || '',
          area_solicitante: contrato.area_solicitante || '',
          objeto: contrato.objeto || '',
          observacoes: contrato.observacoes || '',
          clausulas_especiais: contrato.clausulas_especiais || '',
          penalidades: contrato.penalidades || '',
          sla_principal: contrato.sla_principal || '',
          confidencial: contrato.confidencial || false
        });
      } else {
        setFormData({
          numero_contrato: '',
          nome: '',
          tipo: 'servicos',
          status: 'rascunho',
          valor: '',
          moeda: 'BRL',
          data_inicio: '',
          data_fim: '',
          data_assinatura: '',
          renovacao_automatica: false,
          prazo_renovacao: '30',
          fornecedor_id: '',
          gestor_contrato: '',
          area_solicitante: '',
          objeto: '',
          observacoes: '',
          clausulas_especiais: '',
          penalidades: '',
          sla_principal: '',
          confidencial: false
        });
      }
    }
  }, [contrato, open]);

  const fetchUsuarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.empresa_id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .eq('ativo', true)
        .eq('empresa_id', profile.empresa_id)
        .order('nome');

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!formData.nome && !!formData.numero_contrato;
      case 2:
        if (formData.data_inicio && formData.data_fim) {
          return new Date(formData.data_inicio) <= new Date(formData.data_fim);
        }
        return true;
      case 3:
        return !!formData.fornecedor_id;
      default:
        return true;
    }
  };

  const getStepError = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!formData.nome) return 'Nome do contrato é obrigatório';
        if (!formData.numero_contrato) return 'Número do contrato é obrigatório';
        return null;
      case 2:
        if (formData.data_inicio && formData.data_fim && new Date(formData.data_inicio) > new Date(formData.data_fim)) {
          return 'Data de início não pode ser posterior à data de fim';
        }
        return null;
      case 3:
        if (!formData.fornecedor_id) return 'Fornecedor é obrigatório';
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const error = getStepError(currentStep);
    if (error) {
      toast({
        title: "Atenção",
        description: error,
        variant: "destructive",
      });
      return;
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields
    for (let i = 1; i <= 3; i++) {
      const error = getStepError(i);
      if (error) {
        toast({
          title: "Erro de validação",
          description: error,
          variant: "destructive",
        });
        setCurrentStep(i);
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user?.id)
        .single();

      const contratoData = {
        numero_contrato: formData.numero_contrato,
        nome: formData.nome,
        tipo: formData.tipo,
        status: formData.status,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        moeda: formData.moeda,
        data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null,
        data_assinatura: formData.data_assinatura || null,
        renovacao_automatica: formData.renovacao_automatica,
        prazo_renovacao: formData.prazo_renovacao ? parseInt(formData.prazo_renovacao) : null,
        fornecedor_id: formData.fornecedor_id,
        gestor_contrato: formData.gestor_contrato || null,
        area_solicitante: formData.area_solicitante,
        objeto: formData.objeto,
        observacoes: formData.observacoes,
        clausulas_especiais: formData.clausulas_especiais,
        penalidades: formData.penalidades,
        sla_principal: formData.sla_principal,
        confidencial: formData.confidencial,
        empresa_id: profile?.empresa_id,
        created_by: user?.id
      };

      let error;
      
      if (contrato) {
        const { error: updateError } = await supabase
          .from('contratos')
          .update(contratoData)
          .eq('id', contrato.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('contratos')
          .insert([contratoData]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Contrato ${contrato ? 'atualizado' : 'criado'} com sucesso`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar contrato",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFornecedorNome = (id: string) => {
    return fornecedores.find(f => f.id === id)?.nome || '-';
  };

  const getUsuarioNome = (id: string) => {
    return usuarios.find(u => u.user_id === id)?.nome || '-';
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_contrato">
                  Número do Contrato <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="numero_contrato"
                  value={formData.numero_contrato}
                  onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                  placeholder="Ex: CT-2024-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">
                  Nome do Contrato <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Contrato de Licenciamento"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servicos">Serviços</SelectItem>
                    <SelectItem value="licenciamento">Licenciamento</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                    <SelectItem value="consultoria">Consultoria</SelectItem>
                    <SelectItem value="produto">Produto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="negociacao">Negociação</SelectItem>
                    <SelectItem value="aprovacao">Aprovação</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="confidencial"
                checked={formData.confidencial}
                onCheckedChange={(checked) => setFormData({ ...formData, confidencial: checked })}
              />
              <Label htmlFor="confidencial">Contrato Confidencial</Label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="moeda">Moeda</Label>
                <Select value={formData.moeda} onValueChange={(value) => setFormData({ ...formData, moeda: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL - Real</SelectItem>
                    <SelectItem value="USD">USD - Dólar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data de Início</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_fim">Data de Fim</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_assinatura">Data de Assinatura</Label>
                <Input
                  id="data_assinatura"
                  type="date"
                  value={formData.data_assinatura}
                  onChange={(e) => setFormData({ ...formData, data_assinatura: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="renovacao_automatica"
                  checked={formData.renovacao_automatica}
                  onCheckedChange={(checked) => setFormData({ ...formData, renovacao_automatica: checked })}
                />
                <Label htmlFor="renovacao_automatica">Renovação Automática</Label>
              </div>

              {formData.renovacao_automatica && (
                <div className="space-y-2">
                  <Label htmlFor="prazo_renovacao">Prazo Renovação (dias)</Label>
                  <Input
                    id="prazo_renovacao"
                    type="number"
                    value={formData.prazo_renovacao}
                    onChange={(e) => setFormData({ ...formData, prazo_renovacao: e.target.value })}
                    placeholder="30"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fornecedor_id">
                Fornecedor <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.fornecedor_id} onValueChange={(value) => setFormData({ ...formData, fornecedor_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gestor_contrato">Gestor do Contrato</Label>
                <Select value={formData.gestor_contrato} onValueChange={(value) => setFormData({ ...formData, gestor_contrato: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map((usuario) => (
                      <SelectItem key={usuario.user_id} value={usuario.user_id}>
                        {usuario.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="area_solicitante">Área Solicitante</Label>
                <Input
                  id="area_solicitante"
                  value={formData.area_solicitante}
                  onChange={(e) => setFormData({ ...formData, area_solicitante: e.target.value })}
                  placeholder="Ex: TI, Financeiro, RH"
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="objeto">Objeto do Contrato</Label>
              <Textarea
                id="objeto"
                value={formData.objeto}
                onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                placeholder="Descrição detalhada do objeto do contrato..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sla_principal">SLA Principal</Label>
              <Textarea
                id="sla_principal"
                value={formData.sla_principal}
                onChange={(e) => setFormData({ ...formData, sla_principal: e.target.value })}
                placeholder="Descrição dos principais SLAs..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clausulas_especiais">Cláusulas Especiais</Label>
              <Textarea
                id="clausulas_especiais"
                value={formData.clausulas_especiais}
                onChange={(e) => setFormData({ ...formData, clausulas_especiais: e.target.value })}
                placeholder="Cláusulas especiais e observações..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="penalidades">Penalidades</Label>
              <Textarea
                id="penalidades"
                value={formData.penalidades}
                onChange={(e) => setFormData({ ...formData, penalidades: e.target.value })}
                placeholder="Descrição das penalidades..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dados Básicos</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-medium">{formData.numero_contrato || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="font-medium">{formData.nome || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <StatusBadge tone="neutral" variant="outline" size="sm">{formatStatus(formData.tipo)}</StatusBadge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <StatusBadge size="sm" {...resolveContratoStatusTone(formData.status)}>{formatStatus(formData.status)}</StatusBadge>
                  </div>
                  {formData.confidencial && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confidencial:</span>
                      <StatusBadge tone="destructive" size="sm">Sim</StatusBadge>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Valores e Datas</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">
                      {formData.valor 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: formData.moeda }).format(Number(formData.valor))
                        : '-'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Início:</span>
                    <span className="font-medium">{formData.data_inicio || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fim:</span>
                    <span className="font-medium">{formData.data_fim || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Renovação Automática:</span>
                    <span className="font-medium">{formData.renovacao_automatica ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Partes Envolvidas</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fornecedor:</span>
                    <span className="font-medium">{getFornecedorNome(formData.fornecedor_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gestor:</span>
                    <span className="font-medium">{getUsuarioNome(formData.gestor_contrato)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Área:</span>
                    <span className="font-medium">{formData.area_solicitante || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Detalhes</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Objeto:</span>
                    <p className="font-medium mt-1 line-clamp-2">{formData.objeto || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={FileText}
      title={contrato ? 'Editar Contrato' : 'Novo Contrato'}
      description={contrato
        ? 'Atualize as informações do contrato conforme necessário.'
        : 'Preencha os campos para cadastrar um novo contrato.'}
      size="lg"
      noScroll
      footer={
        <div className="flex justify-between w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {currentStep < STEPS.length ? (
              <Button type="button" size="sm" onClick={handleNext}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Salvando...' : (contrato ? 'Atualizar' : 'Criar Contrato')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="h-full flex flex-col min-h-0">
        {/* Step Indicator */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted || step.id <= currentStep) {
                        setCurrentStep(step.id);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                      isCurrent && "bg-primary/10",
                      (isCompleted || step.id <= currentStep) && "cursor-pointer hover:bg-muted",
                      step.id > currentStep && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary",
                      !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                    )}>
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={cn(
                      "text-xs font-medium hidden sm:block",
                      isCurrent && "text-primary",
                      !isCurrent && "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-2",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{STEPS[currentStep - 1].title}</h3>
            <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].description}</p>
          </div>
          {renderStepContent()}
        </div>
      </div>
    </DialogShell>
  );
}
