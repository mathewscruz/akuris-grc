import { logger } from '@/lib/logger';
import { IconSuccess, IconWarning, IconInfo, IconFile, IconChevron, IconSave, IconGauge, IconSettings, IconLink, IconShieldCheck, IconChevronLeft } from '@/components/icons';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { financialExposure } from './risk-utils';
import { nivelRiscoFromConfig, type MatrizConfiguracao } from './matriz-config';
import { useEmpresaMoeda } from '@/hooks/useEmpresaMoeda';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { UserSelect } from './UserSelect';
import { RiscoAnexosUpload } from './RiscoAnexosUpload';
import { cn } from '@/lib/utils';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { motivoBloqueioTratado, podeMarcarTratado, resumirTratamentos, STATUS_TRATADO } from './risk-status';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatarDiaParaDB, parseDataLocal } from '@/lib/date-utils';
import { notificar } from '@/lib/notificar';
import { exigirEscrita } from '@/lib/supabase-write';

const makeRiscoSchema = (t: (k: string) => string) => z.object({
  nome: z.string().min(1, t('fin.validacao.nomeObrigatorio')),
  codigo: z.string().trim().max(20).regex(/^$|^[A-Za-z0-9][A-Za-z0-9._-]*$/, t('fin.validacao.codigoInvalido')).optional(),
  categoria_id: z.string().optional(),
  descricao: z.string().optional(),
  matriz_id: z.string().min(1, t('fin.validacao.matrizObrigatoria')),
  responsavel: z.string().optional(),
  probabilidade_inicial: z.string().min(1, t('fin.validacao.probabilidadeObrigatoria')),
  impacto_inicial: z.string().min(1, t('fin.validacao.impactoObrigatorio')),
  impacto_financeiro: z.string().optional(),
  causas: z.string().optional(),
  consequencias: z.string().optional(),
  status: z.string().min(1, t('fin.validacao.statusObrigatorio')),
  controles_existentes: z.string().optional(),
  probabilidade_residual: z.string().optional(),
  impacto_residual: z.string().optional(),
  aceito: z.boolean().default(false),
  justificativa_aceite: z.string().optional(),
  aprovador_aceite: z.string().optional(),
  aceite_valido_ate: z.string().optional(),
  ativos_vinculados: z.array(z.string()).default([]),
  data_proxima_revisao: z.string().optional()
});

