import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconWarning, IconCalendar, IconCopy, IconShield, IconIdea, IconChecklist } from '@/components/icons';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from '@/lib/toast';
import { CreditsExhaustedDialog } from '@/components/CreditsExhaustedDialog';
import { UserSelect } from './UserSelect';
import { severidadeRisco } from '@/lib/metrics/riscos';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AiCostHint } from '@/components/ui/ai-cost-hint';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmpresaMoeda } from '@/hooks/useEmpresaMoeda';
import { dateFnsLocale, formatarDiaParaDB, parseDataLocal } from '@/lib/date-utils';
function makeTratamentoSchema(t: (key: string) => string) {
  return z.object({
    tipo_tratamento: z.string().min(1, t('sweepRiscos.riscos.tratForm2.tipoObrigatorio')),
    descricao: z.string().min(1, t('sweepRiscos.riscos.tratForm2.descricaoObrigatoria')),
    responsavel: z.string().optional(),
    custo: z.string().optional(),
    prazo: z.date().optional(),
    data_inicio: z.date().optional(),
    status: z.string().default('pendente'),
    eficacia: z.string().optional()
  });
}

type TratamentoFormData = z.infer<ReturnType<typeof makeTratamentoSchema>>;

interface TratamentoFormProps {
  riscoId: string;
  tratamento?: any;
  onSuccess: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  riscoData?: {
    nome: string;
    descricao: string;
    categoria?: string;
    nivel_risco_inicial?: string;
    nivel_risco_residual?: string | null;
  };
}

export interface TratamentoFormHandle {
  submit: () => void;
}

