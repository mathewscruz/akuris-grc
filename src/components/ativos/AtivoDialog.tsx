import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone } from '@/lib/status-tone';
import { Box, FileText, MapPin, Settings2, Calendar as CalendarIcon } from 'lucide-react';
import LocalizacaoSelect from '@/components/ativos/LocalizacaoSelect';
import { UserSelect } from '@/components/riscos/UserSelect';
import { WizardDialog, WizardTab, WizardTabState } from '@/components/ui/wizard-dialog';
import { WizardSummaryCard, WizardSummaryRow } from '@/components/ui/wizard-summary-card';
import { FieldHelpTooltip } from '@/components/ui/field-help-tooltip';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface AtivoFormData {
  nome: string;
  tipo: string;
  descricao: string;
  proprietario: string;
  localizacao: string;
  valor_negocio: string;
  criticidade: string;
  status: string;
  data_aquisicao: string;
  fornecedor: string;
  versao: string;
  tags: string;
  imei: string;
  cliente: string;
  quantidade: number;
}

interface AtivoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: AtivoFormData;
  setFormData: React.Dispatch<React.SetStateAction<AtivoFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isEditing: boolean;
}

const tiposAtivo = (t: (k: string) => string) => [
  { value: 'servidor', label: t('contratosAtivos.ativoDialog.typeServidor') },
  { value: 'aplicacao', label: t('contratosAtivos.ativoDialog.typeAplicacao') },
  { value: 'banco_dados', label: t('contratosAtivos.ativoDialog.typeBancoDados') },
  { value: 'rede', label: t('contratosAtivos.ativoDialog.typeRede') },
  { value: 'endpoint', label: t('contratosAtivos.ativoDialog.typeEndpoint') },
  { value: 'dispositivo_movel', label: t('contratosAtivos.ativoDialog.typeDispositivoMovel') },
  { value: 'armazenamento', label: t('contratosAtivos.ativoDialog.typeArmazenamento') },
  { value: 'software', label: t('contratosAtivos.ativoDialog.typeSoftware') },
  { value: 'hardware', label: t('contratosAtivos.ativoDialog.typeHardware') },
  { value: 'almoxarifado_equipamento', label: t('contratosAtivos.ativoDialog.typeAlmoxarifadoEquipamento') },
  { value: 'almoxarifado_ferramenta', label: t('contratosAtivos.ativoDialog.typeAlmoxarifadoFerramenta') },
  { value: 'almoxarifado_material', label: t('contratosAtivos.ativoDialog.typeAlmoxarifadoMaterial') },
  { value: 'almoxarifado_epi', label: t('contratosAtivos.ativoDialog.typeAlmoxarifadoEpi') },
  { value: 'mobiliario', label: t('contratosAtivos.ativoDialog.typeMobiliario') },
  { value: 'equipamento_escritorio', label: t('contratosAtivos.ativoDialog.typeEquipamentoEscritorio') },
  { value: 'equipamento_comunicacao', label: t('contratosAtivos.ativoDialog.typeEquipamentoComunicacao') },
  { value: 'material_escritorio', label: t('contratosAtivos.ativoDialog.typeMaterialEscritorio') },
  { value: 'veiculo_terrestre', label: t('contratosAtivos.ativoDialog.typeVeiculoTerrestre') },
  { value: 'veiculo_aereo', label: t('contratosAtivos.ativoDialog.typeVeiculoAereo') },
  { value: 'maquina_pesada', label: t('contratosAtivos.ativoDialog.typeMaquinaPesada') },
  { value: 'equipamento_transporte', label: t('contratosAtivos.ativoDialog.typeEquipamentoTransporte') },
  { value: 'imovel', label: t('contratosAtivos.ativoDialog.typeImovel') },
  { value: 'estrutura_fisica', label: t('contratosAtivos.ativoDialog.typeEstruturaFisica') },
  { value: 'instalacao_eletrica', label: t('contratosAtivos.ativoDialog.typeInstalacaoEletrica') },
  { value: 'instalacao_hidraulica', label: t('contratosAtivos.ativoDialog.typeInstalacaoHidraulica') },
  { value: 'equipamento_seguranca', label: t('contratosAtivos.ativoDialog.typeEquipamentoSeguranca') },
  { value: 'sistema_monitoramento', label: t('contratosAtivos.ativoDialog.typeSistemaMonitoramento') },
  { value: 'controle_acesso', label: t('contratosAtivos.ativoDialog.typeControleAcesso') },
  { value: 'equipamento_bombeiro', label: t('contratosAtivos.ativoDialog.typeEquipamentoBombeiro') },
  { value: 'maquina_producao', label: t('contratosAtivos.ativoDialog.typeMaquinaProducao') },
  { value: 'ferramenta_producao', label: t('contratosAtivos.ativoDialog.typeFerramentaProducao') },
  { value: 'equipamento_medicao', label: t('contratosAtivos.ativoDialog.typeEquipamentoMedicao') },
  { value: 'equipamento_teste', label: t('contratosAtivos.ativoDialog.typeEquipamentoTeste') },
  { value: 'equipamento_medico', label: t('contratosAtivos.ativoDialog.typeEquipamentoMedico') },
  { value: 'equipamento_laboratorio', label: t('contratosAtivos.ativoDialog.typeEquipamentoLaboratorio') },
  { value: 'outros', label: t('contratosAtivos.ativoDialog.typeOutros') },
];

