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

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AiCostHint } from '@/components/ui/ai-cost-hint';
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
  const { profile, company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [iaSuggestionLoading, setIaSuggestionLoading] = useState(false);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [iaSuggestions, setIaSuggestions] = useState<any>(null);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

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
      }

      onSuccess();
    } catch (error: any) {
      toast.error('Erro ao salvar tratamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIaSuggestion = async () => {
    if (!riscoData) {
      toast.error('Dados do risco não disponíveis para sugestão');
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
        throw new Error(data.error || 'Erro ao gerar sugestões');
      }
    } catch (error: any) {
      // Verificar se o erro é de créditos esgotados
      if (error?.message?.includes('CREDITS_EXHAUSTED')) {
        setShowCreditsDialog(true);
      } else {
        toast.error('Erro ao gerar sugestões: ' + error.message);
      }
    } finally {
      setIaSuggestionLoading(false);
    }
  };

  const applySuggestion = (suggestion: string, type: 'mitigar' | 'transferir' | 'aceitar' | 'evitar') => {
    form.setValue('tipo_tratamento', type);
    form.setValue('descricao', suggestion);
    setSuggestionDialogOpen(false);
    toast.success('Sugestão aplicada! Revise e ajuste conforme necessário.');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Texto copiado para a área de transferência');
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="tipo_tratamento">Tipo de Tratamento *</Label>
          <Select 
            value={form.watch('tipo_tratamento')} 
            onValueChange={(value) => form.setValue('tipo_tratamento', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mitigar">Mitigar</SelectItem>
              <SelectItem value="transferir">Transferir</SelectItem>
              <SelectItem value="aceitar">Aceitar</SelectItem>
              <SelectItem value="evitar">Evitar</SelectItem>
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
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em andamento">Em Andamento</SelectItem>
              <SelectItem value="concluído">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
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
          placeholder="Descreva detalhadamente a ação proposta — escopo, etapas, responsáveis envolvidos e indicadores de sucesso."
          className="min-h-[140px] resize-y bg-background"
        />
        {form.formState.errors.descricao && (
          <p className="text-sm text-destructive">{form.formState.errors.descricao.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="responsavel">Responsável</Label>
          <UserSelect
            value={form.watch('responsavel') || ''}
            onValueChange={(value) => form.setValue('responsavel', value, { shouldDirty: true })}
            placeholder="Selecione o responsável"
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
          <Label>Data de Início</Label>
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
          <Label>Prazo</Label>
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
        <Label htmlFor="eficacia">Avaliação de Eficácia</Label>
        <Select 
          value={form.watch('eficacia') || ''} 
          onValueChange={(value) => form.setValue('eficacia', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Avaliar eficácia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="média">Média</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="muito alta">Muito Alta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          * Campos obrigatórios
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : (tratamento ? 'Atualizar' : 'Criar')} Tratamento
          </Button>
        </div>
      </div>

      {/* Modal de Sugestões da IA */}
      <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AkurisAIIcon className="h-5 w-5" />
              <AkurisAIIcon className="h-4 w-4" />
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
                    <CardTitle className="text-lg flex items-center justify-between">
                      🛡️ Plano de Mitigação
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
                    <CardTitle className="text-lg flex items-center justify-between">
                      🚨 Plano de Contingenciamento
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

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Dica:</strong> Essas sugestões são geradas automaticamente com base nas informações do risco. 
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

