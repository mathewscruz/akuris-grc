import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { DialogShell } from '@/components/ui/dialog-shell';
import { CalendarIcon, Edit, Trash2, FileText, CheckCircle, Clock, XCircle, FileEdit, ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatStatus } from '@/lib/text-utils';
import { logger } from '@/lib/logger';
import { MasterDetailDialog, type MasterDetailItem } from '@/components/ui/master-detail-dialog';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';

const makeAditivoSchema = (t: (key: string) => string) => z.object({
  numero_aditivo: z.string().min(1, t('contratosDialogs.aditivosDialog.zodNumeroRequired')),
  tipo: z.string().min(1, t('contratosDialogs.aditivosDialog.zodTipoRequired')),
  motivo: z.string().min(1, t('contratosDialogs.aditivosDialog.zodMotivoRequired')),
  valor_anterior: z.string().optional(),
  valor_novo: z.string().optional(),
  data_inicio_anterior: z.date().optional(),
  data_fim_anterior: z.date().optional(),
  data_inicio_nova: z.date().optional(),
  data_fim_nova: z.date().optional(),
  data_assinatura: z.date().optional(),
  justificativa: z.string().min(1, t('contratosDialogs.aditivosDialog.zodJustificativaRequired')),
  status: z.string().default('rascunho'),
});

type AditivoFormData = z.infer<ReturnType<typeof makeAditivoSchema>>;

interface Aditivo {
  id: string;
  contrato_id: string;
  numero_aditivo: string;
  tipo: string;
  motivo: string;
  valor_anterior: number | null;
  valor_novo: number | null;
  data_inicio_anterior: string | null;
  data_fim_anterior: string | null;
  data_inicio_nova: string | null;
  data_fim_nova: string | null;
  data_assinatura: string | null;
  status: string;
  justificativa: string;
  aprovado_por: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Contrato {
  id: string;
  nome: string;
  numero_contrato: string;
  valor: number | null;
  data_inicio: string | null;
  data_fim: string | null;
}

interface AditivosDialogProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStatusInfo = (t: (key: string) => string): Record<string, { label: string; icon: typeof FileText; tone: StatusTone }> => ({
  rascunho: { label: t('contratosAtivos.aditivosDialog.statusRascunho'), icon: FileText, tone: 'neutral' },
  aprovacao: { label: t('contratosAtivos.aditivosDialog.statusAprovacao'), icon: Clock, tone: 'info' },
  ativo: { label: t('contratosAtivos.aditivosDialog.statusAtivo'), icon: CheckCircle, tone: 'success' },
  rejeitado: { label: t('contratosAtivos.aditivosDialog.statusRejeitado'), icon: XCircle, tone: 'destructive' },
});

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (date: string | null) =>
  date ? format(new Date(date), 'dd/MM/yyyy', { locale: ptBR }) : '—';

export const AditivosDialog: React.FC<AditivosDialogProps> = ({ contrato, open, onOpenChange }) => {
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAditivo, setEditingAditivo] = useState<Aditivo | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [aditivoToDelete, setAditivoToDelete] = useState<Aditivo | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const STATUS_INFO = useMemo(() => getStatusInfo(t), [t]);
  const aditivoSchema = useMemo(() => makeAditivoSchema(t), [t]);

  const form = useForm<AditivoFormData>({
    resolver: zodResolver(aditivoSchema),
    defaultValues: {
      numero_aditivo: '',
      tipo: '',
      motivo: '',
      valor_anterior: '',
      valor_novo: '',
      justificativa: '',
      status: 'rascunho',
    },
  });

  useEffect(() => {
    if (open && contrato) {
      fetchAditivos();
    }
  }, [open, contrato]);

