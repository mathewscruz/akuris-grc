import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ClipboardList, Settings2, Link2, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserSelect } from '@/components/riscos/UserSelect';
import { WizardDialog, WizardTab, WizardTabState } from '@/components/ui/wizard-dialog';
import { WizardSummaryCard, WizardSummaryRow } from '@/components/ui/wizard-summary-card';
import { FieldHelpTooltip } from '@/components/ui/field-help-tooltip';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { formatStatus } from '@/lib/text-utils';

interface PlanoAcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  plano?: any;
  loading?: boolean;
}

const modulosOrigem = [
  { value: 'manual', label: 'Manual' },
  { value: 'riscos', label: 'Riscos' },
  { value: 'controles', label: 'Controles' },
  { value: 'frameworks', label: 'Frameworks' },
  { value: 'incidentes', label: 'Incidentes' },
  { value: 'auditorias', label: 'Auditorias' },
  { value: 'contratos', label: 'Contratos' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'dados', label: 'Privacidade' },
  { value: 'due-diligence', label: 'Due Diligence' },
  { value: 'denuncia', label: 'Denúncia' },
  { value: 'ativos', label: 'Ativos' },
  { value: 'contas-privilegiadas', label: 'Contas Privilegiadas' },
];

const PRIORIDADE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  baixa: 'outline',
  media: 'secondary',
  alta: 'default',
  critica: 'destructive',
};

