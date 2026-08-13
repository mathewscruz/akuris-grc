import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FileSignature, DollarSign, Calendar, FileText, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { WizardDialog, WizardTab, WizardTabState } from '@/components/ui/wizard-dialog';
import { WizardSummaryCard, WizardSummaryRow } from '@/components/ui/wizard-summary-card';
import { FieldHelpTooltip } from '@/components/ui/field-help-tooltip';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { logger } from '@/lib/logger';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Contrato {
  id: string;
  numero_contrato: string; nome: string; tipo: string; status: string;
  valor: number; moeda: string; data_inicio: string; data_fim: string; data_assinatura: string;
  renovacao_automatica: boolean; prazo_renovacao: number; fornecedor_id: string;
  gestor_contrato: string; area_solicitante: string; objeto: string; observacoes: string;
  clausulas_especiais: string; penalidades: string; sla_principal: string; confidencial: boolean;
}
interface Fornecedor { id: string; nome: string; }

interface ContratoDialogProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  fornecedores: Fornecedor[];
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ativo: 'default', rascunho: 'outline', encerrado: 'secondary', cancelado: 'destructive',
};

const BLANK = {
  numero_contrato: '', nome: '', tipo: 'servicos', status: 'rascunho', valor: '', moeda: 'BRL',
  data_inicio: '', data_fim: '', data_assinatura: '', renovacao_automatica: false, prazo_renovacao: '30',
  fornecedor_id: '', gestor_contrato: '', area_solicitante: '', objeto: '', observacoes: '',
  clausulas_especiais: '', penalidades: '', sla_principal: '', confidencial: false,
};