type RiscoForm = z.infer<ReturnType<typeof makeRiscoSchema>>;

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
  const { t } = useLanguage();
  const { format: formatMoedaEmpresa, simbolo: simboloMoeda } = useEmpresaMoeda();
  const { profile } = useAuth();
  const { notify } = useIntegrationNotify();
  const [loading, setLoading] = useState(false);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [selectedMatriz, setSelectedMatriz] = useState<Matriz | null>(null);
  const [anexosAceite, setAnexosAceite] = useState<any[]>([]);
  const [invalidarAceiteOpen, setInvalidarAceiteOpen] = useState(false);
  const [pendingData, setPendingData] = useState<RiscoForm | null>(null);
  
  const TABS = ['identificacao', 'avaliacao', 'detalhes', 'residual', 'aceite'] as const;
  type TabKey = typeof TABS[number];
  const [activeTab, setActiveTab] = useState<TabKey>('identificacao');

  /** DEFECT 5 — campos obrigatórios por etapa (validação inline via RHF/zod). */
  const REQUIRED_FIELDS_BY_TAB: Record<TabKey, (keyof RiscoForm)[]> = {
    identificacao: ['nome', 'matriz_id'],
    avaliacao: ['probabilidade_inicial', 'impacto_inicial'],
    detalhes: [],
    residual: [],
    aceite: [],
  };

  const goToTab = async (direction: 'prev' | 'next') => {
    const idx = TABS.indexOf(activeTab);
    if (direction === 'next') {
      const fields = REQUIRED_FIELDS_BY_TAB[activeTab];
      if (fields.length > 0) {
        const valid = await form.trigger(fields as any);
        if (!valid) return;
      }
    }
    const nextIdx = direction === 'next' ? Math.min(idx + 1, TABS.length - 1) : Math.max(idx - 1, 0);
    setActiveTab(TABS[nextIdx]);
  };

  const riscoSchema = useMemo(() => makeRiscoSchema(t), [t]);

  const form = useForm<RiscoForm>({
    resolver: zodResolver(riscoSchema),
    defaultValues: {
      nome: '',
      codigo: '',
      descricao: '',
      matriz_id: '',
      categoria_id: '',
      responsavel: '',
      probabilidade_inicial: '',
      impacto_inicial: '',
      impacto_financeiro: '',
      probabilidade_residual: '',
      impacto_residual: '',
      status: 'identificado',
      controles_existentes: '',
      causas: '',
      consequencias: '',
      aceito: false,
      justificativa_aceite: '',
      aprovador_aceite: '',
      aceite_valido_ate: '',
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
      logger.debug('📝 Carregando dados do risco para edição:', { data: risco });
      
      form.reset({
        nome: risco.nome || '',
        codigo: (risco as any).codigo || '',
        descricao: risco.descricao || '',
        matriz_id: risco.matriz_id || '',
        categoria_id: risco.categoria_id || '',
        responsavel: risco.responsavel || '',
        probabilidade_inicial: risco.probabilidade_inicial?.toString() || '',
        impacto_inicial: risco.impacto_inicial?.toString() || '',
        impacto_financeiro: (risco as any).impacto_financeiro != null ? String((risco as any).impacto_financeiro) : '',
        probabilidade_residual: risco.probabilidade_residual?.toString() || '',
        impacto_residual: risco.impacto_residual?.toString() || '',
        status: risco.status || 'identificado',
        controles_existentes: risco.controles_existentes || '',
        causas: risco.causas || '',
        consequencias: risco.consequencias || '',
        aceito: risco.aceito || false,
        justificativa_aceite: risco.justificativa_aceite || '',
        aprovador_aceite: risco.aprovador_aceite || '',
        aceite_valido_ate: (risco as any).aceite_valido_ate || '',
        ativos_vinculados: [],
        data_proxima_revisao: risco.data_proxima_revisao || ''
      });

      // Forçar seleção da matriz após reset do form
      if (risco.matriz_id) {
        const matriz = matrizes.find(m => m.id === risco.matriz_id);
        if (matriz && matriz.configuracao && matriz.configuracao[0]) {
          logger.debug('Matriz carregada automaticamente', { data: matriz.nome });
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

      // Só matrizes com configuração: sem escalas/faixas o nível não é calculável.
      if (matrizesRes.data) setMatrizes(matrizesRes.data.filter(m => m.configuracao?.[0]));

      if (categoriasRes.data) setCategorias(categoriasRes.data);
      if (ativosRes.data) setAtivos(ativosRes.data);
    } catch (error: any) {
      toast.error(t('fin.comum.erroCarregarDados', { mensagem: error.message }));
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
      logger.error('Erro ao buscar anexos:', { data: error });
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
      logger.error('Erro ao buscar ativos vinculados:', { data: error });
    }
  };

  /**
   * Pré-visualização do nível enquanto se preenche. Era uma cópia local da
   * mesma aritmética que vive em `nivelRiscoFromConfig` — e o que ia para o
   * banco vinha desta cópia. Hoje o valor gravado é sempre o do trigger
   * `trg_risco_calcular`; isto aqui só mostra.
   */
  const configMatriz = (selectedMatriz?.configuracao ?? null) as MatrizConfiguracao | null;

  const nivelInicialCalculado =
    nivelRiscoFromConfig(watchProbabilidade, watchImpacto, configMatriz) || '';

  const nivelResidualCalculado =
    nivelRiscoFromConfig(watchProbabilidadeResidual, watchImpactoResidual, configMatriz) || '';

  /**
   * Reavaliar (probabilidade, impacto ou controlos) invalida o aceite vigente.
   */
  const reavaliacaoInvalidaAceite = (data: RiscoForm) => {
    if (!risco) return false;
    const mudou = (a: any, b: any) => String(a ?? '') !== String(b ?? '');
    return (
      mudou(data.probabilidade_inicial, risco.probabilidade_inicial) ||
      mudou(data.impacto_inicial, risco.impacto_inicial) ||
      mudou(data.probabilidade_residual, risco.probabilidade_residual) ||
      mudou(data.impacto_residual, risco.impacto_residual) ||
      mudou(data.controles_existentes, risco.controles_existentes)
    );
  };

  const onSubmit = async (data: RiscoForm, confirmadoInvalidar = false) => {
    logger.debug('🚀 onSubmit chamado com dados:', { data: data });

    // (g) Reavaliar um risco com aceite vigente invalida o aceite: avisar antes de guardar.
    if (!confirmadoInvalidar && risco?.id && risco?.aceito && reavaliacaoInvalidaAceite(data)) {
      setPendingData(data);
      setInvalidarAceiteOpen(true);
      return;
    }
    const invalidarAceite = !!(risco?.id && risco?.aceito && reavaliacaoInvalidaAceite(data));
    
    if (!profile?.empresa_id) {
      toast.error(t('fin.riscos.wizard.erroEmpresa'));
      return;
    }
    
    // Validar campos obrigatórios
    if (!data.matriz_id) {
      toast.error(t('fin.riscos.wizard.erroMatriz'));
      return;
    }
    
    if (!selectedMatriz) {
      toast.error(t('fin.riscos.wizard.erroConfigMatriz'));
      return;
    }

    // QA-065: criação não pode começar como Tratado; em edição, a evidência
    // persistida precisa conter >= 1 tratamento requerido e todos concluídos.
    if (data.status === STATUS_TRATADO) {
      if (!risco?.id) {
        toast.error(motivoBloqueioTratado({ requeridos: 0, concluidos: 0 }));
        return;
      }
      const { data: tratamentos, error: tratamentosError } = await supabase
        .from('riscos_tratamentos')
        .select('status')
        .eq('risco_id', risco.id);
      if (tratamentosError) {
        toast.error(t('fin.riscos.wizard.erroValidarTratamentos'));
        return;
      }
      const resumo = resumirTratamentos(tratamentos);
      if (!podeMarcarTratado(resumo)) {
        toast.error(motivoBloqueioTratado(resumo));
        return;
      }
    }

    // Validar aceite: aprovador e justificativa obrigatórios
    if (data.aceito && !data.aprovador_aceite) {
      toast.error(t('fin.riscos.wizard.erroAprovador'));
      return;
    }
    if (data.aceito && !data.justificativa_aceite) {
      toast.error(t('fin.riscos.wizard.erroJustificativa'));
      return;
    }
    if (data.aceito && !data.data_proxima_revisao) {
      toast.error(t('fin.riscos.wizard.erroDataRevisao'));
      return;
    }
    if (data.aceito && !data.aceite_valido_ate) {
      toast.error('Indique até quando o aceite é válido.');
      return;
    }
    if (data.aceito && data.aceite_valido_ate && parseDataLocal(data.aceite_valido_ate) <= new Date()) {
      toast.error('A validade do aceite tem de ser uma data futura.');
      return;
    }

    setLoading(true);

    try {
      // O nível não é enviado: `trg_risco_calcular` calcula-o a partir de
      // probabilidade × impacto e da matriz vigente. Mandá-lo daqui era a via
      // por onde entravam os rótulos que depois divergiam da matriz.
      const nivelInicial = nivelRiscoFromConfig(
        data.probabilidade_inicial, data.impacto_inicial, configMatriz,
      );
      if (!nivelInicial) {
        toast.error(t('fin.riscos.wizard.erroCalculoNivel'));
        setLoading(false);
        return;
      }
      const nivelResidual = nivelRiscoFromConfig(
        data.probabilidade_residual, data.impacto_residual, configMatriz,
      );

      // Se aceite marcado: NÃO marcar aceito=true, enviar para aprovação
      const isNovoAceite = data.aceito && (!risco?.status_aceite || risco?.status_aceite === 'rejeitado');

      const codigoManual = (data.codigo || '').trim();
      const riscoData: any = {
        nome: data.nome,
        // Código: se o utilizador não indicar, o backend gera sequencialmente (R-0001...).
        ...(codigoManual ? { codigo: codigoManual } : {}),
        descricao: data.descricao,
        empresa_id: profile.empresa_id,
        // `matriz_id` e os níveis são preenchidos pelo trigger.
        categoria_id: data.categoria_id || null,
        probabilidade_inicial: Number(data.probabilidade_inicial),
        impacto_inicial: Number(data.impacto_inicial),
        probabilidade_residual: data.probabilidade_residual ? Number(data.probabilidade_residual) : null,
        impacto_residual: data.impacto_residual ? Number(data.impacto_residual) : null,
        status: invalidarAceite ? 'em_revisao' : data.status,
        responsavel: data.responsavel || null,
        controles_existentes: data.controles_existentes || null,
        causas: data.causas || null,
        consequencias: data.consequencias || null,
        aceito: invalidarAceite ? false : (isNovoAceite ? false : (data.aceito && risco?.status_aceite === 'aprovado')),
        justificativa_aceite: data.justificativa_aceite || null,
        aprovador_aceite: data.aprovador_aceite || null,
        aceite_valido_ate: data.aceite_valido_ate || null,
        data_proxima_revisao: data.data_proxima_revisao || null,
        status_aceite: invalidarAceite
          ? 'invalidado'
          : (isNovoAceite ? 'pendente' : (data.aceito ? (risco?.status_aceite || null) : null)),
        ...(invalidarAceite
          ? {
              historico_aceite: [
                ...(((risco as any)?.historico_aceite as any[]) || []),
                {
                  evento: 'invalidado_por_reavaliacao',
                  em: new Date().toISOString(),
                  por: profile.user_id,
                  valido_ate: (risco as any)?.aceite_valido_ate || null,
                  justificativa: risco?.justificativa_aceite || null,
                },
              ],
            }
          : {}),
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
          titulo: t('sweepRiscos.riscos.wizard.novoRiscoTitulo', { nome: data.nome }),
          descricao: data.descricao || t('sweepRiscos.riscos.wizard.descricaoDefault', { nivel: nivelInicial }),
          link: `${window.location.origin}/riscos`,
          gravidade: nivelGravidadeMap[nivelInicial?.toLowerCase()] || 'media',
          dados: { nivel: nivelInicial, status: data.status }
        });
        
        for (const anexo of anexosAceite) {
          if (!anexo.id && riscoId) {
            try {
              await exigirEscrita(supabase.from('riscos_anexos').insert({
                risco_id: riscoId,
                nome_arquivo: anexo.nome_arquivo,
                url_arquivo: anexo.url_arquivo,
                tipo_arquivo: anexo.tipo_arquivo,
                tamanho_arquivo: anexo.tamanho_arquivo,
                tipo_anexo: 'aceite',
                empresa_id: profile.empresa_id,
                created_by: profile.user_id
              }));
            } catch (anexoError) {
              logger.error('Erro ao salvar anexo:', { data: anexoError });
            }
          }
        }
      }

      // Grava impacto financeiro em passo à parte e TOLERANTE: se a coluna ainda
      // não existir na base (migração não aplicada), o risco é salvo normalmente
      // e apenas o valor financeiro é ignorado até a migração ser aplicada.
      {
        const impactoFinanceiro = data.impacto_financeiro ? parseFloat(data.impacto_financeiro) : null;
        const { error: finErr } = await supabase
          .from('riscos')
          .update({ impacto_financeiro: impactoFinanceiro })
          .eq('id', riscoId);
        if (finErr) logger.error('impacto_financeiro não gravado (coluna ausente?)', { data: finErr });
      }

      // Atualizar vínculos com ativos
      await exigirEscrita(supabase.from('riscos_ativos').delete().eq('risco_id', riscoId));
      
      if (data.ativos_vinculados.length > 0) {
        const vinculos = data.ativos_vinculados.map(ativoId => ({
          risco_id: riscoId,
          ativo_id: ativoId
        }));

        await exigirEscrita(supabase.from('riscos_ativos').insert(vinculos));
      }

      // Registrar histórico de avaliação automaticamente
      try {
        await exigirEscrita(supabase.from('riscos_historico_avaliacoes').insert([
          {
            risco_id: riscoId,
            empresa_id: profile.empresa_id,
            probabilidade: Number(data.probabilidade_inicial),
            impacto: Number(data.impacto_inicial),
            nivel_risco: nivelInicial,
            tipo: 'inicial',
            avaliado_por: profile.user_id,
            observacoes: risco?.id ? t('fin.riscos.wizard.reavaliacao') : t('fin.riscos.wizard.avaliacaoInicial')
          },
          ...(nivelResidual ? [{
            risco_id: riscoId,
            empresa_id: profile.empresa_id,
            probabilidade: Number(data.probabilidade_residual),
            impacto: Number(data.impacto_residual),
            nivel_risco: nivelResidual,
            tipo: 'residual',
            avaliado_por: profile.user_id,
            observacoes: risco?.id ? t('fin.riscos.wizard.reavaliacaoResidual') : t('fin.riscos.wizard.avaliacaoResidualInicial')
          }] : [])
        ]));
      } catch (histError) {
        logger.warn('Erro ao registrar histórico de avaliação:', { data: histError });
      }

      // Se é um novo aceite, enviar notificação e e-mail ao aprovador
      if (isNovoAceite && data.aprovador_aceite) {
        try {
          // Notificação in-app
          await notificar({
            destinatario: data.aprovador_aceite,
            titulo: t('fin.riscos.wizard.notifTitle'),
            mensagem: t('sweepRiscos.riscos.wizard.notifMessage', { nome: data.nome }),
            linkPara: '/riscos',
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
          logger.warn('Erro ao enviar notificação de aceite:', { data: notifError });
        }
      }

      toast.success(
        isNovoAceite 
          ? t('fin.riscos.wizard.salvoEnviado') 
          : (risco?.id ? 'Risco atualizado com sucesso!' : 'Risco cadastrado com sucesso!')
      );
      onSuccess();
    } catch (error: any) {
      logger.error('❌ Erro ao salvar risco:', { data: error });
      const duplicado = error?.code === '23505' || String(error?.message || '').includes('riscos_empresa_codigo_uidx');
      toast.error(
        duplicado
          ? t('fin.validacao.codigoDuplicado')
          : t('fin.riscos.wizard.erroSalvar', { mensagem: error.message || t('fin.comum.erroDesconhecido') })
      );
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
    { key: 'identificacao', label: t('fin.riscos.wizard.stepIdentificacao'), icon: IconFile, description: t('fin.riscos.wizard.stepIdentificacaoDesc') },
    { key: 'avaliacao', label: t('fin.riscos.wizard.stepAvaliacao'), icon: IconGauge, description: t('campos.risco.avaliacaoInicialDescShort') },
    { key: 'detalhes', label: 'Detalhes', icon: IconSettings, description: 'Status, controles, ativos' },
    { key: 'residual', label: t('fin.riscos.wizard.stepResidual'), icon: IconLink, description: t('fin.riscos.wizard.stepResidualDesc') },
    { key: 'aceite', label: t('fin.riscos.wizard.stepAceite'), icon: IconShieldCheck, description: t('fin.riscos.wizard.stepAceiteDesc') },
  ];

  const TabIndicator = ({ state }: { state: 'completed' | 'error' | 'pending' }) => {
    if (state === 'completed') return <IconSuccess className="h-4 w-4 text-success" />;
    if (state === 'error') return <IconWarning className="h-4 w-4 text-destructive" />;
    return <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
  };

  const currentIdx = TABS.indexOf(activeTab);
  const isLastTab = currentIdx === TABS.length - 1;
  const isFirstTab = currentIdx === 0;

  return (
    <Form {...form}>
      {/* `flex-1 min-h-0` e não `h-full`: um item de flex tem `min-height:auto`,
          que recusa encolher abaixo do conteúdo e ganha ao `height:100%`. Era
          por aí que o rodapé com o Salvar saía pela borda num ecrã de 768. */}
      <form onSubmit={form.handleSubmit((d) => onSubmit(d))} className="flex flex-1 min-h-0 flex-col">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const targetIdx = TABS.indexOf(v as TabKey);
            const curIdx = TABS.indexOf(activeTab);
            // DEFECT 5 — só permite avançar diretamente pela aba se as etapas
            // anteriores (incluindo a atual) tiverem os campos obrigatórios.
            if (targetIdx > curIdx) {
              const fields = REQUIRED_FIELDS_BY_TAB[activeTab];
              if (fields.length > 0) {
                form.trigger(fields as any).then((valid) => { if (valid) setActiveTab(v as TabKey); });
                return;
              }
            }
            setActiveTab(v as TabKey);
          }}
          className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0"
        >
          {/* Sidebar — Navegação + Resumo Vivo (desktop) */}
          <aside className="hidden lg:flex flex-col w-72 border-r bg-card flex-shrink-0">
            <div className="p-4 border-b">
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Etapas</h3>
              <TabsList className="flex flex-col h-auto w-full bg-transparent border-0 gap-1 p-0">
                {tabsMeta.map((t) => {
                  const state = tabState(t.key);
                  return (
                    <TabsTrigger
                      key={t.key}
                      value={t.key}
                      className={cn(
                        "w-full justify-start px-3 py-2.5 h-auto rounded-md border border-transparent",
                        "data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:shadow-sm",
                        "data-[state=active]:after:hidden hover:bg-card/60"
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
            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              <h3 className="text-xs font-semibold text-muted-foreground">{t('cardsKpi.sweep.riscos.resumo')}</h3>
              <Card>
                <CardContent className="p-3 space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{t('cardsKpi.sweep.riscos.nome')}</div>
                    <div className="font-medium truncate" title={watchNome}>
                      {watchNome || <span className="text-muted-foreground italic">{t('fin.comum.naoInformado')}</span>}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{t('fin.riscos.wizard.nivelInicial')}</div>
                    {nivelInicialCalculado ? (
                      <Badge className={cn("border", nivelCorClass(nivelInicialCalculado))}>
                        {nivelInicialCalculado}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t('fin.riscos.wizard.piNaoDefinido')}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{t('fin.riscos.wizard.nivelResidual')}</div>
                    {nivelResidualCalculado ? (
                      <Badge className={cn("border", nivelCorClass(nivelResidualCalculado))}>
                        {nivelResidualCalculado}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t('fin.riscos.naoAvaliado')}</span>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <Badge variant="outline" className="capitalize">{watchStatus || '—'}</Badge>
                  </div>
                  {risco?.status_aceite && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t('fin.riscos.wizard.stepAceite')}</div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          risco.status_aceite === 'pendente' && "border-warning text-warning dark:text-warning",
                          risco.status_aceite === 'aprovado' && "border-success text-success dark:text-success",
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
                    className="px-3 py-1.5 data-[state=active]:after:hidden data-[state=active]:bg-card data-[state=active]:border data-[state=active]:border-border rounded-md"
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
            <TabsContent value="identificacao" className="space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><IconFile className="h-5 w-5" />{t('fin.riscos.wizard.identificacaoRisco')}</h2>
                <p className="text-sm text-muted-foreground">{t('fin.riscos.wizard.identificacaoRiscoDesc')}</p>
              </div>

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campos.risco.nome')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('campos.risco.nomePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>{t('campos.risco.codigo')}</FormLabel>
                    <FormControl>
                      <Input className="font-mono" placeholder={t('campos.risco.codigoPlaceholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('campos.risco.codigoHint')}</FormDescription>
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
                      <FormLabel>{t('campos.risco.categoria')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('fin.comum.selecioneCategoria')} />
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
                      <FormLabel>{t('fin.comum.responsavel')}</FormLabel>
                      <FormControl>
                        <UserSelect
                          value={field.value || ''}
                          onValueChange={field.onChange}
                          placeholder={t('fin.comum.selecioneUmResponsavel')}
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
                    <FormLabel>{t('fin.comum.descricao')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('campos.risco.descricaoPlaceholder')}
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
                    <FormLabel>{t('campos.risco.matriz')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('fin.riscos.wizard.selecioneMatriz')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {matrizes.map((matriz) => {
                          const cfg = matriz.configuracao?.[0];
                          const apetite = (cfg?.niveis_risco as any[] | undefined)?.find((n: any) => n?.apetite);
                          const resumo = cfg
                            ? [
                                `${(cfg.escala_probabilidade as any[])?.length || 0}x${(cfg.escala_impacto as any[])?.length || 0}`,
                                cfg.metodo_calculo === 'soma' ? 'P + I' : 'P × I',
                                apetite ? `apetite ≤${apetite.max}` : null,
                              ].filter(Boolean).join(' · ')
                            : null;
                          return (
                            <SelectItem key={matriz.id} value={matriz.id}>
                              <span className="flex items-center gap-2">
                                <span>{matriz.nome}</span>
                                {resumo && (
                                  <span className="text-xs text-muted-foreground">{resumo}</span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}

                      </SelectContent>
                    </Select>
                    <FormDescription>{t('fin.riscos.wizard.matrizHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            {/* AVALIAÇÃO INICIAL */}
            <TabsContent value="avaliacao" className="space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><IconGauge className="h-5 w-5" />{t('fin.riscos.wizard.stepAvaliacao')}</h2>
                <p className="text-sm text-muted-foreground">{t('campos.risco.avaliacaoInicialDesc')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="probabilidade_inicial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('campos.risco.probabilidade')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('fin.comum.selecione')} />
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
                      <FormLabel>{t('campos.risco.impacto')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('fin.comum.selecione')} />
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
                      <div className="text-xs text-muted-foreground">{t('fin.riscos.wizard.nivelCalculado')}</div>
                      <div className="text-2xl font-bold mt-1">{nivelInicialCalculado}</div>
                    </div>
                    <Badge className={cn("text-base px-3 py-1.5 border", nivelCorClass(nivelInicialCalculado))}>
                      P{watchProbabilidade} × I{watchImpacto}
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {/* Impacto financeiro → exposição estimada (priorização por valor) */}
              <FormField
                control={form.control}
                name="impacto_financeiro"
                render={({ field }) => {
                  const exp = financialExposure(field.value, watchProbabilidade);
                  return (
                    <FormItem>
                      <FormLabel>{t('campos.risco.impactoFinanceiro', { moeda: simboloMoeda })}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder={t('campos.risco.impactoFinanceiroPlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      {exp !== null && (
                        <p className="text-xs text-muted-foreground">
                          {t('sweepRiscos.riscos.wizard.exposicaoEstimada')}{' '}
                          <span className="font-semibold text-foreground">{formatMoedaEmpresa(exp)}</span>{' '}
                          {t('sweepRiscos.riscos.wizard.exposicaoDesc')}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="causas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('campos.risco.causas')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('campos.risco.causasPlaceholder')} className="min-h-[80px]" {...field} />
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
                      <FormLabel>{t('fin.riscos.wizard.consequencias')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('campos.risco.consequenciasPlaceholder')} className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            {/* DETALHES */}
            <TabsContent value="detalhes" className="space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><IconSettings className="h-5 w-5" /> {t('cardsKpi.sweep.riscos.detalhesAdicionais')}</h2>
                <p className="text-sm text-muted-foreground">{t('cardsKpi.sweep.riscos.detalhesAdicionaisDesc')}</p>
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campos.risco.status')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('fin.comum.selecioneStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="identificado">{t('campos.enums.riscoStatus.identificado')}</SelectItem>
                        <SelectItem value="analisado">{t('campos.enums.riscoStatus.analisado')}</SelectItem>
                        <SelectItem value="tratado">{t('campos.enums.riscoStatus.tratado')}</SelectItem>
                        <SelectItem value="monitorado">{t('campos.enums.riscoStatus.monitorado')}</SelectItem>
                        <SelectItem value="aceito">{t('campos.enums.riscoStatus.aceito')}</SelectItem>
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
                    <FormLabel>{t('fin.riscos.wizard.dataProxRevisao')}</FormLabel>
                    <FormControl>
                      <DateField value={field.value || null} onChange={(v) => field.onChange(v || '')} />
                    </FormControl>
                    <FormDescription>{t('campos.risco.proxRevisaoDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="controles_existentes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campos.risco.controlesExistentes')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('fin.riscos.wizard.controlesPlaceholder')} className="min-h-[80px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>{t('campos.risco.ativosVinculados')}</FormLabel>
                <FormField
                  control={form.control}
                  name="ativos_vinculados"
                  render={({ field }) => (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                      {ativos.length === 0 ? (
                        <p className="text-sm text-muted-foreground col-span-2">{t('fin.riscos.wizard.semAtivos')}</p>
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
            <TabsContent value="residual" className="space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><IconLink className="h-5 w-5" />{t('fin.riscos.wizard.avaliacaoResidualTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('fin.riscos.wizard.avaliacaoResidualDesc')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="probabilidade_residual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('campos.risco.probabilidadeResidual')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('fin.comum.selecione')} />
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
                      <FormLabel>{t('campos.risco.impactoResidual')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('fin.comum.selecione')} />
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
                      <div className="text-xs text-muted-foreground">{t('fin.riscos.wizard.nivelResidualCalculado')}</div>
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
            <TabsContent value="aceite" className="space-y-4 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><IconShieldCheck className="h-5 w-5" />{t('residuos.risco.aceiteRisco')}</h2>
                <p className="text-sm text-muted-foreground">{t('fin.riscos.wizard.aceiteDesc')}</p>
              </div>

              {risco?.status_aceite && (
                <div className={cn(
                  "p-3 rounded-lg text-sm flex items-center gap-2 border",
                  risco.status_aceite === 'pendente' && "bg-warning/10 text-warning border-warning/30",
                  risco.status_aceite === 'aprovado' && "bg-success/10 text-success border-success/30",
                  risco.status_aceite === 'rejeitado' && "bg-destructive/10 text-destructive border-destructive/30"
                )}>
                  {risco.status_aceite === 'pendente' && `⏳ ${t('sweepRiscos.riscos.wizard.aceitePendente')}`}
                  {risco.status_aceite === 'aprovado' && `✅ ${t('sweepRiscos.riscos.wizard.aceiteAprovado')}`}
                  {risco.status_aceite === 'rejeitado' && `❌ ${t('sweepRiscos.riscos.wizard.aceiteRejeitado')}`}
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
                      <FormLabel>{t('campos.risco.solicitarAceite')}</FormLabel>
                      <FormDescription>
                        {t('campos.risco.solicitarAceiteDesc')}
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
                        <FormLabel>{t('campos.risco.aprovadorAceite')}</FormLabel>
                        <FormControl>
                          <UserSelect
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            placeholder={t('fin.riscos.wizard.selecioneAprovador')}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('campos.risco.aprovadorAceiteDesc')}
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
                        <FormLabel>{t('campos.risco.justificativaAceite')}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t('campos.risco.justificativaAceitePlaceholder')} className="min-h-[80px]" {...field} />
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
                        <FormLabel>{t('fin.riscos.wizard.dataProxRevisaoObrig')}</FormLabel>
                        <FormControl>
                          <DateField value={field.value || null} onChange={(v) => field.onChange(v || '')} />
                        </FormControl>
                        <FormDescription>{t('fin.riscos.wizard.dataProxRevisaoHint')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aceite_valido_ate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Válido até *</FormLabel>
                        <FormControl>
                          <DateField value={field.value || null} onChange={(v) => field.onChange(v || '')} />
                        </FormControl>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {[6, 12, 24].map((meses) => (
                            <Button
                              key={meses}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const d = new Date();
                                d.setMonth(d.getMonth() + meses);
                                field.onChange(formatarDiaParaDB(d));
                              }}
                            >
                              {meses} meses
                            </Button>
                          ))}
                        </div>
                        <FormDescription>
                          O aceite expira nesta data: o risco é reaberto automaticamente para "Em revisão" e o aprovador
                          e o responsável são notificados 30 dias antes e no próprio dia.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {risco?.aceito && (
                    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
                      <IconWarning className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.5} />
                      <span>
                        Alterar a probabilidade, o impacto ou os controlos invalida o aceite vigente e devolve o risco a
                        "Em revisão".
                      </span>
                    </div>
                  )}

                  {risco?.id && (
                    <div className="space-y-2">
                      <FormLabel>{t('campos.risco.anexosAceite')}</FormLabel>
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
        <div className="flex-shrink-0 border-t bg-card px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => goToTab('prev')}
            disabled={isFirstTab}
            size="sm"
          >
            <IconChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('sweepRiscos.riscos.wizard.etapa')} <span className="font-semibold text-foreground">{currentIdx + 1}</span> {t('sweepRiscos.riscos.wizard.de')} {TABS.length}
          </div>

          <div className="flex items-center gap-2">
            {!isLastTab && (
              <Button type="button" variant="outline" onClick={() => goToTab('next')} size="sm">
                {t('sweepRiscos.riscos.wizard.proxima')} <IconChevron className="h-4 w-4 ml-1" />
              </Button>
            )}
            {(() => {
              const missing: string[] = [];
              if (!watchNome?.trim()) missing.push(t('p7Wizard.riscos.missingFieldName'));
              if (!watchMatriz) missing.push(t('p7Wizard.riscos.missingFieldMatriz'));
              if (!watchProbabilidade) missing.push(t('p7Wizard.riscos.missingFieldProbabilidade'));
              if (!watchImpacto) missing.push(t('p7Wizard.riscos.missingFieldImpacto'));
              const reason = missing.length > 0 ? `${t('p7Wizard.missingFieldsPrefix')}: ${missing.join(', ')}` : undefined;
              return (
                <span title={reason} className="inline-flex flex-col items-end gap-1">
                  <Button type="submit" disabled={loading} size="sm">
                    <IconSave className="h-4 w-4 mr-1.5" />
                    {loading ? t('fin.comum.salvando') : risco ? t('fin.comum.atualizar') : t('fin.comum.salvar')}
                  </Button>
                  {reason && (
                    <span className="text-micro text-destructive">{reason}</span>
                  )}
                </span>
              );
            })()}
          </div>
        </div>

        <ConfirmDialog
          open={invalidarAceiteOpen}
          onOpenChange={setInvalidarAceiteOpen}
          title="Reavaliação invalida o aceite"
          description={'Este risco tem um aceite formal em vigor. Ao guardar esta reavaliação, o aceite é invalidado e o risco volta ao estado "Em revisão". O histórico de aceites é mantido. Deseja continuar?'}
          confirmText="Guardar e invalidar aceite"
          cancelText={t('fin.comum.cancelar')}
          onConfirm={() => {
            setInvalidarAceiteOpen(false);
            if (pendingData) onSubmit(pendingData, true);
            setPendingData(null);
          }}
          variant="destructive"
        />
      </form>
    </Form>
  );
}
