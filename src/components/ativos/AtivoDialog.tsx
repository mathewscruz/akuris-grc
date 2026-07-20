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

const tiposAtivo = [
  { value: 'servidor', label: 'Servidor' },
  { value: 'aplicacao', label: 'Aplicação' },
  { value: 'banco_dados', label: 'Banco de Dados' },
  { value: 'rede', label: 'Equipamento de Rede' },
  { value: 'endpoint', label: 'Endpoint' },
  { value: 'dispositivo_movel', label: 'Dispositivo Móvel' },
  { value: 'armazenamento', label: 'Armazenamento' },
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'almoxarifado_equipamento', label: 'Equipamento de Almoxarifado' },
  { value: 'almoxarifado_ferramenta', label: 'Ferramenta' },
  { value: 'almoxarifado_material', label: 'Material de Consumo' },
  { value: 'almoxarifado_epi', label: 'Equipamento de Proteção Individual' },
  { value: 'mobiliario', label: 'Mobiliário' },
  { value: 'equipamento_escritorio', label: 'Equipamento de Escritório' },
  { value: 'equipamento_comunicacao', label: 'Equipamento de Comunicação' },
  { value: 'material_escritorio', label: 'Material de Escritório' },
  { value: 'veiculo_terrestre', label: 'Veículo Terrestre' },
  { value: 'veiculo_aereo', label: 'Veículo Aéreo' },
  { value: 'maquina_pesada', label: 'Máquina Pesada' },
  { value: 'equipamento_transporte', label: 'Equipamento de Transporte' },
  { value: 'imovel', label: 'Imóvel' },
  { value: 'estrutura_fisica', label: 'Estrutura Física' },
  { value: 'instalacao_eletrica', label: 'Instalação Elétrica' },
  { value: 'instalacao_hidraulica', label: 'Instalação Hidráulica' },
  { value: 'equipamento_seguranca', label: 'Equipamento de Segurança' },
  { value: 'sistema_monitoramento', label: 'Sistema de Monitoramento' },
  { value: 'controle_acesso', label: 'Controle de Acesso' },
  { value: 'equipamento_bombeiro', label: 'Equipamento de Combate a Incêndio' },
  { value: 'maquina_producao', label: 'Máquina de Produção' },
  { value: 'ferramenta_producao', label: 'Ferramenta de Produção' },
  { value: 'equipamento_medicao', label: 'Equipamento de Medição' },
  { value: 'equipamento_teste', label: 'Equipamento de Teste' },
  { value: 'equipamento_medico', label: 'Equipamento Médico' },
  { value: 'equipamento_laboratorio', label: 'Equipamento de Laboratório' },
  { value: 'outros', label: 'Outros' },
];

const criticidades = [
  { value: 'critico', label: 'Crítico' },
  { value: 'alto', label: 'Alto' },
  { value: 'medio', label: 'Médio' },
  { value: 'baixo', label: 'Baixo' },
];

const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'em_manutencao', label: 'Em Manutenção' },
  { value: 'descontinuado', label: 'Descontinuado' },
];

const valoresNegocio = ['alto', 'medio', 'baixo'];

const AtivoDialog: React.FC<AtivoDialogProps> = ({ open, onOpenChange, formData, setFormData, onSubmit, isEditing }) => {
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

  const tipoLabel = tiposAtivo.find((t) => t.value === formData.tipo)?.label;

  const tabs: WizardTab[] = useMemo(
    () => [
      {
        id: 'identificacao',
        label: 'Identificação',
        icon: Box,
        state: identState,
        hint: 'Nome, tipo e descrição',
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Nome <span className="text-destructive">*</span>
                  <FieldHelpTooltip content="Nome único do ativo. Ex: 'Servidor de Produção SRV-01'." />
                </Label>
                <Input value={formData.nome} onChange={(e) => update({ nome: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Tipo <span className="text-destructive">*</span>
                  <FieldHelpTooltip content="Categoria principal do ativo (servidor, software, mobiliário, etc.)." />
                </Label>
                <Select value={formData.tipo} onValueChange={(v) => update({ tipo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAtivo.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.descricao} onChange={(e) => update({ descricao: e.target.value })} rows={4} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => update({ tags: e.target.value })}
                  placeholder="Ex: servidor, crítico, backup"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
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
        label: 'Localização & Posse',
        icon: MapPin,
        state: localState,
        hint: 'Onde está e quem é o dono',
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Proprietário
                  <FieldHelpTooltip content="Pessoa responsável pela manutenção, uso e decisões sobre o ativo." />
                </Label>
                <UserSelect
                  value={formData.proprietario}
                  onValueChange={(v) => update({ proprietario: v })}
                  placeholder="Selecionar proprietário..."
                />
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <LocalizacaoSelect value={formData.localizacao} onValueChange={(v) => update({ localizacao: v })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={formData.cliente} onChange={(e) => update({ cliente: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>IMEI / Identificador</Label>
                <Input value={formData.imei} onChange={(e) => update({ imei: e.target.value })} />
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'classificacao',
        label: 'Classificação',
        icon: Settings2,
        state: classifState,
        hint: 'Criticidade e valor',
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Criticidade
                  <FieldHelpTooltip content="Quanto a indisponibilidade deste ativo afeta o negócio." />
                </Label>
                <Select value={formData.criticidade} onValueChange={(v) => update({ criticidade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {criticidades.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Valor de Negócio
                  <FieldHelpTooltip content="Importância estratégica do ativo para os processos da organização." />
                </Label>
                <Select value={formData.valor_negocio} onValueChange={(v) => update({ valor_negocio: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
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
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => update({ status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
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
        label: 'Aquisição',
        icon: FileText,
        state: aquisState,
        hint: 'Fornecedor, data, versão',
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Data de Aquisição
                </Label>
                <Input
                  type="date"
                  value={formData.data_aquisicao}
                  onChange={(e) => update({ data_aquisicao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={formData.fornecedor} onChange={(e) => update({ fornecedor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Versão</Label>
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
    <WizardSummaryCard title="Resumo do Ativo">
      <WizardSummaryRow label="Nome" value={formData.nome || <span className="text-muted-foreground italic">Sem nome</span>} highlight />
      <WizardSummaryRow label="Tipo" value={tipoLabel || <span className="text-muted-foreground italic">—</span>} />
      <WizardSummaryRow
        label="Criticidade"
        value={
          formData.criticidade
            ? <StatusBadge size="sm" {...resolveCriticidadeTone(formData.criticidade)}>{formatStatus(formData.criticidade)}</StatusBadge>
            : <span className="text-muted-foreground italic">—</span>
        }
      />
      <WizardSummaryRow label="Status" value={<span>{formatStatus(formData.status)}</span>} />
      <WizardSummaryRow label="Quantidade" value={formData.quantidade} />
    </WizardSummaryCard>
  );

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar Ativo' : 'Novo Ativo'}
      description="Preencha as seções para cadastrar o ativo na plataforma."
      icon={Box}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Atualizar Ativo' : 'Criar Ativo'}
      submitDisabled={!formData.nome.trim() || !formData.tipo}
      isDirty={isDirty}
      size="xl"
    />
  );
};

export default AtivoDialog;