export const TratamentoForm = forwardRef<TratamentoFormHandle, TratamentoFormProps>(function TratamentoForm(
  { riscoId, tratamento, onSuccess, riscoData, onSubmittingChange, onDirtyChange },
  ref
) {
  const { t } = useLanguage();
  const { simbolo: simboloMoeda } = useEmpresaMoeda();
  const { profile, company } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [iaSuggestionLoading, setIaSuggestionLoading] = useState(false);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [iaSuggestions, setIaSuggestions] = useState<any>(null);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  // Gerar plano de ação vinculado ao criar tratamento (só faz sentido em novos)

  const tratamentoSchema = makeTratamentoSchema(t);
  const form = useForm<TratamentoFormData>({
    resolver: zodResolver(tratamentoSchema),
    defaultValues: {
      tipo_tratamento: tratamento?.tipo_tratamento || '',
      descricao: tratamento?.descricao || '',
      responsavel: tratamento?.responsavel || '',
      custo: tratamento?.custo?.toString() || '',
      // `prazo` e `data_inicio` sao colunas `date`. Com `new Date('2026-08-20')`
      // o valor vira meia-noite UTC, que em Brasilia e o dia 19 — o calendario
      // abria sempre no dia anterior ao que a lista mostrava, ao lado.
      prazo: tratamento?.prazo ? parseDataLocal(tratamento.prazo) : undefined,
      data_inicio: tratamento?.data_inicio ? parseDataLocal(tratamento.data_inicio) : undefined,
      status: tratamento?.status || 'pendente',
      eficacia: tratamento?.eficacia || ''
    }
  });

  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(onSubmit)(),
  }));

  useEffect(() => {
    onSubmittingChange?.(loading);
  }, [loading, onSubmittingChange]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const onSubmit = async (data: TratamentoFormData) => {
    if (!profile) return;

    setLoading(true);
    try {
      const submitData = {
        risco_id: riscoId,
        tipo_tratamento: data.tipo_tratamento,
        descricao: data.descricao,
        responsavel: data.responsavel || null,
        custo: data.custo ? parseFloat(data.custo) : null,
        prazo: data.prazo ? formatarDiaParaDB(data.prazo) : null,
        data_inicio: data.data_inicio ? formatarDiaParaDB(data.data_inicio) : null,
        status: data.status,
        eficacia: data.eficacia || null
      };

      if (tratamento) {
        const { error } = await supabase
          .from('riscos_tratamentos')
          .update(submitData)
          .eq('id', tratamento.id);

        if (error) throw error;
        toast.success(t('cardsKpi.sweep.riscos.tratamentoAtualizado'));
      } else {
        const { error } = await supabase
          .from('riscos_tratamentos')
          .insert(submitData);

        if (error) throw error;
        toast.success(t('cardsKpi.sweep.riscos.tratamentoCriado'));

        /*
           O plano nasce com o tratamento, sem opção de o dispensar.

           Era uma caixa ligada por omissão, e o painel do risco tinha ao
           lado um botão próprio para criar planos. Quem desligasse a caixa
           ficava com um tratamento sem forma de o acompanhar; quem a
           deixasse ligada e usasse também o botão do lado ficava com dois
           planos para o mesmo trabalho. Agora há um caminho só: tratar o
           risco cria a ação que o acompanha.
        */
        if (profile.empresa_id) {
          try {
            const sev = severidadeRisco(riscoData ?? {});
            const prioridade = sev === 'critico' ? 'alta' : sev === 'alto' ? 'alta' : sev === 'medio' ? 'media' : 'baixa';
            const tituloRisco = riscoData?.nome || 'Risco';
            const { error: planoError } = await supabase.from('planos_acao').insert({
              empresa_id: profile.empresa_id,
              titulo: `Tratar risco: ${tituloRisco}`,
              descricao: data.descricao,
              modulo_origem: 'riscos',
              registro_origem_id: riscoId,
              registro_origem_titulo: tituloRisco,
              responsavel_id: data.responsavel || null,
              prazo: data.prazo ? formatarDiaParaDB(data.prazo) : null,
              prioridade,
              status: 'pendente',
              created_by: profile.user_id,
            });
            if (planoError) throw planoError;
            /*
               O painel dos planos fica logo por baixo deste formulário.
               Sem esta invalidação continuava a dizer que não havia
               nenhum plano até alguém recarregar a página — medido no
               R-0005: o plano estava na base e o painel dizia que não.
            */
            queryClient.invalidateQueries({ queryKey: ['planos-acao-vinculados'] });
            queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
            toast.success(t('fin.riscos.tratForm.planoCriado'));
          } catch (planoErr: any) {
            // Não bloqueia o tratamento se o plano falhar
            toast.error(t('fin.riscos.tratForm.erroPlano', { mensagem: planoErr.message }));
          }
        }
      }

      onSuccess();
    } catch (error: any) {
      toast.error(t('fin.riscos.tratForm.erroSalvar', { mensagem: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleIaSuggestion = async () => {
    if (!riscoData) {
      toast.error(t('fin.riscos.tratForm.semDados'));
      return;
    }

    setIaSuggestionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-risk-treatment', {
        body: {
          nome: riscoData.nome,
          descricao: riscoData.descricao,
          categoria: riscoData.categoria,
          nivel_risco: riscoData.nivel_risco_residual || riscoData.nivel_risco_inicial,
          empresa_id: profile?.empresa_id,
          user_id: profile?.user_id
        }
      });

      if (error) throw error;

      // Verificar se créditos foram esgotados
      if (data?.creditsExhausted || data?.error === 'CREDITS_EXHAUSTED' || error?.message?.includes('CREDITS_EXHAUSTED')) {
        setShowCreditsDialog(true);
        return;
      }

      if (data.success) {
        setIaSuggestions(data.data);
        setSuggestionDialogOpen(true);
      } else {
        throw new Error(data.error || t('fin.riscos.tratForm.erroSugestoes'));
      }
    } catch (error: any) {
      // Verificar se o erro é de créditos esgotados
      if (error?.message?.includes('CREDITS_EXHAUSTED')) {
        setShowCreditsDialog(true);
      } else {
        toast.error(t('fin.riscos.tratForm.erroSugestoesMsg', { mensagem: error.message }));
      }
    } finally {
      setIaSuggestionLoading(false);
    }
  };

  const applySuggestion = (suggestion: string, type: 'mitigar' | 'transferir' | 'aceitar' | 'evitar') => {
    form.setValue('tipo_tratamento', type);
    form.setValue('descricao', suggestion);
    setSuggestionDialogOpen(false);
    toast.success(t('fin.riscos.tratForm.sugestaoAplicada'));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('fin.comum.textoCopiado'));
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="tipo_tratamento">{t('fin.riscos.tratForm.tipoLabel')}</Label>
          <Select 
            value={form.watch('tipo_tratamento')} 
            onValueChange={(value) => form.setValue('tipo_tratamento', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('fin.comum.selecioneTipo')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mitigar">{t('campos.enums.tratamentoEstrategia.mitigar')}</SelectItem>
              <SelectItem value="transferir">{t('campos.enums.tratamentoEstrategia.transferir')}</SelectItem>
              <SelectItem value="aceitar">{t('campos.enums.tratamentoEstrategia.aceitar')}</SelectItem>
              <SelectItem value="evitar">{t('campos.enums.tratamentoEstrategia.evitar')}</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.tipo_tratamento && (
            <p className="text-sm text-destructive">{form.formState.errors.tipo_tratamento.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">{t('sweepRiscos.riscos.tratForm2.statusLabel')}</Label>
          <Select 
            value={form.watch('status')} 
            onValueChange={(value) => form.setValue('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('fin.comum.selecioneStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">{t('campos.opcoes.pendente')}</SelectItem>
              <SelectItem value="em andamento">{t('campos.opcoes.emAndamento')}</SelectItem>
              <SelectItem value="concluído">{t('fin.comum.concluido')}</SelectItem>
              <SelectItem value="cancelado">{t('campos.opcoes.cancelado')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="descricao" className="text-base font-semibold">
            {t('sweepRiscos.riscos.tratForm2.descricaoLabel')}
          </Label>
          <div className="flex items-center gap-2">
            <AiCostHint action={t('sweepRiscos.riscos.tratForm2.aiCostAction')} />
            {riscoData && !tratamento && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleIaSuggestion}
                disabled={iaSuggestionLoading}
              >
                {iaSuggestionLoading ? (
                  <>
                    <AkurisPulse size={14} className="mr-2" />
                    {t('sweepRiscos.riscos.tratForm2.gerandoSugestao')}
                  </>
                ) : (
                  <>
                    {t('sweepRiscos.riscos.tratForm2.sugerirTratamento')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        <Textarea
          {...form.register('descricao')}
          placeholder={t('fin.riscos.tratForm.descPlaceholder')}
          className="min-h-[140px] resize-y bg-background"
        />
        {form.formState.errors.descricao && (
          <p className="text-sm text-destructive">{form.formState.errors.descricao.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="responsavel">{t('residuos.risco.responsavel')}</Label>
          <UserSelect
            value={form.watch('responsavel') || ''}
            onValueChange={(value) => form.setValue('responsavel', value, { shouldDirty: true })}
            placeholder={t('fin.comum.selecioneResponsavel')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="custo">{t('sweepRiscos.riscos.tratForm2.custoLabel', { moeda: simboloMoeda })}</Label>
          <Input
            {...form.register('custo')}
            placeholder="0,00"
            type="number"
            step="0.01"
          min="0" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>{t('fin.comum.dataInicio')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.watch('data_inicio') && "text-muted-foreground"
                )}
              >
                <IconCalendar className="mr-2 h-4 w-4" />
                {form.watch('data_inicio') ? format(form.watch('data_inicio')!, "PPP", { locale: dateFnsLocale() }) : t('sweepRiscos.riscos.tratForm2.selecionarData')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.watch('data_inicio')}
                onSelect={(date) => form.setValue('data_inicio', date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>{t('campos.risco.prazo')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.watch('prazo') && "text-muted-foreground"
                )}
              >
                <IconCalendar className="mr-2 h-4 w-4" />
                {form.watch('prazo') ? format(form.watch('prazo')!, "PPP", { locale: dateFnsLocale() }) : t('sweepRiscos.riscos.tratForm2.selecionarPrazo')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.watch('prazo')}
                onSelect={(date) => form.setValue('prazo', date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eficacia">{t('fin.riscos.tratForm.eficaciaLabel')}</Label>
        <Select 
          value={form.watch('eficacia') || ''} 
          onValueChange={(value) => form.setValue('eficacia', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('fin.riscos.tratForm.eficaciaPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="baixa">{t('campos.enums.escala.baixa')}</SelectItem>
            <SelectItem value="média">{t('campos.enums.escala.media')}</SelectItem>
            <SelectItem value="alta">{t('campos.enums.escala.alta')}</SelectItem>
            <SelectItem value="muito alta">{t('campos.enums.escala.muitoAlta')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* O que vai acontecer ao gravar — só ao criar um tratamento novo. */}
      {!tratamento && (
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4">
          <IconChecklist className="h-4 w-4 text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="space-y-0.5">
            <div className="text-sm font-medium">
              {t('sweepRiscos.riscos.tratForm2.planoNasceLabel')}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('sweepRiscos.riscos.tratForm2.planoNasceDesc')}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('fin.comum.camposObrigatorios')}</p>

      {/* Modal de Sugestões da IA */}
      <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t('sweepRiscos.riscos.tratForm2.sugestoesTitulo')}
            </DialogTitle>
            <DialogDescription>
              {t('sweepRiscos.riscos.tratForm2.sugestoesDesc', { nome: riscoData?.nome || '' })}
            </DialogDescription>
          </DialogHeader>

          {iaSuggestions && (
            <div className="space-y-4 mt-4">
              {iaSuggestions.mitigacao && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <IconShield className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        {t('sweepRiscos.riscos.tratForm2.planoMitigacao')}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(iaSuggestions.mitigacao)}
                        >
                          <IconCopy className="h-3 w-3 mr-1" />
                          {t('sweepRiscos.riscos.tratForm2.copiar')}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => applySuggestion(iaSuggestions.mitigacao, 'mitigar')}
                        >
                          {t('sweepRiscos.riscos.tratForm2.aplicarSugestao')}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm">
                      {iaSuggestions.mitigacao}
                    </div>
                  </CardContent>
                </Card>
              )}

              {iaSuggestions.contingenciamento && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <IconWarning className="h-4 w-4 text-warning" strokeWidth={1.5} />
                        {t('sweepRiscos.riscos.tratForm2.planoContingenciamento')}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(iaSuggestions.contingenciamento)}
                        >
                          <IconCopy className="h-3 w-3 mr-1" />
                          {t('sweepRiscos.riscos.tratForm2.copiar')}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => applySuggestion(iaSuggestions.contingenciamento, 'transferir')}
                        >
                          {t('sweepRiscos.riscos.tratForm2.aplicarSugestao')}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm">
                      {iaSuggestions.contingenciamento}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="mt-6 p-4 bg-muted rounded-lg flex gap-3">
                <IconIdea className="h-4 w-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{t('sweepRiscos.riscos.tratForm2.dicaTitulo')}</strong> {t('sweepRiscos.riscos.tratForm2.dicaTexto')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Créditos Esgotados */}
      <CreditsExhaustedDialog 
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        planName={company?.plano?.nome}
        creditsLimit={company?.plano?.creditos_franquia}
      />
    </form>
  );
});