export function PlanoAcaoDialog({ open, onOpenChange, onSave, plano, loading }: PlanoAcaoDialogProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState('pendente');
  const [prioridade, setPrioridade] = useState('media');
  const [responsavelId, setResponsavelId] = useState('');
  const [prazo, setPrazo] = useState<Date | undefined>();
  const [moduloOrigem, setModuloOrigem] = useState('manual');
  const [registroOrigemTitulo, setRegistroOrigemTitulo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [activeTab, setActiveTab] = useState('identificacao');
  const [initialSnapshot, setInitialSnapshot] = useState('');

  useEffect(() => {
    if (plano) {
      setTitulo(plano.titulo || '');
      setDescricao(plano.descricao || '');
      setStatus(plano.status || 'pendente');
      setPrioridade(plano.prioridade || 'media');
      setResponsavelId(plano.responsavel_id || '');
      setPrazo(plano.prazo ? new Date(plano.prazo) : undefined);
      setModuloOrigem(plano.modulo_origem || 'manual');
      setRegistroOrigemTitulo(plano.registro_origem_titulo || '');
      setObservacoes(plano.observacoes || '');
    } else {
      setTitulo('');
      setDescricao('');
      setStatus('pendente');
      setPrioridade('media');
      setResponsavelId('');
      setPrazo(undefined);
      setModuloOrigem('manual');
      setRegistroOrigemTitulo('');
      setObservacoes('');
    }
    setActiveTab('identificacao');
  }, [plano, open]);

  useEffect(() => {
    if (open) {
      setInitialSnapshot(
        JSON.stringify({ titulo, descricao, status, prioridade, responsavelId, prazo: prazo?.toISOString() ?? null, moduloOrigem, registroOrigemTitulo, observacoes })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentValues = {
    titulo, descricao, status, prioridade, responsavelId,
    prazo: prazo?.toISOString() ?? null,
    moduloOrigem, registroOrigemTitulo, observacoes,
  };
  const isDirty = JSON.stringify(currentValues) !== initialSnapshot;

  const { hasDraft, savedAt, loadDraft, clearDraft } = useWizardDraft({
    storageKey: 'plano-acao',
    recordId: plano?.id,
    values: currentValues,
    enabled: open,
  });

  useEffect(() => {
    if (open && !plano && hasDraft) {
      const d = loadDraft();
      if (d) {
        setTitulo(d.titulo ?? '');
        setDescricao(d.descricao ?? '');
        setStatus(d.status ?? 'pendente');
        setPrioridade(d.prioridade ?? 'media');
        setResponsavelId(d.responsavelId ?? '');
        setPrazo(d.prazo ? new Date(d.prazo) : undefined);
        setModuloOrigem(d.moduloOrigem ?? 'manual');
        setRegistroOrigemTitulo(d.registroOrigemTitulo ?? '');
        setObservacoes(d.observacoes ?? '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    if (!titulo.trim()) {
      setActiveTab('identificacao');
      return;
    }
    onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      status,
      prioridade,
      responsavel_id: responsavelId || null,
      prazo: prazo ? format(prazo, 'yyyy-MM-dd') : null,
      modulo_origem: moduloOrigem,
      registro_origem_titulo: registroOrigemTitulo.trim() || null,
      observacoes: observacoes.trim() || null,
    });
    clearDraft();
  };

  // 'complete' apenas quando há dados além dos defaults (status/prioridade/moduloOrigem têm defaults).
  const identState: WizardTabState = titulo.trim() && descricao.trim() ? 'complete' : (titulo.trim() ? 'partial' : 'pending');
  const planejamentoState: WizardTabState = responsavelId && prazo ? 'complete' : (responsavelId || prazo ? 'partial' : 'pending');
  const origemState: WizardTabState = moduloOrigem !== 'manual' && registroOrigemTitulo.trim() ? 'complete' : (observacoes.trim() ? 'complete' : 'pending');

  const tabs: WizardTab[] = useMemo(
    () => [
      {
        id: 'identificacao',
        label: 'Identificação',
        icon: ClipboardList,
        state: identState,
        hint: 'Título e descrição',
        content: (
          <div className="space-y-5 max-w-2xl">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Título <span className="text-destructive">*</span>
                <FieldHelpTooltip content="Descreva a ação de forma curta e acionável. Ex: 'Implementar MFA no Office 365'." />
              </Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Descreva a ação necessária" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes da ação, contexto e critérios de sucesso" rows={5} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Notas adicionais" rows={3} />
            </div>
          </div>
        ),
      },
      {
        id: 'planejamento',
        label: 'Planejamento',
        icon: Settings2,
        state: planejamentoState,
        hint: 'Responsável, prazo e prioridade',
        content: (
          <div className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Prioridade
                  <FieldHelpTooltip content="Classifique conforme a urgência e impacto." />
                </Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Responsável
                  <FieldHelpTooltip content="Pessoa responsável pela execução desta ação." />
                </Label>
                <UserSelect value={responsavelId} onValueChange={setResponsavelId} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Prazo
                  <FieldHelpTooltip content="Data limite para conclusão." />
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !prazo && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {prazo ? format(prazo, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={prazo} onSelect={setPrazo} locale={ptBR} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'origem',
        label: 'Origem',
        icon: Link2,
        state: origemState,
        hint: 'Módulo e referência',
        content: (
          <div className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Módulo de Origem
                  <FieldHelpTooltip content="De onde esta ação foi originada (risco, controle, auditoria, etc.). Use 'Manual' para ações criadas diretamente." />
                </Label>
                <Select value={moduloOrigem} onValueChange={setModuloOrigem}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modulosOrigem.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {moduloOrigem !== 'manual' && (
                <div className="space-y-2">
                  <Label>Referência (título do item)</Label>
                  <Input
                    value={registroOrigemTitulo}
                    onChange={(e) => setRegistroOrigemTitulo(e.target.value)}
                    placeholder="Ex: Risco de vazamento de dados"
                  />
                </div>
              )}
            </div>
          </div>
        ),
      },
    ],
    [titulo, descricao, prioridade, status, responsavelId, prazo, moduloOrigem, registroOrigemTitulo, observacoes, identState, planejamentoState, origemState]
  );

  const summary = (
    <WizardSummaryCard title="Resumo do Plano">
      <WizardSummaryRow label="Título" value={titulo || <span className="text-muted-foreground italic">Sem título</span>} highlight />
      <WizardSummaryRow
        label="Prioridade"
        value={<Badge variant={PRIORIDADE_VARIANT[prioridade]} className="text-[10px]">{formatStatus(prioridade)}</Badge>}
      />
      <WizardSummaryRow label="Status" value={<span>{formatStatus(status)}</span>} />
      <WizardSummaryRow
        label="Prazo"
        value={prazo ? format(prazo, 'dd/MM/yyyy') : <span className="text-muted-foreground italic">—</span>}
      />
      <WizardSummaryRow
        label="Origem"
        value={modulosOrigem.find((m) => m.value === moduloOrigem)?.label}
      />
    </WizardSummaryCard>
  );

  const draftLabel = !plano && hasDraft && savedAt
    ? `Rascunho salvo às ${new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plano ? 'Editar Plano de Ação' : 'Novo Plano de Ação'}
      description="Defina identificação, planejamento e origem do plano."
      icon={Target}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSave}
      submitLabel={plano ? 'Salvar' : 'Criar'}
      isSubmitting={loading}
      submitDisabled={!titulo.trim() || loading}
      isDirty={isDirty}
      draftLabel={draftLabel}
      size="lg"
    />
  );
}
