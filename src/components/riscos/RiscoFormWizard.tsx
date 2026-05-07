import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Save, AlertCircle, FileText, Gauge, Settings2, Link2, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { UserSelect } from './UserSelect';
import { RiscoAnexosUpload } from './RiscoAnexosUpload';
import { cn } from '@/lib/utils';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';

const riscoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria_id: z.string().optional(),
  descricao: z.string().optional(),
  matriz_id: z.string().min(1, 'Matriz de risco é obrigatória'),
  responsavel: z.string().optional(),
  probabilidade_inicial: z.string().min(1, 'Probabilidade inicial é obrigatória'),
  impacto_inicial: z.string().min(1, 'Impacto inicial é obrigatório'),
  causas: z.string().optional(),
  consequencias: z.string().optional(),
  status: z.string().min(1, 'Status é obrigatório'),
  controles_existentes: z.string().optional(),
  probabilidade_residual: z.string().optional(),
  impacto_residual: z.string().optional(),
  aceito: z.boolean().default(false),
  justificativa_aceite: z.string().optional(),
  aprovador_aceite: z.string().optional(),
  ativos_vinculados: z.array(z.string()).default([]),
  data_proxima_revisao: z.string().optional()
});

type RiscoForm = z.infer<typeof riscoSchema>;

interface Matriz {
  id: string;
  nome: string;
  configuracao?: Array<{
    escala_probabilidade: any;
    escala_impacto: any;
    niveis_risco: any;
    metodo_calculo?: string;
  }>;
}

interface Categoria {
  id: string;
  nome: string;
  cor?: string;
}

interface Ativo {
  id: string;
  nome: string;
  tipo: string;
}

interface Props {
  risco?: any;
  onSuccess: () => void;
}

