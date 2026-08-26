import { useState, useEffect } from 'react';
import { IconCheck, IconCalendar, IconFile, IconChevron, IconChevronLeft, IconMoney, IconUsers, IconChecklist } from '@/components/icons';
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
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseDataLocal } from '@/lib/date-utils';
import { useEmpresaMoeda, MOEDAS, SIMBOLO_MOEDA, type MoedaCodigo } from '@/hooks/useEmpresaMoeda';

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

const buildSteps = (t: (key: string) => string) => [
  { id: 1, title: t('contratosAtivos.contratoDialogWizard.stepBasicData'), icon: IconFile, description: t('contratosAtivos.contratoDialogWizard.stepBasicDataDescription') },
  { id: 2, title: t('contratosAtivos.contratoDialogWizard.stepValuesAndDates'), icon: IconMoney, description: t('contratosAtivos.contratoDialogWizard.stepValuesAndDatesDescription') },
  { id: 3, title: t('contratosAtivos.contratoDialogWizard.stepParties'), icon: IconUsers, description: t('contratosAtivos.contratoDialogWizard.stepPartiesDescription') },
  { id: 4, title: t('contratosAtivos.contratoDialogWizard.stepDetails'), icon: IconChecklist, description: t('contratosAtivos.contratoDialogWizard.stepDetailsDescription') },
  { id: 5, title: t('contratosAtivos.contratoDialogWizard.stepReview'), icon: IconCheck, description: t('contratosAtivos.contratoDialogWizard.stepReviewDescription') }
];

