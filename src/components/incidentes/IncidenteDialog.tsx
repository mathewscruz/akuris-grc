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
import { Badge } from '@/components/ui/badge';
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

const incidenteSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional(),
  tipo_incidente: z.string().min(1, 'Tipo de incidente é obrigatório'),
  categoria: z.string().optional(),
  criticidade: z.string().min(1, 'Criticidade é obrigatória'),
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

type IncidenteFormData = z.infer<typeof incidenteSchema>;

interface IncidenteDialogProps {
  incidente?: any;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

const CRITICIDADE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  baixa: 'outline',
  media: 'secondary',
  alta: 'default',
  critica: 'destructive',
};

const TIPO_LABELS: Record<string, string> = {
  seguranca: 'Segurança',
  privacidade: 'Privacidade',
  disponibilidade: 'Disponibilidade',
};

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
        throw new Error('Não foi possível identificar a empresa do usuário. Faça login novamente.');
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
        toast({ title: 'Incidente atualizado com sucesso!' });
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
        toast({ title: 'Incidente registrado com sucesso!' });
      }

      clearDraft();
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
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
        label: 'Identificação',
        icon: AlertTriangle,
        state: identState,
        hint: 'Título, tipo, criticidade',
        content: (
          <div className="space-y-5 max-w-3xl">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Título do Incidente <span className="text-destructive">*</span>
                    <FieldHelpTooltip content="Resumo curto e direto do que aconteceu. Ex: 'Tentativa de phishing reportada por usuário'." />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Descreva brevemente o incidente" {...field} />
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
                      Tipo <span className="text-destructive">*</span>
                      <FieldHelpTooltip content="Classifique o domínio principal do incidente." />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="seguranca">
                          <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Segurança</div>
                        </SelectItem>
                        <SelectItem value="privacidade">
                          <div className="flex items-center gap-2"><Database className="h-4 w-4" /> Privacidade</div>
                        </SelectItem>
                        <SelectItem value="disponibilidade">
                          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Disponibilidade</div>
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
                      Criticidade <span className="text-destructive">*</span>
                      <FieldHelpTooltip content="Quanto este incidente impacta a operação ou segurança da empresa." />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a criticidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
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
                    <FormLabel>Categoria</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Malware, Phishing, DDoS" {...field} />
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
                    <FormLabel>Data de Ocorrência</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Selecione uma data</span>}
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
                  <FormLabel>Descrição Detalhada</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva detalhadamente o incidente, como foi descoberto e quais ações imediatas foram tomadas..."
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
        label: 'Detecção',
        icon: FileText,
        state: detectState,
        hint: 'Origem e responsável',
        content: (
          <div className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="origem_deteccao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Origem da Detecção
                      <FieldHelpTooltip content="Como o incidente foi descoberto (SIEM, usuário, auditoria, fornecedor)." />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Monitoramento, Usuário, Auditoria..." {...field} />
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
                    <FormLabel>Responsável pela Detecção</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        placeholder="Selecionar responsável..."
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
        label: 'Impacto',
        icon: Layers,
        state: impactoState,
        hint: 'Dados e sistemas afetados',
        content: (
          <div className="space-y-5 max-w-3xl">
            <FormField
              control={form.control}
              name="impacto_estimado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Impacto Estimado
                    <FieldHelpTooltip content="Descrição clara do impacto operacional, financeiro ou reputacional." />
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Indisponibilidade do sistema X por 2h, dados expostos" {...field} />
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
                    Dados Afetados
                    <FieldHelpTooltip content="Tipos e volumes aproximados de dados envolvidos (pessoais, sensíveis, financeiros)." />
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva quais tipos de dados foram afetados (pessoais, financeiros, etc.)"
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
        label: 'Tratamento',
        icon: Users,
        state: tratamentoState,
        hint: 'Quem vai tratar',
        content: (
          <div className="space-y-5 max-w-3xl">
            <FormField
              control={form.control}
              name="responsavel_tratamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Responsável pelo Tratamento
                    <FieldHelpTooltip content="Quem ficará responsável por conduzir a resposta e o tratamento do incidente." />
                  </FormLabel>
                  <FormControl>
                    <UserSelect
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      placeholder="Selecionar responsável..."
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
    <WizardSummaryCard title="Resumo do Incidente">
      <WizardSummaryRow
        label="Título"
        value={watched.titulo || <span className="text-muted-foreground italic">Sem título</span>}
        highlight
      />
      <WizardSummaryRow
        label="Tipo"
        value={TIPO_LABELS[watched.tipo_incidente] || '—'}
      />
      <WizardSummaryRow
        label="Criticidade"
        value={
          <Badge variant={CRITICIDADE_VARIANT[watched.criticidade]} className="text-[10px]">
            {formatStatus(watched.criticidade)}
          </Badge>
        }
      />
      <WizardSummaryRow
        label="Data"
        value={watched.data_ocorrencia ? format(watched.data_ocorrencia, 'dd/MM/yyyy') : <span className="text-muted-foreground italic">—</span>}
      />
    </WizardSummaryCard>
  );

  const draftLabel =
    !incidente && hasDraft && savedAt
      ? `Rascunho salvo às ${new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : undefined;

  return (
    <Form {...form}>
      {!isControlled && (
        <Dialog>
          <DialogTrigger asChild>
            {trigger || (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Incidente
              </Button>
            )}
          </DialogTrigger>
        </Dialog>
      )}
      <WizardDialog
        open={open}
        onOpenChange={setOpen}
        title={incidente ? 'Editar Incidente' : 'Registrar Novo Incidente'}
        description={
          incidente ? 'Atualize as informações do incidente.' : 'Registre um novo incidente de segurança ou privacidade.'
        }
        icon={AlertTriangle}
        tabs={tabs}
        summary={summary}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={incidente ? 'Atualizar' : 'Registrar'}
        isSubmitting={loading}
        isDirty={isDirty}
        draftLabel={draftLabel}
        size="xl"
      />
    </Form>
  );
}
