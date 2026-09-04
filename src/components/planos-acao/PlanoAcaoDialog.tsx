import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateField } from '@/components/ui/date-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolvePrioridadeTone } from '@/lib/status-tone';
import { formatDateOnly, intlLocale } from '@/lib/date-utils';
import { UserSelect } from '@/components/riscos/UserSelect';
import { WizardDialog, WizardTab, WizardTabState } from '@/components/ui/wizard-dialog';
import { WizardSummaryCard, WizardSummaryRow } from '@/components/ui/wizard-summary-card';
import { FieldHelpTooltip } from '@/components/ui/field-help-tooltip';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { EntidadeSelect } from '@/components/common/EntidadeSelect';
import type { EntityKey } from '@/lib/entity-search';
import { IconChecklist, IconSettings, IconLink, IconTarget } from '@/components/icons';

/** Módulo de origem → entidade pesquisável (seletor real, sem UUID à mão). */
const MODULO_ENTIDADE: Record<string, EntityKey> = {
  riscos: 'risco',
  controles: 'controle',
  frameworks: 'gap_requirement',
  incidentes: 'incidente',
  auditorias: 'auditoria',
  contratos: 'contrato',
  documentos: 'documento',
  dados: 'dados_pessoais',
  'due-diligence': 'due_diligence',
  denuncia: 'denuncia',
  ativos: 'ativo',
  'contas-privilegiadas': 'conta_privilegiada',
};

interface PlanoAcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  plano?: any;
  loading?: boolean;
  /** Pré-preenche a origem quando a ação é criada a partir de um registo. */
  origemInicial?: { modulo: string; registroId: string; registroTitulo: string };
  /**
   * Título e descrição já escritos, para criação a partir de um contexto.
   *
   * Não confundir com `plano`: passar `plano` põe o diálogo em modo de
   * EDIÇÃO — muda o cabeçalho para "Editar" e ignora `origemInicial`. Quem
   * cria um plano a partir de um grupo de requisitos quer criar, com o texto
   * já preenchido, e continuar a poder mudá-lo.
   */
  rascunho?: { titulo?: string; descricao?: string };
}

function buildModulosOrigem(t: (key: string) => string) {
  return [
    { value: 'manual', label: t('planosAcao.moduleManual') },
    { value: 'riscos', label: t('planosAcao.moduleRiscos') },
    { value: 'controles', label: t('planosAcao.moduleControles') },
    { value: 'frameworks', label: t('planosAcao.moduleFrameworks') },
    { value: 'incidentes', label: t('planosAcao.moduleIncidentes') },
    { value: 'auditorias', label: t('planosAcao.moduleAuditorias') },
    { value: 'contratos', label: t('planosAcao.moduleContratos') },
    { value: 'documentos', label: t('planosAcao.moduleDocumentos') },
    { value: 'dados', label: t('planosAcao.moduleDados') },
    { value: 'due-diligence', label: t('planosAcao.moduleDueDiligence') },
    { value: 'denuncia', label: t('planosAcao.moduleDenuncia') },
    { value: 'ativos', label: t('planosAcao.moduleAtivos') },
    { value: 'contas-privilegiadas', label: t('planosAcao.moduleContasPrivilegiadasOption') },
  ];
}