  useEffect(() => {
    if (!formOpen) return;
    if (editingAditivo) {
      form.reset({
        numero_aditivo: editingAditivo.numero_aditivo,
        tipo: editingAditivo.tipo,
        motivo: editingAditivo.motivo,
        valor_anterior: editingAditivo.valor_anterior?.toString() || '',
        valor_novo: editingAditivo.valor_novo?.toString() || '',
        data_inicio_anterior: editingAditivo.data_inicio_anterior ? new Date(editingAditivo.data_inicio_anterior) : undefined,
        data_fim_anterior: editingAditivo.data_fim_anterior ? new Date(editingAditivo.data_fim_anterior) : undefined,
        data_inicio_nova: editingAditivo.data_inicio_nova ? new Date(editingAditivo.data_inicio_nova) : undefined,
        data_fim_nova: editingAditivo.data_fim_nova ? new Date(editingAditivo.data_fim_nova) : undefined,
        data_assinatura: editingAditivo.data_assinatura ? new Date(editingAditivo.data_assinatura) : undefined,
        justificativa: editingAditivo.justificativa,
        status: editingAditivo.status,
      });
    } else {
      form.reset({
        numero_aditivo: '',
        tipo: '',
        motivo: '',
        valor_anterior: contrato?.valor?.toString() || '',
        valor_novo: '',
        data_inicio_anterior: contrato?.data_inicio ? new Date(contrato.data_inicio) : undefined,
        data_fim_anterior: contrato?.data_fim ? new Date(contrato.data_fim) : undefined,
        data_inicio_nova: undefined,
        data_fim_nova: undefined,
        data_assinatura: undefined,
        justificativa: '',
        status: 'rascunho',
      });
    }
  }, [editingAditivo, contrato, formOpen, form]);

