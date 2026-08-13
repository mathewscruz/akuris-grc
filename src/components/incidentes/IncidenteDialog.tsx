import { useEffect, useMemo, useState } from 'react';
import { UserSelect } from '@/components/riscos/UserSelect';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveCriticidadeTone } from '@/lib/status-tone';
import { CalendarIcon, Plus, AlertTriangle, Shield, Database, FileText, Users, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { WizardDialog, WizardTab, WizardTabState } from '@/components/ui/wizard-dialog';
import { WizardSummaryCard, WizardSummaryRow } from '@/components/ui/wizard-summary-card';
import { FieldHelpTooltip } from '@/components/ui/field-help-tooltip';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

const makeIncidenteSchema = (t: (key: string) => string) => z.object({
  titulo: z.string().min(1, t('modDialogs.incidentes.incidente.validation.tituloRequired')),
  descricao: z.string().optional(),
  tipo_incidente: z.string().min(1, t('modDialogs.incidentes.incidente.validation.tipoRequired')),
  categoria: z.string().optional(),
  criticidade: z.string().min(1, t('modDialogs.incidentes.incidente.validation.criticidadeRequired')),
  data_ocorrencia: z.date().optional(),
  origem_deteccao: z.string().optional(),
  responsavel_deteccao: z.string().optional(),
  responsavel_tratamento: z.string().optional(),
  impacto_estimado: z.string().optional(),
  dados_afetados: z.string().optional(),
  sistemas_afetados: z.array(z.string()).optional(),
  ativos_afetados: z.array(z.string()).optional(),
  riscos_relacionados: z.array(z.string()).optional(),
});

type IncidenteFormData = z.infer<ReturnType<typeof makeIncidenteSchema>>;

interface IncidenteDialogProps {
  incidente?: any;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}


export function IncidenteDialog({ incidente, onSuccess, trigger, externalOpen, onExternalOpenChange }: IncidenteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) onExternalOpenChange?.(value);
    else setInternalOpen(value);
  };
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('identificacao');
  const { toast } = useToast();
  const { notify } = useIntegrationNotify();
  const { t } = useLanguage();
  const incidenteSchema = useMemo(() => makeIncidenteSchema(t), [t]);

  const form = useForm<IncidenteFormData>({
    resolver: zodResolver(incidenteSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      tipo_incidente: 'seguranca',
      categoria: '',
      criticidade: 'media',
      origem_deteccao: '',
      responsavel_deteccao: '',
      responsavel_tratamento: '',
      impacto_estimado: '',
      dados_afetados: '',
      sistemas_afetados: [],
      ativos_afetados: [],
      riscos_relacionados: [],
    },
  });

  useEffect(() => {
    if (incidente) {
      form.reset({
        titulo: incidente.titulo || '',
        descricao: incidente.descricao || '',
        tipo_incidente: incidente.tipo_incidente || 'seguranca',
        categoria: incidente.categoria || '',
        criticidade: incidente.criticidade || 'media',
        data_ocorrencia: incidente.data_ocorrencia ? new Date(incidente.data_ocorrencia) : undefined,
        origem_deteccao: incidente.origem_deteccao || '',
        responsavel_deteccao: incidente.responsavel_deteccao || '',
        responsavel_tratamento: incidente.responsavel_tratamento || '',
        impacto_estimado: incidente.impacto_estimado || '',
        dados_afetados: incidente.dados_afetados || '',
        sistemas_afetados: incidente.sistemas_afetados || [],
        ativos_afetados: incidente.ativos_afetados || [],
        riscos_relacionados: incidente.riscos_relacionados || [],
      });
    }
    if (open) setActiveTab('identificacao');
  }, [incidente, open, form]);

  const watched = form.watch();
  const isDirty = form.formState.isDirty;
  const errors = form.formState.errors;

  const draftValues = useMemo(
    () => ({
      ...watched,
      data_ocorrencia: watched.data_ocorrencia?.toISOString() ?? null,
    }),
    [watched]
  );

  const { hasDraft, savedAt, loadDraft, clearDraft } = useWizardDraft({
    storageKey: 'incidente',
    recordId: incidente?.id,
    values: draftValues,
    enabled: open,
  });

  useEffect(() => {
    if (open && !incidente && hasDraft) {
      const d = loadDraft();
      if (d) {
        form.reset({
          ...d,
          data_ocorrencia: d.data_ocorrencia ? new Date(d.data_ocorrencia) : undefined,
        } as IncidenteFormData);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (data: IncidenteFormData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user?.id)
        .single();

      if (!profile?.empresa_id) {
        throw new Error(t('incidentesComp.incidente.toastErrorNoCompany'));
      }

      const incidenteData = {
        titulo: data.titulo!,
        descricao: data.descricao,
        tipo_incidente: data.tipo_incidente!,
        categoria: data.categoria,
        criticidade: data.criticidade!,
        data_ocorrencia: data.data_ocorrencia?.toISOString(),
        origem_deteccao: data.origem_deteccao,
        responsavel_deteccao: data.responsavel_deteccao || null,
        responsavel_tratamento: data.responsavel_tratamento || null,
        impacto_estimado: data.impacto_estimado,
        dados_afetados: data.dados_afetados,
        sistemas_afetados: data.sistemas_afetados,
        ativos_afetados: data.ativos_afetados,
        riscos_relacionados: data.riscos_relacionados,
        empresa_id: profile.empresa_id,
        created_by: userData.user?.id,
      };

      if (incidente) {
        const { error } = await supabase.from('incidentes').update(incidenteData).eq('id', incidente.id);
        if (error) throw error;
        toast({ title: t('incidentesComp.incidente.toastUpdated') });
      } else {
        const { error } = await supabase.from('incidentes').insert([incidenteData]);
        if (error) throw error;

        const gravidadeMap: Record<string, 'baixa' | 'media' | 'alta' | 'critica'> = {
          baixa: 'baixa',
          media: 'media',
          alta: 'alta',
          critica: 'critica',
        };

        await notify(
          data.criticidade === 'critica' ? 'incidente_critico' : 'incidente_criado',
          {
            titulo: `Novo Incidente: ${data.titulo}`,
            descricao: data.descricao || `Incidente de ${data.tipo_incidente} registrado`,
            link: `${window.location.origin}/incidentes`,
            gravidade: gravidadeMap[data.criticidade] || 'media',
            dados: { tipo: data.tipo_incidente, criticidade: data.criticidade },
          }
        );
        toast({ title: t('incidentesComp.incidente.toastCreated') });
      }

      clearDraft();
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({ title: t('incidentesComp.incidente.toastErrorTitle'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // 'complete' apenas com campos sem default preenchidos (tipo_incidente/criticidade têm defaults).
  const identState: WizardTabState =
    errors.titulo || errors.tipo_incidente || errors.criticidade
      ? 'error'
      : watched.titulo && watched.descricao
      ? 'complete'
      : watched.titulo
      ? 'partial'
      : 'pending';
  const detectState: WizardTabState = watched.origem_deteccao || watched.responsavel_deteccao || watched.data_ocorrencia ? 'complete' : 'pending';
  const impactoState: WizardTabState = watched.impacto_estimado || watched.dados_afetados ? 'complete' : 'pending';
  const tratamentoState: WizardTabState = watched.responsavel_tratamento ? 'complete' : 'pending';

  const tabs: WizardTab[] = useMemo(
    () => [
      {
        id: 'identificacao',
        label: t('incidentesComp.incidente.tabIdentificacao'),
        icon: AlertTriangle,
        state: identState,
        hint: t('incidentesComp.incidente.tabIdentificacaoHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    {t('incidentesComp.incidente.fieldTitulo')} <span className="text-destructive">*</span>
                    <FieldHelpTooltip content={t('incidentesComp.incidente.fieldTituloHelp')} />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t('incidentesComp.incidente.fieldTituloPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_incidente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      {t('incidentesComp.incidente.fieldTipo')} <span className="text-destructive">*</span>
                      <FieldHelpTooltip content={t('incidentesComp.incidente.fieldTipoHelp')} />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('incidentesComp.incidente.fieldTipoPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="seguranca">
                          <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t('incidentesComp.incidente.tipoSeguranca')}</div>
                        </SelectItem>
                        <SelectItem value="privacidade">
                          <div className="flex items-center gap-2"><Database className="h-4 w-4" /> {t('incidentesComp.incidente.tipoPrivacidade')}</div>
                        </SelectItem>
                        <SelectItem value="disponibilidade">
                          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {t('incidentesComp.incidente.tipoDisponibilidade')}</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="criticidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      {t('incidentesComp.incidente.fieldCriticidade')} <span className="text-destructive">*</span>
                      <FieldHelpTooltip content={t('incidentesComp.incidente.fieldCriticidadeHelp')} />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('incidentesComp.incidente.fieldCriticidadePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">{t('incidentesComp.incidente.criticidadeBaixa')}</SelectItem>
                        <SelectItem value="media">{t('incidentesComp.incidente.criticidadeMedia')}</SelectItem>
                        <SelectItem value="alta">{t('incidentesComp.incidente.criticidadeAlta')}</SelectItem>
                        <SelectItem value="critica">{t('incidentesComp.incidente.criticidadeCritica')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('incidentesComp.incidente.fieldCategoria')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('incidentesComp.incidente.fieldCategoriaPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_ocorrencia"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('incidentesComp.incidente.fieldDataOcorrencia')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>{t('incidentesComp.incidente.fieldDataOcorrenciaPlaceholder')}</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('incidentesComp.incidente.fieldDescricao')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('incidentesComp.incidente.fieldDescricaoPlaceholder')}
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ),
      },
      {
        id: 'deteccao',
        label: t('incidentesComp.incidente.tabDeteccao'),
        icon: FileText,
        state: detectState,
        hint: t('incidentesComp.incidente.tabDeteccaoHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="origem_deteccao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      {t('incidentesComp.incidente.fieldOrigemDeteccao')}
                      <FieldHelpTooltip content={t('incidentesComp.incidente.fieldOrigemDeteccaoHelp')} />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('incidentesComp.incidente.fieldOrigemDeteccaoPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="responsavel_deteccao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('incidentesComp.incidente.fieldResponsavelDeteccao')}</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder={t('incidentesComp.incidente.fieldResponsavelPlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ),
      },
      {
        id: 'impacto',
        label: t('incidentesComp.incidente.tabImpacto'),
        icon: Layers,
        state: impactoState,
        hint: t('incidentesComp.incidente.tabImpactoHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <FormField
              control={form.control}
              name="impacto_estimado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    {t('incidentesComp.incidente.fieldImpactoEstimado')}
                    <FieldHelpTooltip content={t('incidentesComp.incidente.fieldImpactoEstimadoHelp')} />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t('incidentesComp.incidente.fieldImpactoEstimadoPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dados_afetados"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    {t('incidentesComp.incidente.fieldDadosAfetados')}
                    <FieldHelpTooltip content={t('incidentesComp.incidente.fieldDadosAfetadosHelp')} />
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('incidentesComp.incidente.fieldDadosAfetadosPlaceholder')}
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ),
      },
      {
        id: 'tratamento',
        label: t('incidentesComp.incidente.tabTratamento'),
        icon: Users,
        state: tratamentoState,
        hint: t('incidentesComp.incidente.tabTratamentoHint'),
        content: (
          <div className="space-y-5 max-w-3xl">
            <FormField
              control={form.control}
              name="responsavel_tratamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    {t('incidentesComp.incidente.fieldResponsavelTratamento')}
                    <FieldHelpTooltip content={t('incidentesComp.incidente.fieldResponsavelTratamentoHelp')} />
                  </FormLabel>
                  <FormControl>
                    <UserSelect
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      placeholder={t('incidentesComp.incidente.fieldResponsavelPlaceholder')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ),
      },
    ],
    [form, identState, detectState, impactoState, tratamentoState, watched]
  );

  const summary = (
    <WizardSummaryCard title={t('incidentesComp.incidente.summaryTitle')}>
      <WizardSummaryRow
        label={t('incidentesComp.incidente.summaryTitulo')}
        value={watched.titulo || <span className="text-muted-foreground italic">{t('incidentesComp.incidente.summarySemTitulo')}</span>}
        highlight
      />
      <WizardSummaryRow
        label={t('incidentesComp.incidente.summaryTipo')}
        value={t(`incidentesComp.incidente.tipo${watched.tipo_incidente ? watched.tipo_incidente.charAt(0).toUpperCase() + watched.tipo_incidente.slice(1) : ''}`) || '—'}
      />
      <WizardSummaryRow
        label={t('incidentesComp.incidente.summaryCriticidade')}
        value={
          <StatusBadge size="sm" {...resolveCriticidadeTone(watched.criticidade)}>
            {formatStatus(watched.criticidade)}
          </StatusBadge>
        }
      />
      <WizardSummaryRow
        label={t('incidentesComp.incidente.summaryData')}
        value={watched.data_ocorrencia ? format(watched.data_ocorrencia, 'dd/MM/yyyy') : <span className="text-muted-foreground italic">—</span>}
      />
    </WizardSummaryCard>
  );

  const draftLabel =
    !incidente && hasDraft && savedAt
      ? t('incidentesComp.incidente.draftSavedAt', { time: new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
      : undefined;

  return (
    <Form {...form}>
      {!isControlled && (
        <Dialog>
          <DialogTrigger asChild>
            {trigger || (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('incidentesComp.incidente.newButton')}
              </Button>
            )}
          </DialogTrigger>
        </Dialog>
      )}
      <WizardDialog
        open={open}
        onOpenChange={setOpen}
        title={incidente ? t('incidentesComp.incidente.titleEdit') : t('incidentesComp.incidente.titleNew')}
        description={
          incidente ? t('incidentesComp.incidente.descEdit') : t('incidentesComp.incidente.descNew')
        }
        icon={AlertTriangle}
        tabs={tabs}
        summary={summary}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={incidente ? t('incidentesComp.incidente.submitUpdate') : t('incidentesComp.incidente.submitCreate')}
        isSubmitting={loading}
        isDirty={isDirty}
        draftLabel={draftLabel}
        size="xl"
      />
    </Form>
  );
}