export function ContratoDialog({ contrato, open, onOpenChange, onSuccess, fornecedores }: ContratoDialogProps) {
  const [formData, setFormData] = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('identificacao');
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const { toast } = useToast();
  const { notify } = useIntegrationNotify();
  const { t } = useLanguage();

  useEffect(() => {
    if (open) {
      fetchUsuarios();
      const next = contrato
        ? {
            numero_contrato: contrato.numero_contrato || '', nome: contrato.nome || '',
            tipo: contrato.tipo || 'servicos', status: contrato.status || 'rascunho',
            valor: contrato.valor?.toString() || '', moeda: contrato.moeda || 'BRL',
            data_inicio: contrato.data_inicio || '', data_fim: contrato.data_fim || '',
            data_assinatura: contrato.data_assinatura || '',
            renovacao_automatica: contrato.renovacao_automatica || false,
            prazo_renovacao: contrato.prazo_renovacao?.toString() || '30',
            fornecedor_id: contrato.fornecedor_id || '', gestor_contrato: contrato.gestor_contrato || '',
            area_solicitante: contrato.area_solicitante || '', objeto: contrato.objeto || '',
            observacoes: contrato.observacoes || '', clausulas_especiais: contrato.clausulas_especiais || '',
            penalidades: contrato.penalidades || '', sla_principal: contrato.sla_principal || '',
            confidencial: contrato.confidencial || false,
          }
        : BLANK;
      setFormData(next);
      setInitialSnapshot(JSON.stringify(next));
      setActiveTab('identificacao');
    }
  }, [contrato, open]);

  const isDirty = JSON.stringify(formData) !== initialSnapshot;
  const update = (patch: Partial<typeof BLANK>) => setFormData((p) => ({ ...p, ...patch }));

  const { hasDraft, savedAt, loadDraft, clearDraft } = useWizardDraft({
    storageKey: 'contrato', recordId: contrato?.id, values: formData, enabled: open,
  });

  useEffect(() => {
    if (open && !contrato && hasDraft) {
      const d = loadDraft();
      if (d) setFormData(d as typeof BLANK);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('user_id, nome').eq('ativo', true).order('nome');
      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) { logger.error('Erro ao carregar usuários:', error); }
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.numero_contrato || !formData.fornecedor_id) {
      setActiveTab('identificacao');
      toast({ title: t('contratosAtivos.common.error'), description: t('contratosAtivos.contratoDialog.toastErrorFillTitle'), variant: "destructive" });
      return;
    }
    if (formData.data_inicio && formData.data_fim && new Date(formData.data_inicio) > new Date(formData.data_fim)) {
      setActiveTab('financeiro');
      toast({ title: t('contratosAtivos.common.error'), description: t('contratosAtivos.contratoDialog.toastErrorDateRange'), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('user_id', user?.id).single();

      const contratoData = {
        numero_contrato: formData.numero_contrato, nome: formData.nome, tipo: formData.tipo,
        status: formData.status, valor: formData.valor ? parseFloat(formData.valor) : null,
        moeda: formData.moeda, data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null, data_assinatura: formData.data_assinatura || null,
        renovacao_automatica: formData.renovacao_automatica,
        prazo_renovacao: formData.prazo_renovacao ? parseInt(formData.prazo_renovacao) : null,
        fornecedor_id: formData.fornecedor_id, gestor_contrato: formData.gestor_contrato || null,
        area_solicitante: formData.area_solicitante, objeto: formData.objeto,
        observacoes: formData.observacoes, clausulas_especiais: formData.clausulas_especiais,
        penalidades: formData.penalidades, sla_principal: formData.sla_principal,
        confidencial: formData.confidencial, empresa_id: profile?.empresa_id, created_by: user?.id,
      };

      const { error } = contrato
        ? await supabase.from('contratos').update(contratoData).eq('id', contrato.id)
        : await supabase.from('contratos').insert([contratoData]);
      if (error) throw error;

      if (!contrato) {
        notify('contrato_criado', {
          titulo: t('contratosAtivos.contratoDialog.notifyNewContract').replace('{nome}', formData.nome), descricao: formData.objeto,
          link: `${window.location.origin}/contratos`,
          dados: { tipo: formData.tipo, numero: formData.numero_contrato },
        });
      }

      toast({ title: t('contratosAtivos.common.success'), description: t('contratosAtivos.contratoDialog.toastSaveSuccess').replace('{action}', contrato ? t('contratosAtivos.contratoDialog.actionUpdated') : t('contratosAtivos.contratoDialog.actionCreated')) });
      clearDraft();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      logger.error('Erro ao salvar contrato:', error);
      toast({ title: t('contratosAtivos.common.error'), description: t('contratosAtivos.contratoDialog.toastSaveError'), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const identState: WizardTabState =
    formData.numero_contrato && formData.nome && formData.fornecedor_id ? 'complete' : 'pending';
  const finanState: WizardTabState = formData.valor || formData.data_inicio ? 'complete' : 'pending';
  const condState: WizardTabState = formData.objeto || formData.sla_principal ? 'complete' : 'pending';
  const govState: WizardTabState = formData.gestor_contrato || formData.area_solicitante ? 'complete' : 'pending';

  const fornecedorNome = fornecedores.find((f) => f.id === formData.fornecedor_id)?.nome;

  const tabs: WizardTab[] = useMemo(() => [
    {
      id: 'identificacao', label: t('contratosAtivos.contratoDialog.tabIdentification'), icon: FileSignature, state: identState, hint: t('contratosAtivos.contratoDialog.tabIdentificationHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('contratosAtivos.contratoDialog.labelContractNumber')} <span className="text-destructive">*</span>
                <FieldHelpTooltip content={t('contratosAtivos.contratoDialog.contractNumberHelp')} />
              </Label>
              <Input value={formData.numero_contrato} onChange={(e) => update({ numero_contrato: e.target.value })} placeholder={t('contratosAtivos.contratoDialog.contractNumberPlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('contratosAtivos.contratoDialog.labelContractName')} <span className="text-destructive">*</span></Label>
              <Input value={formData.nome} onChange={(e) => update({ nome: e.target.value })} placeholder={t('contratosAtivos.contratoDialog.contractNamePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('contratosAtivos.contratoDialog.labelSupplier')} <span className="text-destructive">*</span></Label>
              <Select value={formData.fornecedor_id} onValueChange={(v) => update({ fornecedor_id: v })}>
                <SelectTrigger><SelectValue placeholder={t('contratosAtivos.contratoDialog.supplierPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('contratosAtivos.contratoDialog.labelType')}</Label>
              <Select value={formData.tipo} onValueChange={(v) => update({ tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="servicos">{t('contratosAtivos.contratoDialog.typeServicos')}</SelectItem>
                  <SelectItem value="licenciamento">{t('contratosAtivos.contratoDialog.typeLicenciamento')}</SelectItem>
                  <SelectItem value="manutencao">{t('contratosAtivos.contratoDialog.typeManutencao')}</SelectItem>
                  <SelectItem value="consultoria">{t('contratosAtivos.contratoDialog.typeConsultoria')}</SelectItem>
                  <SelectItem value="produto">{t('contratosAtivos.contratoDialog.typeProduto')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('contratosAtivos.contratoDialog.labelStatus')}</Label>
              <Select value={formData.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">{t('contratosAtivos.contratoDialog.statusRascunho')}</SelectItem>
                  <SelectItem value="negociacao">{t('contratosAtivos.contratoDialog.statusNegociacao')}</SelectItem>
                  <SelectItem value="aprovacao">{t('contratosAtivos.contratoDialog.statusAprovacao')}</SelectItem>
                  <SelectItem value="ativo">{t('contratosAtivos.contratoDialog.statusAtivo')}</SelectItem>
                  <SelectItem value="suspenso">{t('contratosAtivos.contratoDialog.statusSuspenso')}</SelectItem>
                  <SelectItem value="encerrado">{t('contratosAtivos.contratoDialog.statusEncerrado')}</SelectItem>
                  <SelectItem value="cancelado">{t('contratosAtivos.contratoDialog.statusCancelado')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'financeiro', label: t('contratosAtivos.contratoDialog.tabFinancial'), icon: DollarSign, state: finanState, hint: t('contratosAtivos.contratoDialog.tabFinancialHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('contratosAtivos.contratoDialog.labelValue')}
                <FieldHelpTooltip content={t('contratosAtivos.contratoDialog.valueHelp')} />
              </Label>
              <Input type="number" step="0.01" value={formData.valor} onChange={(e) => update({ valor: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>{t('contratosAtivos.contratoDialog.labelCurrency')}</Label>
              <Select value={formData.moeda} onValueChange={(v) => update({ moeda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('contratosAtivos.contratoDialog.labelRenewalTerm')}</Label>
              <Input type="number" value={formData.prazo_renovacao} onChange={(e) => update({ prazo_renovacao: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {t('contratosAtivos.contratoDialog.labelStart')}</Label>
              <Input type="date" value={formData.data_inicio} onChange={(e) => update({ data_inicio: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {t('contratosAtivos.contratoDialog.labelEnd')}</Label>
              <Input type="date" value={formData.data_fim} onChange={(e) => update({ data_fim: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {t('contratosAtivos.contratoDialog.labelSignature')}</Label>
              <Input type="date" value={formData.data_assinatura} onChange={(e) => update({ data_assinatura: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Switch checked={formData.renovacao_automatica} onCheckedChange={(c) => update({ renovacao_automatica: c })} id="ren-auto" />
            <Label htmlFor="ren-auto" className="cursor-pointer">{t('contratosAtivos.contratoDialog.labelAutoRenewal')}</Label>
            <FieldHelpTooltip content={t('contratosAtivos.contratoDialog.autoRenewalHelp')} />
          </div>
        </div>
      ),
    },
    {
      id: 'condicoes', label: t('contratosAtivos.contratoDialog.tabConditions'), icon: FileText, state: condState, hint: t('contratosAtivos.contratoDialog.tabConditionsHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="space-y-2">
            <Label>{t('contratosAtivos.contratoDialog.labelObject')}</Label>
            <Textarea value={formData.objeto} onChange={(e) => update({ objeto: e.target.value })} rows={4} placeholder={t('contratosAtivos.contratoDialog.objectPlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('contratosAtivos.contratoDialog.labelMainSla')}</Label>
            <Textarea value={formData.sla_principal} onChange={(e) => update({ sla_principal: e.target.value })} rows={3} placeholder={t('contratosAtivos.contratoDialog.mainSlaPlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('contratosAtivos.contratoDialog.labelSpecialClauses')}</Label>
            <Textarea value={formData.clausulas_especiais} onChange={(e) => update({ clausulas_especiais: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{t('contratosAtivos.contratoDialog.labelPenalties')}</Label>
            <Textarea value={formData.penalidades} onChange={(e) => update({ penalidades: e.target.value })} rows={3} />
          </div>
        </div>
      ),
    },
    {
      id: 'governanca', label: t('contratosAtivos.contratoDialog.tabGovernance'), icon: Shield, state: govState, hint: t('contratosAtivos.contratoDialog.tabGovernanceHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('contratosAtivos.contratoDialog.labelManager')}
                <FieldHelpTooltip content={t('contratosAtivos.contratoDialog.managerHelp')} />
              </Label>
              <Select value={formData.gestor_contrato} onValueChange={(v) => update({ gestor_contrato: v })}>
                <SelectTrigger><SelectValue placeholder={t('contratosAtivos.contratoDialog.managerPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('contratosAtivos.contratoDialog.labelRequestingArea')}</Label>
              <Input value={formData.area_solicitante} onChange={(e) => update({ area_solicitante: e.target.value })} placeholder={t('contratosAtivos.contratoDialog.requestingAreaPlaceholder')} />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Switch checked={formData.confidencial} onCheckedChange={(c) => update({ confidencial: c })} id="conf" />
            <Label htmlFor="conf" className="cursor-pointer">{t('contratosAtivos.contratoDialog.labelConfidential')}</Label>
            <FieldHelpTooltip content={t('contratosAtivos.contratoDialog.confidentialHelp')} />
          </div>
          <div className="space-y-2">
            <Label>{t('contratosAtivos.contratoDialog.labelObservations')}</Label>
            <Textarea value={formData.observacoes} onChange={(e) => update({ observacoes: e.target.value })} rows={3} />
          </div>
        </div>
      ),
    },
  ], [formData, fornecedores, usuarios, identState, finanState, condState, govState, t]);

  const summary = (
    <WizardSummaryCard title={t('contratosAtivos.contratoDialog.summaryTitle')}>
      <WizardSummaryRow label={t('contratosAtivos.contratoDialog.summaryName')} value={formData.nome || <span className="text-muted-foreground italic">{t('contratosAtivos.contratoDialog.summaryNoName')}</span>} highlight />
      <WizardSummaryRow label={t('contratosAtivos.contratoDialog.summaryNumber')} value={formData.numero_contrato || '—'} />
      <WizardSummaryRow label={t('contratosAtivos.contratoDialog.summarySupplier')} value={fornecedorNome || <span className="text-muted-foreground italic">—</span>} />
      <WizardSummaryRow
        label={t('contratosAtivos.contratoDialog.summaryStatus')}
        value={<Badge variant={STATUS_VARIANT[formData.status] || 'outline'} className="text-[10px]">{formatStatus(formData.status)}</Badge>}
      />
      <WizardSummaryRow
        label={t('contratosAtivos.contratoDialog.summaryValue')}
        value={formData.valor ? `${formData.moeda} ${parseFloat(formData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : <span className="text-muted-foreground italic">—</span>}
      />
    </WizardSummaryCard>
  );

  const draftLabel = !contrato && hasDraft && savedAt
    ? t('contratosAtivos.contratoDialog.draftSavedAt').replace('{time}', new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    : undefined;

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={contrato ? t('contratosAtivos.contratoDialog.dialogTitleEdit') : t('contratosAtivos.contratoDialog.dialogTitleNew')}
      description={t('contratosAtivos.contratoDialog.dialogDescription')}
      icon={FileSignature}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSubmit}
      submitLabel={contrato ? t('contratosAtivos.common.update') : t('contratosAtivos.common.create')}
      isSubmitting={loading}
      submitDisabled={loading}
      isDirty={isDirty}
      draftLabel={draftLabel}
      size="xl"
    />
  );
}