const criticidades = (t: (k: string) => string) => [
  { value: 'critico', label: t('contratosAtivos.ativoDialog.critCritico') },
  { value: 'alto', label: t('contratosAtivos.ativoDialog.critAlto') },
  { value: 'medio', label: t('contratosAtivos.ativoDialog.critMedio') },
  { value: 'baixo', label: t('contratosAtivos.ativoDialog.critBaixo') },
];

const statusOptions = (t: (k: string) => string) => [
  { value: 'ativo', label: t('contratosAtivos.ativoDialog.statusAtivo') },
  { value: 'inativo', label: t('contratosAtivos.ativoDialog.statusInativo') },
  { value: 'em_manutencao', label: t('contratosAtivos.ativoDialog.statusEmManutencao') },
  { value: 'descontinuado', label: t('contratosAtivos.ativoDialog.statusDescontinuado') },
];

const valoresNegocio = ['alto', 'medio', 'baixo'];

const AtivoDialog: React.FC<AtivoDialogProps> = ({ open, onOpenChange, formData, setFormData, onSubmit, isEditing }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('identificacao');
  const [initialSnapshot, setInitialSnapshot] = useState('');

  useEffect(() => {
    if (open) {
      setActiveTab('identificacao');
      setInitialSnapshot(JSON.stringify(formData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDirty = JSON.stringify(formData) !== initialSnapshot;

  const handleSubmit = () => {
    if (!formData.nome.trim() || !formData.tipo) {
      setActiveTab('identificacao');
      return;
    }
    // synthesize a fake form event
    onSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const update = (patch: Partial<AtivoFormData>) => setFormData((prev) => ({ ...prev, ...patch }));

  // 'complete' só com dados preenchidos pelo usuário (tipo/criticidade/status têm defaults).
  const identState: WizardTabState = formData.nome?.trim() && formData.descricao?.trim() ? 'complete' : (formData.nome?.trim() ? 'partial' : 'pending');
  const localState: WizardTabState = formData.proprietario || formData.localizacao ? 'complete' : 'pending';
  const classifState: WizardTabState = (typeof formData.tags === 'string' ? formData.tags.trim().length > 0 : false) ? 'complete' : 'pending';
  const aquisState: WizardTabState = formData.data_aquisicao || formData.fornecedor || formData.versao ? 'complete' : 'pending';

  const tipoLabel = tiposAtivo(t).find((tp) => tp.value === formData.tipo)?.label;

  const tabs: WizardTab[] = useMemo(
    () => [
      {
        id: 'identificacao',
        label: t('contratosAtivos.ativoDialog.tabIdentification'),
        icon: Box,
        state: identState,
        hint: t('contratosAtivos.ativoDialog.tabIdentificationHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('contratosAtivos.ativoDialog.labelName')} <span className="text-destructive">*</span>
                  <FieldHelpTooltip content={t('contratosAtivos.ativoDialog.nameHelp')} />
                </Label>
                <Input value={formData.nome} onChange={(e) => update({ nome: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('contratosAtivos.ativoDialog.labelType')} <span className="text-destructive">*</span>
                  <FieldHelpTooltip content={t('contratosAtivos.ativoDialog.typeHelp')} />
                </Label>
                <Select value={formData.tipo} onValueChange={(v) => update({ tipo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contratosAtivos.ativoDialog.typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAtivo(t).map((tp) => (
                      <SelectItem key={tp.value} value={tp.value}>
                        {tp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('contratosAtivos.ativoDialog.labelDescription')}</Label>
              <Textarea value={formData.descricao} onChange={(e) => update({ descricao: e.target.value })} rows={4} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelTags')}</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => update({ tags: e.target.value })}
                  placeholder={t('contratosAtivos.ativoDialog.tagsPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelQuantity')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) => update({ quantidade: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'localizacao',
        label: t('contratosAtivos.ativoDialog.tabLocation'),
        icon: MapPin,
        state: localState,
        hint: t('contratosAtivos.ativoDialog.tabLocationHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('contratosAtivos.ativoDialog.labelOwner')}
                  <FieldHelpTooltip content={t('contratosAtivos.ativoDialog.ownerHelp')} />
                </Label>
                <UserSelect
                  value={formData.proprietario}
                  onValueChange={(v) => update({ proprietario: v })}
                  placeholder={t('contratosAtivos.ativoDialog.ownerPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelLocation')}</Label>
                <LocalizacaoSelect value={formData.localizacao} onValueChange={(v) => update({ localizacao: v })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelClient')}</Label>
                <Input value={formData.cliente} onChange={(e) => update({ cliente: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelImei')}</Label>
                <Input value={formData.imei} onChange={(e) => update({ imei: e.target.value })} />
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'classificacao',
        label: t('contratosAtivos.ativoDialog.tabClassification'),
        icon: Settings2,
        state: classifState,
        hint: t('contratosAtivos.ativoDialog.tabClassificationHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('contratosAtivos.ativoDialog.labelCriticality')}
                  <FieldHelpTooltip content={t('contratosAtivos.ativoDialog.criticalityHelp')} />
                </Label>
                <Select value={formData.criticidade} onValueChange={(v) => update({ criticidade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {criticidades(t).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('contratosAtivos.ativoDialog.labelBusinessValue')}
                  <FieldHelpTooltip content={t('contratosAtivos.ativoDialog.businessValueHelp')} />
                </Label>
                <Select value={formData.valor_negocio} onValueChange={(v) => update({ valor_negocio: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contratosAtivos.ativoDialog.businessValuePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {valoresNegocio.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelStatus')}</Label>
                <Select value={formData.status} onValueChange={(v) => update({ status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions(t).map((st) => (
                      <SelectItem key={st.value} value={st.value}>
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'aquisicao',
        label: t('contratosAtivos.ativoDialog.tabAcquisition'),
        icon: FileText,
        state: aquisState,
        hint: t('contratosAtivos.ativoDialog.tabAcquisitionHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {t('contratosAtivos.ativoDialog.labelAcquisitionDate')}
                </Label>
                <Input
                  type="date"
                  value={formData.data_aquisicao}
                  onChange={(e) => update({ data_aquisicao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelSupplier')}</Label>
                <Input value={formData.fornecedor} onChange={(e) => update({ fornecedor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('contratosAtivos.ativoDialog.labelVersion')}</Label>
                <Input value={formData.versao} onChange={(e) => update({ versao: e.target.value })} />
              </div>
            </div>
          </div>
        ),
      },
    ],
    [formData, identState, localState, classifState, aquisState]
  );

  const summary = (
    <WizardSummaryCard title={t('contratosAtivos.ativoDialog.summaryTitle')}>
      <WizardSummaryRow label={t('contratosAtivos.ativoDialog.summaryName')} value={formData.nome || <span className="text-muted-foreground italic">{t('contratosAtivos.ativoDialog.summaryNoName')}</span>} highlight />
      <WizardSummaryRow label={t('contratosAtivos.ativoDialog.summaryType')} value={tipoLabel || <span className="text-muted-foreground italic">—</span>} />
      <WizardSummaryRow
        label={t('contratosAtivos.ativoDialog.summaryCriticality')}
        value={
          formData.criticidade
            ? <StatusBadge size="sm" {...resolveCriticidadeTone(formData.criticidade)}>{formatStatus(formData.criticidade)}</StatusBadge>
            : <span className="text-muted-foreground italic">—</span>
        }
      />
      <WizardSummaryRow label={t('contratosAtivos.ativoDialog.summaryStatus')} value={<span>{formatStatus(formData.status)}</span>} />
      <WizardSummaryRow label={t('contratosAtivos.ativoDialog.summaryQuantity')} value={formData.quantidade} />
    </WizardSummaryCard>
  );

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('contratosAtivos.ativoDialog.dialogTitleEdit') : t('contratosAtivos.ativoDialog.dialogTitleNew')}
      description={t('contratosAtivos.ativoDialog.dialogDescription')}
      icon={Box}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? t('contratosAtivos.ativoDialog.submitUpdate') : t('contratosAtivos.ativoDialog.submitCreate')}
      submitDisabled={!formData.nome.trim() || !formData.tipo}
      isDirty={isDirty}
      size="xl"
    />
  );
};

export default AtivoDialog;