export function PlanoAcaoDialog({ open, onOpenChange, onSave, plano, loading, origemInicial, rascunho }: PlanoAcaoDialogProps) {
  const { t } = useLanguage();
  const modulosOrigem = useMemo(() => buildModulosOrigem(t), [t]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState('pendente');
  const [prioridade, setPrioridade] = useState('media');
  const [responsavelId, setResponsavelId] = useState('');
  const [prazo, setPrazo] = useState<string | null>(null);
  const [moduloOrigem, setModuloOrigem] = useState('manual');
  const [registroOrigemTitulo, setRegistroOrigemTitulo] = useState('');
  const [registroOrigemId, setRegistroOrigemId] = useState('');
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
      setPrazo(plano.prazo || null);
      setModuloOrigem(plano.modulo_origem || 'manual');
      setRegistroOrigemTitulo(plano.registro_origem_titulo || '');
      setRegistroOrigemId(plano.registro_origem_id || '');
      setObservacoes(plano.observacoes || '');
    } else {
      setTitulo(rascunho?.titulo ?? '');
      setDescricao(rascunho?.descricao ?? '');
      setStatus('pendente');
      setPrioridade('media');
      setResponsavelId('');
      setPrazo(null);
      setModuloOrigem(origemInicial?.modulo ?? 'manual');
      setRegistroOrigemTitulo(origemInicial?.registroTitulo ?? '');
      setRegistroOrigemId(origemInicial?.registroId ?? '');
      setObservacoes('');
    }
    setActiveTab('identificacao');
  }, [plano, open, origemInicial, rascunho]);

  useEffect(() => {
    if (open) {
      setInitialSnapshot(
        JSON.stringify({ titulo, descricao, status, prioridade, responsavelId, prazo, moduloOrigem, registroOrigemTitulo, registroOrigemId, observacoes })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentValues = {
    titulo, descricao, status, prioridade, responsavelId,
    prazo,
    moduloOrigem, registroOrigemTitulo, registroOrigemId, observacoes,
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
        setPrazo(d.prazo ?? null);
        setModuloOrigem(d.moduloOrigem ?? 'manual');
        setRegistroOrigemTitulo(d.registroOrigemTitulo ?? '');
        setRegistroOrigemId(d.registroOrigemId ?? '');
        setObservacoes(d.observacoes ?? '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Trocar de módulo invalida o registo escolhido anteriormente. */
  const handleModuloOrigemChange = (value: string) => {
    setModuloOrigem(value);
    setRegistroOrigemId('');
    setRegistroOrigemTitulo('');
  };

  const [showTitleError, setShowTitleError] = useState(false);

  /** DEFECT 5 — bloqueia avançar/trocar de aba enquanto a etapa de
   * Identificação tiver campos obrigatórios por preencher, assinalando o
   * erro inline e marcando a etapa como 'error' na barra lateral. */
  const canAdvance = (fromId: string) => {
    if (fromId === 'identificacao' && !titulo.trim()) {
      setShowTitleError(true);
      return false;
    }
    return true;
  };

  const missingFields: string[] = [];
  if (!titulo.trim()) missingFields.push(t('planosAcaoWizard.missingFieldTitle'));
  const submitBlockedReason = missingFields.length > 0
    ? `${t('planosAcaoWizard.missingFieldsPrefix')}: ${missingFields.join(', ')}`
    : undefined;

  const handleSave = () => {
    if (!titulo.trim()) {
      setShowTitleError(true);
      setActiveTab('identificacao');
      return;
    }
    onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      status,
      prioridade,
      responsavel_id: responsavelId || null,
      prazo: prazo || null,
      modulo_origem: moduloOrigem,
      registro_origem_titulo: registroOrigemTitulo.trim() || null,
      registro_origem_id: registroOrigemId || null,
      observacoes: observacoes.trim() || null,
    });
    clearDraft();
  };

  // 'complete' apenas quando há dados além dos defaults (status/prioridade/moduloOrigem têm defaults).
  const identState: WizardTabState = showTitleError && !titulo.trim()
    ? 'error'
    : titulo.trim() && descricao.trim() ? 'complete' : (titulo.trim() ? 'partial' : 'pending');
  const planejamentoState: WizardTabState = responsavelId && prazo ? 'complete' : (responsavelId || prazo ? 'partial' : 'pending');
  const origemState: WizardTabState = moduloOrigem !== 'manual' && registroOrigemId ? 'complete' : (observacoes.trim() ? 'complete' : 'pending');

  const tabs: WizardTab[] = useMemo(
    () => [
      {
        id: 'identificacao',
        label: t('planosAcao.tabIdentification'),
        icon: IconChecklist,
        state: identState,
        hint: t('planosAcao.tabIdentificationHint'),
        content: (
          <div className="space-y-5 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="titulo" className="flex items-center gap-1">
                {t('planosAcao.fieldTitle')} <span className="text-destructive">*</span>
                <FieldHelpTooltip content={t('planosAcao.fieldTitleHelp')} />
              </Label>
              <Input id="titulo"
                value={titulo}
                onChange={(e) => { setTitulo(e.target.value); if (e.target.value.trim()) setShowTitleError(false); }}
                placeholder={t('planosAcao.fieldTitlePlaceholder')}
                aria-invalid={showTitleError && !titulo.trim()}
                className={showTitleError && !titulo.trim() ? 'border-destructive focus-visible:ring-destructive' : undefined}
              />
              {showTitleError && !titulo.trim() && (
                <p className="text-xs text-destructive">{t('planosAcaoWizard.titleRequiredError')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">{t('planosAcao.fieldDescription')}</Label>
              <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t('planosAcao.fieldDescriptionPlaceholder')} rows={5} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">{t('planosAcao.fieldObservations')}</Label>
              <Textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder={t('planosAcao.fieldObservationsPlaceholder')} rows={3} />
            </div>
          </div>
        ),
      },
      {
        id: 'planejamento',
        label: t('planosAcao.tabPlanning'),
        icon: IconSettings,
        state: planejamentoState,
        hint: t('planosAcao.tabPlanningHint'),
        content: (
          <div className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('planosAcao.fieldPriority')}
                  <FieldHelpTooltip content={t('planosAcao.fieldPriorityHelp')} />
                </Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">{t('planosAcao.priorityBaixa')}</SelectItem>
                    <SelectItem value="media">{t('planosAcao.priorityMedia')}</SelectItem>
                    <SelectItem value="alta">{t('planosAcao.priorityAlta')}</SelectItem>
                    <SelectItem value="critica">{t('planosAcao.priorityCritica')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('planosAcao.fieldStatus')}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">{t('planosAcao.statusPendente')}</SelectItem>
                    <SelectItem value="em_andamento">{t('planosAcao.statusEmAndamento')}</SelectItem>
                    <SelectItem value="concluido">{t('planosAcao.statusConcluido')}</SelectItem>
                    <SelectItem value="cancelado">{t('planosAcao.statusCancelado')}</SelectItem>
                    <SelectItem value="atrasado">{t('planosAcao.statusAtrasado')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('planosAcao.fieldResponsible')}
                  <FieldHelpTooltip content={t('planosAcao.fieldResponsibleHelp')} />
                </Label>
                <UserSelect value={responsavelId} onValueChange={setResponsavelId} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('planosAcao.fieldDeadline')}
                  <FieldHelpTooltip content={t('planosAcao.fieldDeadlineHelp')} />
                </Label>
                <DateField
                  value={prazo}
                  onChange={setPrazo}
                  placeholder={t('planosAcao.fieldDeadlinePlaceholder')}
                />

              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'origem',
        label: t('planosAcao.tabOrigin'),
        icon: IconLink,
        state: origemState,
        hint: t('planosAcao.tabOriginHint'),
        content: (
          <div className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {t('planosAcao.fieldOriginModule')}
                  <FieldHelpTooltip content={t('planosAcao.fieldOriginModuleHelp')} />
                </Label>
                <Select value={moduloOrigem} onValueChange={handleModuloOrigemChange}>
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
              {moduloOrigem !== 'manual' && MODULO_ENTIDADE[moduloOrigem] && (
                <div className="space-y-2">
                  <Label>{t('planosAcao.fieldOriginReference')}</Label>
                  {/* Guarda a chave estrangeira do registo — nunca texto livre. */}
                  <EntidadeSelect
                    entidade={MODULO_ENTIDADE[moduloOrigem]}
                    value={registroOrigemId}
                    onValueChange={(id, row) => {
                      setRegistroOrigemId(id);
                      setRegistroOrigemTitulo(row ? `${row.codigo} · ${row.titulo}` : '');
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ),
      },
    ],
    [titulo, descricao, prioridade, status, responsavelId, prazo, moduloOrigem, registroOrigemTitulo, registroOrigemId, observacoes, identState, planejamentoState, origemState, t, modulosOrigem]
  );

  const summary = (
    <WizardSummaryCard title={t('planosAcao.summaryTitle')}>
      <WizardSummaryRow label={t('planosAcao.summaryLabelTitle')} value={titulo || <span className="text-muted-foreground italic">{t('planosAcao.summaryNoTitle')}</span>} highlight />
      <WizardSummaryRow
        label={t('planosAcao.summaryLabelPriority')}
        value={
          <StatusBadge {...resolvePrioridadeTone(prioridade)}>
            {prioridade === 'baixa'
              ? t('planosAcao.priorityBaixa')
              : prioridade === 'alta'
                ? t('planosAcao.priorityAlta')
                : prioridade === 'critica'
                  ? t('planosAcao.priorityCritica')
                  : t('planosAcao.priorityMedia')}
          </StatusBadge>
        }
      />
      <WizardSummaryRow label={t('planosAcao.summaryLabelStatus')} value={<span>{formatStatus(status)}</span>} />
      <WizardSummaryRow
        label={t('planosAcao.summaryLabelDeadline')}
        value={prazo ? formatDateOnly(prazo) : <span className="text-muted-foreground italic">{t('planosAcao.summaryNoDeadline')}</span>}
      />
      <WizardSummaryRow
        label={t('planosAcao.summaryLabelOrigin')}
        value={
          registroOrigemTitulo
            ? `${modulosOrigem.find((m) => m.value === moduloOrigem)?.label} · ${registroOrigemTitulo}`
            : modulosOrigem.find((m) => m.value === moduloOrigem)?.label
        }
      />
    </WizardSummaryCard>
  );

  const draftLabel = !plano && hasDraft && savedAt
    ? t('planosAcao.draftSavedAt', { time: new Date(savedAt).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' }) })
    : undefined;

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plano ? t('planosAcao.dialogTitleEdit') : t('planosAcao.dialogTitleNew')}
      description={t('planosAcao.dialogDescription')}
      icon={IconTarget}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSave}
      submitLabel={plano ? t('planosAcao.submitLabelSave') : t('planosAcao.submitLabelCreate')}
      isSubmitting={loading}
      submitDisabled={!titulo.trim() || loading}
      submitBlockedReason={submitBlockedReason}
      canAdvance={canAdvance}
      isDirty={isDirty}
      draftLabel={draftLabel}
      size="lg"
    />
  );
}