  const fetchAditivos = async () => {
    if (!contrato) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contrato_aditivos')
        .select('*')
        .eq('contrato_id', contrato.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAditivos(data || []);
      // Auto-selecionar primeiro item
      if (data && data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (error) {
      logger.error('Erro ao carregar aditivos:', error);
      toast({ title: t('contratosAtivos.common.error'), description: t('contratosAtivos.aditivosDialog.toastLoadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: AditivoFormData) => {
    if (!contrato) return;
    try {
      setLoading(true);
      const aditivoData = {
        contrato_id: contrato.id,
        numero_aditivo: data.numero_aditivo,
        tipo: data.tipo,
        motivo: data.motivo,
        valor_anterior: data.valor_anterior ? parseFloat(data.valor_anterior) : null,
        valor_novo: data.valor_novo ? parseFloat(data.valor_novo) : null,
        data_inicio_anterior: data.data_inicio_anterior?.toISOString().split('T')[0] || null,
        data_fim_anterior: data.data_fim_anterior?.toISOString().split('T')[0] || null,
        data_inicio_nova: data.data_inicio_nova?.toISOString().split('T')[0] || null,
        data_fim_nova: data.data_fim_nova?.toISOString().split('T')[0] || null,
        data_assinatura: data.data_assinatura?.toISOString().split('T')[0] || null,
        justificativa: data.justificativa,
        status: data.status,
      };

      if (editingAditivo) {
        const { error } = await supabase.from('contrato_aditivos').update(aditivoData).eq('id', editingAditivo.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('contrato_aditivos')
          .insert([aditivoData])
          .select()
          .single();
        if (error) throw error;
        if (inserted) setSelectedId(inserted.id);
      }

      toast({ title: t('contratosAtivos.common.success'), description: t('contratosAtivos.aditivosDialog.toastSaveSuccess').replace('{action}', editingAditivo ? t('contratosAtivos.aditivosDialog.actionUpdated') : t('contratosAtivos.aditivosDialog.actionCreated')) });
      setFormOpen(false);
      setEditingAditivo(null);
      fetchAditivos();
    } catch (error) {
      logger.error('Erro ao salvar aditivo:', error);
      toast({
        title: t('contratosAtivos.common.error'),
        description: editingAditivo ? t('contratosAtivos.aditivosDialog.toastSaveErrorUpdate') : t('contratosAtivos.aditivosDialog.toastSaveErrorCreate'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!aditivoToDelete) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('contrato_aditivos').delete().eq('id', aditivoToDelete.id);
      if (error) throw error;
      toast({ title: t('contratosAtivos.common.success'), description: t('contratosAtivos.aditivosDialog.toastDeleteSuccess') });
      if (selectedId === aditivoToDelete.id) setSelectedId(null);
      fetchAditivos();
    } catch (error) {
      logger.error('Erro ao excluir aditivo:', error);
      toast({ title: t('contratosAtivos.common.error'), description: t('contratosAtivos.aditivosDialog.toastDeleteError'), variant: 'destructive' });
    } finally {
      setLoading(false);
      setDeleteConfirmOpen(false);
      setAditivoToDelete(null);
    }
  };

  const items: (MasterDetailItem & { raw: Aditivo })[] = useMemo(
    () =>
      aditivos.map((a) => {
        const info = STATUS_INFO[a.status] ?? STATUS_INFO.rascunho;
        return {
          id: a.id,
          label: t('contratosAtivos.aditivosDialog.aditivoLabel').replace('{numero}', a.numero_aditivo),
          description: `${formatStatus(a.tipo)} · ${formatDate(a.data_assinatura)}`,
          badge: (
            <StatusBadge tone={info.tone} size="sm">
              {info.label}
            </StatusBadge>
          ),
          icon: info.icon,
          raw: a,
        };
      }),
    [aditivos]
  );

  if (!contrato) return null;

  const renderDetail = (item: (MasterDetailItem & { raw: Aditivo }) | null) => {
    if (!item) return null;
    const a = item.raw;
    const info = STATUS_INFO[a.status] ?? STATUS_INFO.rascunho;
    const StatusIcon = info.icon;

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{t('contratosAtivos.aditivosDialog.aditivoLabel').replace('{numero}', a.numero_aditivo)}</h2>
            <p className="text-sm text-muted-foreground">{formatStatus(a.tipo)}</p>
          </div>
          <StatusBadge tone={info.tone} icon={<StatusIcon className="h-3 w-3" />}>
            {info.label}
          </StatusBadge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('contratosAtivos.aditivosDialog.detailMotivo')}</p>
            <p className="text-sm">{a.motivo}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('contratosAtivos.aditivosDialog.detailSignatureDate')}</p>
            <p className="text-sm">{formatDate(a.data_assinatura)}</p>
          </div>
        </div>

        {(a.valor_anterior !== null || a.valor_novo !== null) && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{t('contratosAtivos.aditivosDialog.detailValueChange')}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono">{formatCurrency(a.valor_anterior)}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-semibold text-foreground">{formatCurrency(a.valor_novo)}</span>
              </div>
            </div>
          </>
        )}

        {(a.data_inicio_anterior || a.data_inicio_nova) && (
          <>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('contratosAtivos.aditivosDialog.detailPreviousTerm')}</p>
                <p className="text-sm">
                  {formatDate(a.data_inicio_anterior)} → {formatDate(a.data_fim_anterior)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('contratosAtivos.aditivosDialog.detailNewTerm')}</p>
                <p className="text-sm font-medium">
                  {formatDate(a.data_inicio_nova)} → {formatDate(a.data_fim_nova)}
                </p>
              </div>
            </div>
          </>
        )}

        <Separator />
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('contratosAtivos.aditivosDialog.detailJustification')}</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-md p-3 border">
            {a.justificativa}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingAditivo(a);
              setFormOpen(true);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            {t('contratosAtivos.aditivosDialog.editButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setAditivoToDelete(a);
              setDeleteConfirmOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('contratosAtivos.aditivosDialog.deleteButton')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <MasterDetailDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('contratosAtivos.aditivosDialog.title')}
        description={`${contrato.nome} (${contrato.numero_contrato})`}
        icon={FileEdit}
        items={items}
        selectedId={selectedId}
        onSelect={(it) => setSelectedId(it.id)}
        renderDetail={(it) => renderDetail(it as (MasterDetailItem & { raw: Aditivo }) | null)}
        onCreate={() => {
          setEditingAditivo(null);
          setFormOpen(true);
        }}
        createLabel={t('contratosAtivos.aditivosDialog.createLabel')}
        searchPlaceholder={t('contratosAtivos.aditivosDialog.searchPlaceholder')}
        emptyState={
          <div className="space-y-2">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <p>{t('contratosAtivos.aditivosDialog.emptyStateText')}</p>
            <p className="text-xs">{t('contratosAtivos.aditivosDialog.emptyStateHint')}</p>
          </div>
        }
        emptySelection={t('contratosAtivos.aditivosDialog.emptySelection')}
        size="xl"
      />

      {/* Sub-dialog para criar/editar aditivo */}
      <DialogShell
        open={formOpen}
        onOpenChange={setFormOpen}
        icon={FileEdit}
        title={editingAditivo ? t('contratosAtivos.aditivosDialog.dialogTitleEdit') : t('contratosAtivos.aditivosDialog.dialogTitleNew')}
        description={t('contratosAtivos.aditivosDialog.dialogDescription')}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={editingAditivo ? t('contratosAtivos.common.update') : t('contratosAtivos.common.create')}
        isSubmitting={loading}
        isDirty={form.formState.isDirty}
      >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <FormField
                control={form.control}
                name="numero_aditivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.aditivosDialog.labelNumber')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('contratosAtivos.aditivosDialog.numberPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.aditivosDialog.labelType')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contratosAtivos.aditivosDialog.typePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="prazo">{t('contratosAtivos.aditivosDialog.typePrazo')}</SelectItem>
                        <SelectItem value="valor">{t('contratosAtivos.aditivosDialog.typeValor')}</SelectItem>
                        <SelectItem value="escopo">{t('contratosAtivos.aditivosDialog.typeEscopo')}</SelectItem>
                        <SelectItem value="outros">{t('contratosAtivos.aditivosDialog.typeOutros')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{t('contratosAtivos.aditivosDialog.labelMotivo')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('contratosAtivos.aditivosDialog.motivoPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_anterior"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.aditivosDialog.labelPreviousValue')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_novo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.aditivosDialog.labelNewValue')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(['data_inicio_anterior', 'data_fim_anterior', 'data_inicio_nova', 'data_fim_nova', 'data_assinatura'] as const).map(
                (fieldName) => {
                  const labels: Record<typeof fieldName, string> = {
                    data_inicio_anterior: t('contratosAtivos.aditivosDialog.labelPreviousStartDate'),
                    data_fim_anterior: t('contratosAtivos.aditivosDialog.labelPreviousEndDate'),
                    data_inicio_nova: t('contratosAtivos.aditivosDialog.labelNewStartDate'),
                    data_fim_nova: t('contratosAtivos.aditivosDialog.labelNewEndDate'),
                    data_assinatura: t('contratosAtivos.aditivosDialog.labelSignatureDate'),
                  };
                  return (
                    <FormField
                      key={fieldName}
                      control={form.control}
                      name={fieldName}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{labels[fieldName]}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                  ) : (
                                    <span>{t('contratosAtivos.aditivosDialog.selectDatePlaceholder')}</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date('1900-01-01')}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                }
              )}

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contratosAtivos.aditivosDialog.labelStatus')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contratosAtivos.aditivosDialog.statusPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="rascunho">{t('contratosAtivos.aditivosDialog.statusRascunho')}</SelectItem>
                        <SelectItem value="aprovacao">{t('contratosAtivos.aditivosDialog.statusAprovacao')}</SelectItem>
                        <SelectItem value="ativo">{t('contratosAtivos.aditivosDialog.statusAtivo')}</SelectItem>
                        <SelectItem value="rejeitado">{t('contratosAtivos.aditivosDialog.statusRejeitado')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="justificativa"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{t('contratosAtivos.aditivosDialog.labelJustificativa')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('contratosAtivos.aditivosDialog.justificativaPlaceholder')}
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
      </DialogShell>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('contratosAtivos.common.confirmDeleteTitle')}
        description={t('contratosAtivos.aditivosDialog.confirmDeleteDescription').replace('{numero}', aditivoToDelete?.numero_aditivo || '')}
        confirmText={t('contratosAtivos.common.delete')}
        cancelText={t('contratosAtivos.common.cancel')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
};