export function RiscoFormWizard({ risco, onSuccess }: Props) {
  const { profile } = useAuth();
  const { notify } = useIntegrationNotify();
  const [loading, setLoading] = useState(false);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [selectedMatriz, setSelectedMatriz] = useState<Matriz | null>(null);
  const [anexosAceite, setAnexosAceite] = useState<any[]>([]);
  
  const TABS = ['identificacao', 'avaliacao', 'detalhes', 'residual', 'aceite'] as const;
  type TabKey = typeof TABS[number];
  const [activeTab, setActiveTab] = useState<TabKey>('identificacao');

  const goToTab = (direction: 'prev' | 'next') => {
    const idx = TABS.indexOf(activeTab);
    const nextIdx = direction === 'next' ? Math.min(idx + 1, TABS.length - 1) : Math.max(idx - 1, 0);
    setActiveTab(TABS[nextIdx]);
  };

  const form = useForm<RiscoForm>({
    resolver: zodResolver(riscoSchema),
    defaultValues: {
      nome: '',
      descricao: '',
      matriz_id: '',
      categoria_id: '',
      responsavel: '',
      probabilidade_inicial: '',
      impacto_inicial: '',
      probabilidade_residual: '',
      impacto_residual: '',
      status: 'identificado',
      controles_existentes: '',
      causas: '',
      consequencias: '',
      aceito: false,
      justificativa_aceite: '',
      aprovador_aceite: '',
      ativos_vinculados: [],
      data_proxima_revisao: ''
    }
  });

  const watchMatrizId = form.watch('matriz_id');
  const watchProbabilidade = form.watch('probabilidade_inicial');
  const watchImpacto = form.watch('impacto_inicial');
  const watchProbabilidadeResidual = form.watch('probabilidade_residual');
  const watchImpactoResidual = form.watch('impacto_residual');
  const watchAceito = form.watch('aceito');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (risco && matrizes.length > 0) {
      logger.debug('📝 Carregando dados do risco para edição:', risco);
      
      form.reset({
        nome: risco.nome || '',
        descricao: risco.descricao || '',
        matriz_id: risco.matriz_id || '',
        categoria_id: risco.categoria_id || '',
        responsavel: risco.responsavel || '',
        probabilidade_inicial: risco.probabilidade_inicial?.toString() || '',
        impacto_inicial: risco.impacto_inicial?.toString() || '',
        probabilidade_residual: risco.probabilidade_residual?.toString() || '',
        impacto_residual: risco.impacto_residual?.toString() || '',
        status: risco.status || 'identificado',
        controles_existentes: risco.controles_existentes || '',
        causas: risco.causas || '',
        consequencias: risco.consequencias || '',
        aceito: risco.aceito || false,
        justificativa_aceite: risco.justificativa_aceite || '',
        aprovador_aceite: risco.aprovador_aceite || '',
        ativos_vinculados: [],
        data_proxima_revisao: risco.data_proxima_revisao || ''
      });

      // Forçar seleção da matriz após reset do form
      if (risco.matriz_id) {
        const matriz = matrizes.find(m => m.id === risco.matriz_id);
        if (matriz && matriz.configuracao && matriz.configuracao[0]) {
          logger.debug('✅ Matriz carregada automaticamente:', matriz.nome);
          setSelectedMatriz({
            ...matriz,
            configuracao: {
              ...matriz.configuracao[0],
              metodo_calculo: matriz.configuracao[0].metodo_calculo || 'multiplicacao'
            }
          } as any);
        }
      }

      if (risco.id) {
        fetchAnexosAceite(risco.id);
        fetchAtivosVinculados(risco.id);
      }
    }
  }, [risco, matrizes]);

  useEffect(() => {
    if (watchMatrizId) {
      const matriz = matrizes.find(m => m.id === watchMatrizId);
      if (matriz && matriz.configuracao && matriz.configuracao[0]) {
        setSelectedMatriz({
          ...matriz,
          configuracao: {
            ...matriz.configuracao[0],
            metodo_calculo: matriz.configuracao[0].metodo_calculo || 'multiplicacao'
          }
        } as any);
      } else {
        setSelectedMatriz(matriz || null);
      }
    }
  }, [watchMatrizId, matrizes]);

  const fetchData = async () => {
    if (!profile?.empresa_id) return;
    try {
      const [matrizesRes, categoriasRes, ativosRes] = await Promise.all([
        supabase.from('riscos_matrizes').select(`
          id,
          nome,
          configuracao:riscos_matriz_configuracao(
            escala_probabilidade,
            escala_impacto,
            niveis_risco,
            metodo_calculo
          )
        `).eq('empresa_id', profile.empresa_id),
        supabase.from('riscos_categorias').select('id, nome, cor').eq('empresa_id', profile.empresa_id),
        supabase.from('ativos').select('id, nome, tipo').eq('empresa_id', profile.empresa_id)
      ]);

      if (matrizesRes.data) setMatrizes(matrizesRes.data);
      if (categoriasRes.data) setCategorias(categoriasRes.data);
      if (ativosRes.data) setAtivos(ativosRes.data);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    }
  };

  const fetchAnexosAceite = async (riscoId: string) => {
    try {
      const { data, error } = await supabase
        .from('riscos_anexos')
        .select('*')
        .eq('risco_id', riscoId)
        .eq('tipo_anexo', 'aceite')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const anexosFormatados = (data || []).map(anexo => ({
        id: anexo.id,
        nome_arquivo: anexo.nome_arquivo,
        url_arquivo: anexo.url_arquivo,
        tipo_arquivo: anexo.tipo_arquivo,
        tamanho_arquivo: anexo.tamanho_arquivo,
        created_at: anexo.created_at
      }));
      
      setAnexosAceite(anexosFormatados);
    } catch (error: any) {
      logger.error('Erro ao buscar anexos:', error);
    }
  };

  const fetchAtivosVinculados = async (riscoId: string) => {
    try {
      const { data } = await supabase
        .from('riscos_ativos')
        .select('ativo_id')
        .eq('risco_id', riscoId);

      if (data) {
        form.setValue('ativos_vinculados', data.map(av => av.ativo_id));
      }
    } catch (error) {
      logger.error('Erro ao buscar ativos vinculados:', error);
    }
  };

  const calcularNivelRisco = (probabilidade: string, impacto: string, metodoCalculo: string = 'multiplicacao'): string => {
    if (!selectedMatriz?.configuracao || !probabilidade || !impacto) return '';

    const probValue = parseInt(probabilidade);
    const impactValue = parseInt(impacto);
    
    if (isNaN(probValue) || isNaN(impactValue)) return '';
    
    const resultado = metodoCalculo === 'multiplicacao' 
      ? probValue * impactValue
      : probValue + impactValue;

    const config = selectedMatriz.configuracao as any;
    const nivel = config.niveis_risco?.find((n: any) => 
      resultado >= n.min && resultado <= n.max
    );

    return nivel?.nivel || '';
  };

  const nivelInicialCalculado = calcularNivelRisco(
    watchProbabilidade, 
    watchImpacto,
    (selectedMatriz?.configuracao as any)?.metodo_calculo || 'multiplicacao'
  );

  const nivelResidualCalculado = calcularNivelRisco(
    watchProbabilidadeResidual || '', 
    watchImpactoResidual || '',
    (selectedMatriz?.configuracao as any)?.metodo_calculo || 'multiplicacao'
  );

  const onSubmit = async (data: RiscoForm) => {
    logger.debug('🚀 onSubmit chamado com dados:', data);
    
    if (!profile?.empresa_id) {
      toast.error('Erro: Empresa não identificada');
      return;
    }
    
    // Validar campos obrigatórios
    if (!data.matriz_id) {
      toast.error('Erro: Matriz de risco é obrigatória');
      return;
    }
    
    if (!selectedMatriz) {
      toast.error('Erro: Configuração da matriz não carregada');
      return;
    }

    // Validar aceite: aprovador e justificativa obrigatórios
    if (data.aceito && !data.aprovador_aceite) {
      toast.error('Selecione um aprovador para o aceite do risco');
      return;
    }
    if (data.aceito && !data.justificativa_aceite) {
      toast.error('A justificativa é obrigatória para o aceite do risco');
      return;
    }
    if (data.aceito && !data.data_proxima_revisao) {
      toast.error('A data da próxima revisão é obrigatória para o aceite do risco');
      return;
    }

    setLoading(true);

    try {
      const nivelInicial = calcularNivelRisco(
        data.probabilidade_inicial, 
        data.impacto_inicial,
        (selectedMatriz?.configuracao as any)?.metodo_calculo || 'multiplicacao'
      );

      if (!nivelInicial) {
        toast.error('Não foi possível calcular o nível de risco. Verifique se a matriz está configurada corretamente com os níveis de risco.');
        setLoading(false);
        return;
      }
      const nivelResidual = data.probabilidade_residual && data.impacto_residual 
        ? calcularNivelRisco(
            data.probabilidade_residual, 
            data.impacto_residual,
            (selectedMatriz?.configuracao as any)?.metodo_calculo || 'multiplicacao'
          )
        : null;

      // Se aceite marcado: NÃO marcar aceito=true, enviar para aprovação
      const isNovoAceite = data.aceito && (!risco?.status_aceite || risco?.status_aceite === 'rejeitado');

      const riscoData: any = {
        nome: data.nome,
        descricao: data.descricao,
        empresa_id: profile.empresa_id,
        matriz_id: data.matriz_id || null,
        categoria_id: data.categoria_id || null,
        probabilidade_inicial: data.probabilidade_inicial,
        impacto_inicial: data.impacto_inicial,
        nivel_risco_inicial: nivelInicial,
        probabilidade_residual: data.probabilidade_residual || null,
        impacto_residual: data.impacto_residual || null,
        nivel_risco_residual: nivelResidual,
        status: data.status,
        responsavel: data.responsavel || null,
        controles_existentes: data.controles_existentes || null,
        causas: data.causas || null,
        consequencias: data.consequencias || null,
        aceito: isNovoAceite ? false : (data.aceito && risco?.status_aceite === 'aprovado'),
        justificativa_aceite: data.justificativa_aceite || null,
        aprovador_aceite: data.aprovador_aceite || null,
        data_proxima_revisao: data.data_proxima_revisao || null,
        status_aceite: isNovoAceite ? 'pendente' : (data.aceito ? (risco?.status_aceite || null) : null),
        ...(risco?.id ? {} : { created_by: profile.user_id }),
      };

      let riscoId: string;

      if (risco?.id) {
        const { error } = await supabase
          .from('riscos')
          .update(riscoData)
          .eq('id', risco.id);

        if (error) throw error;
        riscoId = risco.id;
      } else {
        const { data: newRisco, error } = await supabase
          .from('riscos')
          .insert([riscoData])
          .select()
          .single();

        if (error) throw error;
        riscoId = newRisco.id;
        
        // Notificar integrações sobre novo risco
        const nivelGravidadeMap: Record<string, 'baixa' | 'media' | 'alta' | 'critica'> = {
          'baixo': 'baixa',
          'medio': 'media',
          'alto': 'alta',
          'critico': 'critica'
        };
        
        await notify('risco_identificado', {
          titulo: `Novo Risco: ${data.nome}`,
          descricao: data.descricao || `Risco identificado com nível ${nivelInicial}`,
          link: `${window.location.origin}/riscos`,
          gravidade: nivelGravidadeMap[nivelInicial?.toLowerCase()] || 'media',
          dados: { nivel: nivelInicial, status: data.status }
        });
        
        for (const anexo of anexosAceite) {
          if (!anexo.id && riscoId) {
            try {
              await supabase.from('riscos_anexos').insert({
                risco_id: riscoId,
                nome_arquivo: anexo.nome_arquivo,
                url_arquivo: anexo.url_arquivo,
                tipo_arquivo: anexo.tipo_arquivo,
                tamanho_arquivo: anexo.tamanho_arquivo,
                tipo_anexo: 'aceite',
                empresa_id: profile.empresa_id,
                created_by: profile.user_id
              });
            } catch (anexoError) {
              logger.error('Erro ao salvar anexo:', anexoError);
            }
          }
        }
      }

      // Atualizar vínculos com ativos
      await supabase.from('riscos_ativos').delete().eq('risco_id', riscoId);
      
      if (data.ativos_vinculados.length > 0) {
        const vinculos = data.ativos_vinculados.map(ativoId => ({
          risco_id: riscoId,
          ativo_id: ativoId
        }));

        await supabase.from('riscos_ativos').insert(vinculos);
      }

      // Registrar histórico de avaliação automaticamente
      try {
        await supabase.from('riscos_historico_avaliacoes').insert([
          {
            risco_id: riscoId,
            empresa_id: profile.empresa_id,
            probabilidade: data.probabilidade_inicial,
            impacto: data.impacto_inicial,
            nivel_risco: nivelInicial,
            tipo: 'inicial',
            avaliado_por: profile.user_id,
            observacoes: risco?.id ? 'Reavaliação do risco' : 'Avaliação inicial'
          },
          ...(nivelResidual ? [{
            risco_id: riscoId,
            empresa_id: profile.empresa_id,
            probabilidade: data.probabilidade_residual!,
            impacto: data.impacto_residual!,
            nivel_risco: nivelResidual,
            tipo: 'residual',
            avaliado_por: profile.user_id,
            observacoes: risco?.id ? 'Reavaliação residual' : 'Avaliação residual inicial'
          }] : [])
        ]);
      } catch (histError) {
        logger.warn('Erro ao registrar histórico de avaliação:', histError);
      }

      // Se é um novo aceite, enviar notificação e e-mail ao aprovador
      if (isNovoAceite && data.aprovador_aceite) {
        try {
          // Notificação in-app
          await supabase.from('notifications').insert({
            user_id: data.aprovador_aceite,
            title: 'Solicitação de Aceite de Risco',
            message: `O risco "${data.nome}" foi enviado para sua aprovação de aceite.`,
            type: 'info',
            link_to: '/riscos'
          });

          // E-mail via edge function
          await supabase.functions.invoke('send-risco-aceite-notification', {
            body: {
              risco_id: riscoId,
              risco_nome: data.nome,
              aprovador_id: data.aprovador_aceite,
              solicitante_id: profile.user_id,
              empresa_id: profile.empresa_id,
              tipo: 'solicitacao'
            }
          });
        } catch (notifError) {
          logger.warn('Erro ao enviar notificação de aceite:', notifError);
        }
      }

      toast.success(
        isNovoAceite 
          ? 'Risco salvo e enviado para aprovação de aceite!' 
          : (risco?.id ? 'Risco atualizado com sucesso!' : 'Risco cadastrado com sucesso!')
      );
      onSuccess();
    } catch (error: any) {
      logger.error('❌ Erro ao salvar risco:', error);
      toast.error('Erro ao salvar risco: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  // Status visual da aba (preenchido / com erro)
  const watchNome = form.watch('nome');
  const watchMatriz = form.watch('matriz_id');
  const watchStatus = form.watch('status');
  const errors = form.formState.errors;

  const tabState = (key: TabKey): 'completed' | 'error' | 'pending' => {
    if (key === 'identificacao') {
      if (errors.nome || errors.matriz_id) return 'error';
      return watchNome && watchMatriz ? 'completed' : 'pending';
    }
    if (key === 'avaliacao') {
      if (errors.probabilidade_inicial || errors.impacto_inicial) return 'error';
      return watchProbabilidade && watchImpacto ? 'completed' : 'pending';
    }
    if (key === 'detalhes') {
      // status tem default 'identificado' — exigir pelo menos um campo livre preenchido.
      const causas = form.getValues('causas');
      const consequencias = form.getValues('consequencias');
      const controles = form.getValues('controles_existentes');
      const ativos = form.getValues('ativos_vinculados');
      return (causas?.trim() || consequencias?.trim() || controles?.trim() || (ativos && ativos.length > 0)) ? 'completed' : 'pending';
    }
    if (key === 'residual') {
      return watchProbabilidadeResidual && watchImpactoResidual ? 'completed' : 'pending';
    }
    if (key === 'aceite') {
      return watchAceito ? 'completed' : 'pending';
    }
    return 'pending';
  };

  const nivelCorClass = (nivel: string) => {
    const n = nivel?.toLowerCase() || '';
    if (n.includes('crít') || n.includes('crit')) return 'bg-destructive text-destructive-foreground border-destructive';
    if (n.includes('alto')) return 'bg-destructive/85 text-destructive-foreground border-destructive/85';
    if (n.includes('médio') || n.includes('medio')) return 'bg-warning text-warning-foreground border-warning';
    if (n.includes('baixo')) return 'bg-success text-success-foreground border-success';
    return 'bg-muted text-foreground border-border';
  };

  const tabsMeta: Array<{ key: TabKey; label: string; icon: any; description: string }> = [
    { key: 'identificacao', label: 'Identificação', icon: FileText, description: 'Nome, categoria e matriz' },
    { key: 'avaliacao', label: 'Avaliação Inicial', icon: Gauge, description: 'Probabilidade × Impacto' },
    { key: 'detalhes', label: 'Detalhes', icon: Settings2, description: 'Status, controles, ativos' },
    { key: 'residual', label: 'Residual', icon: Link2, description: 'Após mitigação' },
    { key: 'aceite', label: 'Aceite', icon: ShieldCheck, description: 'Aprovação formal' },
  ];

  const TabIndicator = ({ state }: { state: 'completed' | 'error' | 'pending' }) => {
    if (state === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (state === 'error') return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
  };

  const currentIdx = TABS.indexOf(activeTab);
  const isLastTab = currentIdx === TABS.length - 1;
  const isFirstTab = currentIdx === 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Sidebar — Navegação + Resumo Vivo (desktop) */}
          <aside className="hidden lg:flex flex-col w-72 border-r bg-muted/30 flex-shrink-0">
            <div className="p-4 border-b">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Etapas</h3>
              <TabsList className="flex flex-col h-auto w-full bg-transparent border-0 gap-1 p-0">
                {tabsMeta.map((t) => {
                  const state = tabState(t.key);
                  return (
                    <TabsTrigger
                      key={t.key}
                      value={t.key}
                      className={cn(
                        "w-full justify-start px-3 py-2.5 h-auto rounded-md border border-transparent",
                        "data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:shadow-sm",
                        "data-[state=active]:after:hidden hover:bg-background/60"
                      )}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <t.icon className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium truncate">{t.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                        </div>
                        <TabIndicator state={state} />
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Resumo Vivo */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo</h3>
              <Card className="bg-background">
                <CardContent className="p-3 space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Nome</div>
                    <div className="font-medium truncate" title={watchNome}>
                      {watchNome || <span className="text-muted-foreground italic">Não informado</span>}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Nível Inicial</div>
                    {nivelInicialCalculado ? (
                      <Badge className={cn("border", nivelCorClass(nivelInicialCalculado))}>
                        {nivelInicialCalculado}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">P × I não definido</span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Nível Residual</div>
                    {nivelResidualCalculado ? (
                      <Badge className={cn("border", nivelCorClass(nivelResidualCalculado))}>
                        {nivelResidualCalculado}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Não avaliado</span>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <Badge variant="outline" className="capitalize">{watchStatus || '—'}</Badge>
                  </div>
                  {risco?.status_aceite && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Aceite</div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          risco.status_aceite === 'pendente' && "border-yellow-500 text-yellow-700 dark:text-yellow-400",
                          risco.status_aceite === 'aprovado' && "border-emerald-500 text-emerald-700 dark:text-emerald-400",
                          risco.status_aceite === 'rejeitado' && "border-destructive text-destructive"
                        )}
                      >
                        {risco.status_aceite}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Tabs horizontais — apenas mobile/tablet */}
          <div className="lg:hidden border-b bg-muted/30 px-4 py-2 overflow-x-auto flex-shrink-0">
            <TabsList className="bg-transparent border-0 h-auto p-0 w-max">
              {tabsMeta.map((t) => {
                const state = tabState(t.key);
                return (
                  <TabsTrigger
                    key={t.key}
                    value={t.key}
                    className="px-3 py-1.5 data-[state=active]:after:hidden data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border rounded-md"
                  >
                    <span className="flex items-center gap-2">
                      <t.icon className="h-4 w-4" />
                      <span className="text-sm">{t.label}</span>
                      <TabIndicator state={state} />
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 min-h-0">
            {/* IDENTIFICAÇÃO */}
            <TabsContent value="identificacao" className="mt-0 space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Identificação do Risco</h2>
                <p className="text-sm text-muted-foreground">Defina o nome, categoria, responsável e a matriz de avaliação.</p>
              </div>

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Risco *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Falha de backup de dados" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoria_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categorias.map((categoria) => (
                            <SelectItem key={categoria.id} value={categoria.id}>
                              <div className="flex items-center gap-2">
                                {categoria.cor && (
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: categoria.cor }}
                                  />
                                )}
                                {categoria.nome}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <UserSelect
                          value={field.value || ''}
                          onValueChange={field.onChange}
                          placeholder="Selecione um responsável"
                        />
                      </FormControl>
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
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o risco detalhadamente..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="matriz_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matriz de Risco *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a matriz" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {matrizes.map((matriz) => (
                          <SelectItem key={matriz.id} value={matriz.id}>
                            {matriz.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>A matriz define como o risco será avaliado</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            {/* AVALIAÇÃO INICIAL */}
            <TabsContent value="avaliacao" className="mt-0 space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><Gauge className="h-5 w-5" /> Avaliação Inicial</h2>
                <p className="text-sm text-muted-foreground">Probabilidade × Impacto sem considerar controles.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="probabilidade_inicial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probabilidade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(selectedMatriz?.configuracao as any)?.escala_probabilidade?.length > 0
                            ? ((selectedMatriz?.configuracao as any)?.escala_probabilidade || []).map((item: any) => (
                                <SelectItem key={item.valor} value={item.valor.toString()}>
                                  {item.valor} - {item.descricao}
                                </SelectItem>
                              ))
                            : [1, 2, 3, 4, 5].map((value) => (
                                <SelectItem key={value} value={value.toString()}>
                                  {value}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="impacto_inicial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Impacto *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(selectedMatriz?.configuracao as any)?.escala_impacto?.length > 0
                            ? ((selectedMatriz?.configuracao as any)?.escala_impacto || []).map((item: any) => (
                                <SelectItem key={item.valor} value={item.valor.toString()}>
                                  {item.valor} - {item.descricao}
                                </SelectItem>
                              ))
                            : [1, 2, 3, 4, 5].map((value) => (
                                <SelectItem key={value} value={value.toString()}>
                                  {value}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {nivelInicialCalculado && (
                <Card className={cn("border-2", nivelCorClass(nivelInicialCalculado).split(' ').filter(c => c.startsWith('border-')).join(' '))}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Nível de Risco Calculado</div>
                      <div className="text-2xl font-bold mt-1">{nivelInicialCalculado}</div>
                    </div>
                    <Badge className={cn("text-base px-3 py-1.5 border", nivelCorClass(nivelInicialCalculado))}>
                      P{watchProbabilidade} × I{watchImpacto}
                    </Badge>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="causas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Causas</FormLabel>
                      <FormControl>
                        <Textarea placeholder="O que pode causar este risco?" className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="consequencias"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consequências</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Quais os impactos se ocorrer?" className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            {/* DETALHES */}
            <TabsContent value="detalhes" className="mt-0 space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><Settings2 className="h-5 w-5" /> Detalhes Adicionais</h2>
                <p className="text-sm text-muted-foreground">Status, controles existentes e ativos vinculados.</p>
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="identificado">Identificado</SelectItem>
                        <SelectItem value="analisado">Analisado</SelectItem>
                        <SelectItem value="tratado">Tratado</SelectItem>
                        <SelectItem value="monitorado">Monitorado</SelectItem>
                        <SelectItem value="aceito">Aceito</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_proxima_revisao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Próxima Revisão</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>Agende quando este risco deve ser reavaliado</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="controles_existentes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Controles Existentes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva os controles já implementados..." className="min-h-[80px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Ativos Vinculados</FormLabel>
                <FormField
                  control={form.control}
                  name="ativos_vinculados"
                  render={({ field }) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                      {ativos.length === 0 ? (
                        <p className="text-sm text-muted-foreground col-span-2">Nenhum ativo cadastrado</p>
                      ) : (
                        ativos.map((ativo) => (
                          <div key={ativo.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={ativo.id}
                              checked={field.value.includes(ativo.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, ativo.id]);
                                } else {
                                  field.onChange(field.value.filter((id) => id !== ativo.id));
                                }
                              }}
                            />
                            <label htmlFor={ativo.id} className="text-sm font-medium leading-none cursor-pointer">
                              {ativo.nome}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                />
              </div>
            </TabsContent>

            {/* RESIDUAL */}
            <TabsContent value="residual" className="mt-0 space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><Link2 className="h-5 w-5" /> Avaliação Residual</h2>
                <p className="text-sm text-muted-foreground">Reavalie o risco após implementação de controles. Esta etapa é opcional.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="probabilidade_residual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probabilidade Residual</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(selectedMatriz?.configuracao as any)?.escala_probabilidade?.length > 0
                            ? ((selectedMatriz?.configuracao as any)?.escala_probabilidade || []).map((item: any) => (
                                <SelectItem key={item.valor} value={item.valor.toString()}>
                                  {item.valor} - {item.descricao}
                                </SelectItem>
                              ))
                            : [1, 2, 3, 4, 5].map((value) => (
                                <SelectItem key={value} value={value.toString()}>
                                  {value}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="impacto_residual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Impacto Residual</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(selectedMatriz?.configuracao as any)?.escala_impacto?.length > 0
                            ? ((selectedMatriz?.configuracao as any)?.escala_impacto || []).map((item: any) => (
                                <SelectItem key={item.valor} value={item.valor.toString()}>
                                  {item.valor} - {item.descricao}
                                </SelectItem>
                              ))
                            : [1, 2, 3, 4, 5].map((value) => (
                                <SelectItem key={value} value={value.toString()}>
                                  {value}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {nivelResidualCalculado && (
                <Card className={cn("border-2", nivelCorClass(nivelResidualCalculado).split(' ').filter(c => c.startsWith('border-')).join(' '))}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Nível Residual Calculado</div>
                      <div className="text-2xl font-bold mt-1">{nivelResidualCalculado}</div>
                    </div>
                    <Badge className={cn("text-base px-3 py-1.5 border", nivelCorClass(nivelResidualCalculado))}>
                      P{watchProbabilidadeResidual} × I{watchImpactoResidual}
                    </Badge>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ACEITE */}
            <TabsContent value="aceite" className="mt-0 space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Aceite do Risco</h2>
                <p className="text-sm text-muted-foreground">Solicite aprovação formal para aceitar este risco. Esta etapa é opcional.</p>
              </div>

              {risco?.status_aceite && (
                <div className={cn(
                  "p-3 rounded-lg text-sm flex items-center gap-2 border",
                  risco.status_aceite === 'pendente' && "bg-warning/10 text-warning border-warning/30",
                  risco.status_aceite === 'aprovado' && "bg-success/10 text-success border-success/30",
                  risco.status_aceite === 'rejeitado' && "bg-destructive/10 text-destructive border-destructive/30"
                )}>
                  {risco.status_aceite === 'pendente' && '⏳ Aceite pendente de aprovação'}
                  {risco.status_aceite === 'aprovado' && '✅ Aceite aprovado'}
                  {risco.status_aceite === 'rejeitado' && '❌ Aceite rejeitado — você pode reenviar'}
                </div>
              )}

              <FormField
                control={form.control}
                name="aceito"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-lg bg-muted/30">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={risco?.status_aceite === 'pendente' || risco?.status_aceite === 'aprovado'}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Solicitar aceite formal deste risco</FormLabel>
                      <FormDescription>
                        Ao marcar, será necessário indicar um aprovador e aguardar a aprovação
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {watchAceito && (
                <>
                  <FormField
                    control={form.control}
                    name="aprovador_aceite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aprovador do Aceite *</FormLabel>
                        <FormControl>
                          <UserSelect
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            placeholder="Selecione quem aprovará o aceite"
                          />
                        </FormControl>
                        <FormDescription>
                          Esta pessoa receberá uma notificação e e-mail para aprovar ou rejeitar
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="justificativa_aceite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justificativa do Aceite *</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Justifique a decisão de aceitar o risco..." className="min-h-[80px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_proxima_revisao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Próxima Revisão *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>Data obrigatória para reavaliar o aceite do risco</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {risco?.id && (
                    <div className="space-y-2">
                      <FormLabel>Anexos de Aceite</FormLabel>
                      <RiscoAnexosUpload
                        riscoId={risco.id}
                        anexos={anexosAceite}
                        onAnexosChange={setAnexosAceite}
                        tipoAnexo="aceite"
                      />
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer sticky */}
        <div className="flex-shrink-0 border-t bg-background px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => goToTab('prev')}
            disabled={isFirstTab}
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            Etapa <span className="font-semibold text-foreground">{currentIdx + 1}</span> de {TABS.length}
          </div>

          <div className="flex items-center gap-2">
            {!isLastTab && (
              <Button type="button" variant="outline" onClick={() => goToTab('next')} size="sm">
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button type="submit" disabled={loading} size="sm">
              <Save className="h-4 w-4 mr-1.5" />
              {loading ? 'Salvando...' : risco ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