export function ContratoDialogWizard({ contrato, open, onOpenChange, onSuccess, fornecedores }: ContratoDialogWizardProps) {
  /* A moeda da empresa, não «BRL». Uma empresa configurada em euros via
     todo o contrato novo nascer em reais, e só reparava se olhasse para
     o seletor ao lado do valor. */
  const { moeda: moedaDaEmpresa } = useEmpresaMoeda();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    numero_contrato: '',
    nome: '',
    tipo: 'servicos',
    status: 'rascunho',
    valor: '',
    moeda: moedaDaEmpresa,
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
  const { t } = useLanguage();
  const STEPS = buildSteps(t);

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
          moeda: (contrato.moeda as MoedaCodigo) || moedaDaEmpresa,
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
          moeda: moedaDaEmpresa,
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
          return parseDataLocal(formData.data_inicio) <= parseDataLocal(formData.data_fim);
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
        if (!formData.nome) return t('contratosAtivos.contratoDialogWizard.errorNameRequired');
        if (!formData.numero_contrato) return t('contratosAtivos.contratoDialogWizard.errorNumberRequired');
        return null;
      case 2:
        if (formData.data_inicio && formData.data_fim && parseDataLocal(formData.data_inicio) > parseDataLocal(formData.data_fim)) {
          return t('contratosAtivos.contratoDialogWizard.errorDateRange');
        }
        return null;
      case 3:
        if (!formData.fornecedor_id) return t('contratosAtivos.contratoDialogWizard.errorSupplierRequired');
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const error = getStepError(currentStep);
    if (error) {
      toast({
        title: t('contratosAtivos.contratoDialogWizard.toastAttentionTitle'),
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
          title: t('contratosAtivos.contratoDialogWizard.toastValidationErrorTitle'),
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
        title: t('contratosAtivos.common.success'),
        description: t('contratosAtivos.contratoDialogWizard.toastSaveSuccess').replace('{action}', contrato ? t('contratosAtivos.contratoDialogWizard.actionUpdated') : t('contratosAtivos.contratoDialogWizard.actionCreated')),
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.contratoDialogWizard.toastSaveError'),
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
                  {t('contratosAtivos.contratoDialogWizard.labelContractNumber')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="numero_contrato"
                  value={formData.numero_contrato}
                  onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                  placeholder={t('contratosAtivos.contratoDialogWizard.contractNumberPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">
                  {t('contratosAtivos.contratoDialogWizard.labelContractName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder={t('contratosAtivos.contratoDialogWizard.contractNamePlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">{t('contratosAtivos.contratoDialogWizard.labelType')}</Label>
                <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servicos">{t('contratosAtivos.contratoDialogWizard.typeServicos')}</SelectItem>
                    <SelectItem value="licenciamento">{t('contratosAtivos.contratoDialogWizard.typeLicenciamento')}</SelectItem>
                    <SelectItem value="manutencao">{t('contratosAtivos.contratoDialogWizard.typeManutencao')}</SelectItem>
                    <SelectItem value="consultoria">{t('contratosAtivos.contratoDialogWizard.typeConsultoria')}</SelectItem>
                    <SelectItem value="produto">{t('contratosAtivos.contratoDialogWizard.typeProduto')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t('contratosAtivos.contratoDialogWizard.labelStatus')}</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">{t('contratosAtivos.contratoDialogWizard.statusRascunho')}</SelectItem>
                    <SelectItem value="negociacao">{t('contratosAtivos.contratoDialogWizard.statusNegociacao')}</SelectItem>
                    <SelectItem value="aprovacao">{t('contratosAtivos.contratoDialogWizard.statusAprovacao')}</SelectItem>
                    <SelectItem value="ativo">{t('contratosAtivos.contratoDialogWizard.statusAtivo')}</SelectItem>
                    <SelectItem value="suspenso">{t('contratosAtivos.contratoDialogWizard.statusSuspenso')}</SelectItem>
                    <SelectItem value="encerrado">{t('contratosAtivos.contratoDialogWizard.statusEncerrado')}</SelectItem>
                    <SelectItem value="cancelado">{t('contratosAtivos.contratoDialogWizard.statusCancelado')}</SelectItem>
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
              <Label htmlFor="confidencial">{t('contratosAtivos.contratoDialogWizard.labelConfidential')}</Label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">{t('contratosAtivos.contratoDialogWizard.labelValue')}</Label>
                <Input
                  id="valor"
                  type="number"
                  /* `min="0"`: um contrato de valor negativo entrava e
                     entrava também na soma da carteira. */
                  min="0"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="moeda">{t('contratosAtivos.contratoDialogWizard.labelCurrency')}</Label>
                <Select value={formData.moeda} onValueChange={(value) => setFormData({ ...formData, moeda: value as MoedaCodigo })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* GBP faltava: o formatador suporta-a, o seletor não
                        a oferecia — um contrato em libras não se podia
                        registar como tal. */}
                    {MOEDAS.map((m) => (
                      <SelectItem key={m} value={m}>{m} ({SIMBOLO_MOEDA[m]})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_inicio">{t('contratosAtivos.contratoDialogWizard.labelStartDate')}</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_fim">{t('contratosAtivos.contratoDialogWizard.labelEndDate')}</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_assinatura">{t('contratosAtivos.contratoDialogWizard.labelSignatureDate')}</Label>
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
                <Label htmlFor="renovacao_automatica">{t('contratosAtivos.contratoDialogWizard.labelAutoRenewal')}</Label>
              </div>

              {formData.renovacao_automatica && (
                <div className="space-y-2">
                  <Label htmlFor="prazo_renovacao">{t('contratosAtivos.contratoDialogWizard.labelRenewalTerm')}</Label>
                  <Input
                    id="prazo_renovacao"
                    type="number" min="0"
                    value={formData.prazo_renovacao}
                    onChange={(e) => setFormData({ ...formData, prazo_renovacao: e.target.value })}
                    placeholder={t('contratosAtivos.contratoDialogWizard.renewalTermPlaceholder')}
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
                {t('contratosAtivos.contratoDialogWizard.labelSupplier')} <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.fornecedor_id} onValueChange={(value) => setFormData({ ...formData, fornecedor_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('contratosAtivos.contratoDialogWizard.supplierPlaceholder')} />
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
                <Label htmlFor="gestor_contrato">{t('contratosAtivos.contratoDialogWizard.labelManager')}</Label>
                <Select value={formData.gestor_contrato} onValueChange={(value) => setFormData({ ...formData, gestor_contrato: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contratosAtivos.contratoDialogWizard.managerPlaceholder')} />
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
                <Label htmlFor="area_solicitante">{t('contratosAtivos.contratoDialogWizard.labelRequestingArea')}</Label>
                <Input
                  id="area_solicitante"
                  value={formData.area_solicitante}
                  onChange={(e) => setFormData({ ...formData, area_solicitante: e.target.value })}
                  placeholder={t('contratosAtivos.contratoDialogWizard.requestingAreaPlaceholder')}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="objeto">{t('contratosAtivos.contratoDialogWizard.labelObject')}</Label>
              <Textarea
                id="objeto"
                value={formData.objeto}
                onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                placeholder={t('contratosAtivos.contratoDialogWizard.objectPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sla_principal">{t('contratosAtivos.contratoDialogWizard.labelMainSla')}</Label>
              <Textarea
                id="sla_principal"
                value={formData.sla_principal}
                onChange={(e) => setFormData({ ...formData, sla_principal: e.target.value })}
                placeholder={t('contratosAtivos.contratoDialogWizard.mainSlaPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clausulas_especiais">{t('contratosAtivos.contratoDialogWizard.labelSpecialClauses')}</Label>
              <Textarea
                id="clausulas_especiais"
                value={formData.clausulas_especiais}
                onChange={(e) => setFormData({ ...formData, clausulas_especiais: e.target.value })}
                placeholder={t('contratosAtivos.contratoDialogWizard.specialClausesPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="penalidades">{t('contratosAtivos.contratoDialogWizard.labelPenalties')}</Label>
              <Textarea
                id="penalidades"
                value={formData.penalidades}
                onChange={(e) => setFormData({ ...formData, penalidades: e.target.value })}
                placeholder={t('contratosAtivos.contratoDialogWizard.penaltiesPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">{t('contratosAtivos.contratoDialogWizard.labelObservations')}</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder={t('contratosAtivos.contratoDialogWizard.observationsPlaceholder')}
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
                <h4 className="font-medium text-sm text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewBasicData')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewNumber')}</span>
                    <span className="font-medium">{formData.numero_contrato || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewName')}</span>
                    <span className="font-medium">{formData.nome || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewType')}</span>
                    <StatusBadge tone="neutral" variant="outline">{formatStatus(formData.tipo)}</StatusBadge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewStatus')}</span>
                    <StatusBadge {...resolveContratoStatusTone(formData.status)}>{formatStatus(formData.status)}</StatusBadge>
                  </div>
                  {formData.confidencial && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewConfidential')}</span>
                      <StatusBadge tone="destructive">{t('contratosAtivos.contratoDialogWizard.reviewYes')}</StatusBadge>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewValuesAndDates')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewValue')}</span>
                    <span className="font-medium">
                      {formData.valor 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: formData.moeda }).format(Number(formData.valor))
                        : '-'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewStart')}</span>
                    <span className="font-medium">{formData.data_inicio || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewEnd')}</span>
                    <span className="font-medium">{formData.data_fim || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewAutoRenewal')}</span>
                    <span className="font-medium">{formData.renovacao_automatica ? t('contratosAtivos.contratoDialogWizard.reviewYes') : t('contratosAtivos.contratoDialogWizard.reviewNo')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewParties')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewSupplier')}</span>
                    <span className="font-medium">{getFornecedorNome(formData.fornecedor_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewManager')}</span>
                    <span className="font-medium">{getUsuarioNome(formData.gestor_contrato)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewArea')}</span>
                    <span className="font-medium">{formData.area_solicitante || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewDetails')}</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('contratosAtivos.contratoDialogWizard.reviewObject')}</span>
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
      icon={IconFile}
      title={contrato ? t('contratosAtivos.contratoDialogWizard.dialogTitleEdit') : t('contratosAtivos.contratoDialogWizard.dialogTitleNew')}
      description={contrato
        ? t('contratosAtivos.contratoDialogWizard.dialogDescriptionEdit')
        : t('contratosAtivos.contratoDialogWizard.dialogDescriptionNew')}
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
            <IconChevronLeft className="h-4 w-4 mr-2" />
            {t('contratosAtivos.contratoDialogWizard.previousButton')}
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('contratosAtivos.contratoDialogWizard.cancelButton')}
            </Button>
            {currentStep < STEPS.length ? (
              <Button type="button" size="sm" onClick={handleNext}>
                {t('contratosAtivos.contratoDialogWizard.nextButton')}
                <IconChevron className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={handleSubmit} disabled={loading}>
                {loading ? t('contratosAtivos.contratoDialogWizard.savingButton') : (contrato ? t('contratosAtivos.contratoDialogWizard.updateButton') : t('contratosAtivos.contratoDialogWizard.createButton'))}
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
                      (isCompleted || step.id <= currentStep) && "cursor-pointer hover:bg-accent",
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
                        <IconCheck className="h-5 w-5" />
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
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
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
