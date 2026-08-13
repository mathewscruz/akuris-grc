import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
import { CalendarIcon, Copy, Shield, AlertTriangle, Lightbulb } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { CreditsExhaustedDialog } from '@/components/CreditsExhaustedDialog';
import { UserSelect } from './UserSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardList } from 'lucide-react';
import { severityFromNivel } from './risk-utils';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AiCostHint } from '@/components/ui/ai-cost-hint';
import { useLanguage } from '@/contexts/LanguageContext';
const tratamentoSchema = z.object({
  tipo_tratamento: z.string().min(1, 'Tipo de tratamento é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  responsavel: z.string().optional(),
  custo: z.string().optional(),
  prazo: z.date().optional(),
  data_inicio: z.date().optional(),
  status: z.string().default('pendente'),
  eficacia: z.string().optional()
});

type TratamentoFormData = z.infer<typeof tratamentoSchema>;

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
  const { profile, company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [iaSuggestionLoading, setIaSuggestionLoading] = useState(false);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [iaSuggestions, setIaSuggestions] = useState<any>(null);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  // Gerar plano de ação vinculado ao criar tratamento (só faz sentido em novos)
  const [gerarPlano, setGerarPlano] = useState(true);

  const form = useForm<TratamentoFormData>({
    resolver: zodResolver(tratamentoSchema),
    defaultValues: {
      tipo_tratamento: tratamento?.tipo_tratamento || '',
      descricao: tratamento?.descricao || '',
      responsavel: tratamento?.responsavel || '',
      custo: tratamento?.custo?.toString() || '',
      prazo: tratamento?.prazo ? new Date(tratamento.prazo) : undefined,
      data_inicio: tratamento?.data_inicio ? new Date(tratamento.data_inicio) : undefined,
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
        prazo: data.prazo ? data.prazo.toISOString() : null,
        data_inicio: data.data_inicio ? data.data_inicio.toISOString() : null,
        status: data.status,
        eficacia: data.eficacia || null
      };

      if (tratamento) {
        const { error } = await supabase
          .from('riscos_tratamentos')
          .update(submitData)
          .eq('id', tratamento.id);

        if (error) throw error;
        toast.success('Tratamento atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('riscos_tratamentos')
          .insert(submitData);

        if (error) throw error;
        toast.success('Tratamento criado com sucesso!');

        // Gera plano de ação vinculado (rastreabilidade risco → tratamento → ação)
        if (gerarPlano && profile.empresa_id) {
          try {
            const sev = severityFromNivel(riscoData?.nivel_risco_inicial);
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
              prazo: data.prazo ? data.prazo.toISOString() : null,
              prioridade,
              status: 'pendente',
              created_by: profile.user_id,
            });
            if (planoError) throw planoError;
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
          nivel_risco: riscoData.nivel_risco_inicial,
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
          <Label htmlFor="status">Status</Label>
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

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="descricao" className="text-base font-semibold">
            Descrição do Tratamento *
          </Label>
          <div className="flex items-center gap-2">
            <AiCostHint action="cada sugestão de tratamento" />
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
                    Gerando...
                  </>
                ) : (
                  <>
                    <AkurisAIIcon className="mr-2 h-4 w-4" />
                    Sugerir Tratamento
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
          <Label htmlFor="custo">Custo Estimado (R$)</Label>
          <Input
            {...form.register('custo')}
            placeholder="0,00"
            type="number"
            step="0.01"
          />
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
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch('data_inicio') ? format(form.watch('data_inicio')!, "PPP", { locale: ptBR }) : "Selecionar data"}
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
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch('prazo') ? format(form.watch('prazo')!, "PPP", { locale: ptBR }) : "Selecionar prazo"}
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

      {/* Gerar plano de ação vinculado — só ao criar um tratamento novo */}
      {!tratamento && (
        <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 cursor-pointer">
          <Checkbox
            checked={gerarPlano}
            onCheckedChange={(c) => setGerarPlano(!!c)}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="h-4 w-4 text-primary" strokeWidth={1.5} />
              Gerar plano de ação vinculado
            </div>
            <p className="text-xs text-muted-foreground">
              Cria um item em Planos de Ação (origem: Riscos) com responsável e prazo deste
              tratamento, para acompanhar a execução e manter a rastreabilidade risco → ação.
            </p>
          </div>
        </label>
      )}

      <p className="text-xs text-muted-foreground">{t('fin.comum.camposObrigatorios')}</p>


      {/* Modal de Sugestões da IA */}
      <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AkurisAIIcon className="h-5 w-5" />
              Sugestões Inteligentes de Tratamento
            </DialogTitle>
            <DialogDescription>
              Baseado na análise do risco "{riscoData?.nome}", aqui estão as sugestões de tratamento:
            </DialogDescription>
          </DialogHeader>

          {iaSuggestions && (
            <div className="space-y-4 mt-4">
              {iaSuggestions.mitigacao && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        Plano de Mitigação
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(iaSuggestions.mitigacao)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => applySuggestion(iaSuggestions.mitigacao, 'mitigar')}
                        >
                          Aplicar Sugestão
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
                        <AlertTriangle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                        Plano de Contingenciamento
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(iaSuggestions.contingenciamento)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => applySuggestion(iaSuggestions.contingenciamento, 'transferir')}
                        >
                          Aplicar Sugestão
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
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Essas sugestões são geradas automaticamente com base nas informações do risco.
                  Revise e ajuste conforme necessário para adequar à realidade da sua organização.
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

