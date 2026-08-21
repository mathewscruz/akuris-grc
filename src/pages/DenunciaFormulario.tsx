import { useState, useEffect } from 'react';
import { IconClose, IconUpload, IconExternal, IconShield, IconArrowLeft } from '@/components/icons';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchEmpresaPublicaPorSlug } from '@/lib/denuncia-publica';
import { logger } from '@/lib/logger';
import { getCompanyLogo, AKURIS_DEFAULT_LOGO } from '@/lib/brand-logo';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanalDenuncia } from '@/hooks/useCanalDenuncia';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { useMemo } from 'react';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Empresa {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string;
}

interface EmpresaConfig {
  id: string;
  empresa_id: string;
  ativo: boolean;
  permitir_anonimas: boolean;
  requerer_email: boolean;
  texto_apresentacao?: string;
  politica_privacidade?: string;
  emails_notificacao: string[];
  notificar_administradores: boolean;
  token_publico: string;
}

interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

/**
 * `permitirAnonimas` decide se identificar-se é opcional ou obrigatório.
 *
 * Antes o bloco de identificação inteiro só existia quando a empresa PERMITIA
 * denúncias anónimas — o inverso da intenção. Desligar "Permitir Denúncias
 * Anónimas" escondia nome, e-mail e telefone, `anonima` passava a ser sempre
 * true (era inferido do nome vazio) e o RPC recusava tudo: o canal público
 * ficava inutilizável, com um toast genérico e nada a explicar porquê.
 */
const buildDenunciaSchema = (
  t: (key: string) => string,
  permitirAnonimas: boolean,
  exigirPolitica: boolean,
) => z.object({
  categoria_id: z.string().min(1, t('publicPortal.denunciaForm.validation.category')),
  titulo: z.string().min(5, t('publicPortal.denunciaForm.validation.title')),
  descricao: z.string().min(20, t('publicPortal.denunciaForm.validation.description')),
  local_ocorrencia: z.string().optional(),
  data_ocorrencia: z.string().optional(),
  denunciante_nome: permitirAnonimas
    ? z.string().optional()
    : z.string().trim().min(3, t('publicPortal.denunciaForm.validation.nameRequired')),
  denunciante_email: z.string().email(t('publicPortal.denunciaForm.validation.email')).optional().or(z.literal('')),
  denunciante_telefone: z.string().optional(),
  testemunhas: z.string().optional(),
  evidencias_descricao: z.string().optional(),
  /**
   * O consentimento era literal: `politica_aceita: true` ia no envio sem que
   * o denunciante visse o texto — a política só aparecia DEPOIS, na tela de
   * sucesso. O sistema registava um consentimento que nunca foi dado, num
   * canal onde esse registo é justamente a prova legal.
   */
  politica_aceita: exigirPolitica
    ? z.literal(true, { errorMap: () => ({ message: t('publicPortal.denunciaForm.validation.policyRequired') }) })
    : z.boolean().optional(),
});

type DenunciaFormData = z.infer<ReturnType<typeof buildDenunciaSchema>>;

/** Que campos cada etapa tem de validar antes de deixar avançar. */
const CAMPOS_POR_ETAPA: Record<number, (keyof DenunciaFormData)[]> = {
  1: ['categoria_id', 'titulo', 'descricao'],
  2: ['denunciante_nome', 'denunciante_email'],
  3: [],
  4: ['politica_aceita'],
};
const TOTAL_ETAPAS = 4;

export default function DenunciaFormulario() {
  const { empresa: empresaSlug } = useParams();
  const { t } = useLanguage();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>(AKURIS_DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [codigoAcompanhamento, setCodigoAcompanhamento] = useState('');
  const [protocolo, setProtocolo] = useState<string>('');
  const [anexos, setAnexos] = useState<File[]>([]);
  /** Ficheiros que NÃO chegaram. A tela final tem de os nomear. */
  const [anexosFalhados, setAnexosFalhados] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  /*
    O registo passa a ser guiado.

    Era uma página única com onze campos, categoria a anexos. Quem chega aqui
    costuma estar a hesitar, e uma parede de campos é o momento em que desiste
    — é por isso que o concorrente anuncia "4 passos" como se fosse recurso.
    Os campos e a validação são os mesmos; muda quantos se veem de cada vez.
  */
  const [etapa, setEtapa] = useState(1);
  /* Identidade e direitos do canal — a mesma fonte das outras duas telas. */
  const canal = useCanalDenuncia(empresaSlug);

  /** Com denúncias anónimas desligadas, identificar-se deixa de ser opcional. */
  const identificacaoObrigatoria = config ? !config.permitir_anonimas : false;

  const denunciaSchema = useMemo(
    () => buildDenunciaSchema(t, config?.permitir_anonimas ?? true, !!config?.politica_privacidade),
    [t, config?.permitir_anonimas, config?.politica_privacidade],
  );

  const form = useForm<DenunciaFormData>({
    resolver: zodResolver(denunciaSchema),
    defaultValues: {
      categoria_id: '',
      titulo: '',
      descricao: '',
      local_ocorrencia: '',
      data_ocorrencia: '',
      denunciante_nome: '',
      denunciante_email: '',
      denunciante_telefone: '',
      testemunhas: '',
      evidencias_descricao: '',
    },
  });

  useEffect(() => {
    const loadConfiguracao = async () => {
      if (!empresaSlug) {
        logger.debug('Slug da empresa não fornecido', { module: 'DenunciaFormulario' });
        setLoading(false);
        return;
      }

      try {
        logger.debug('Carregando configuração para empresa slug', { module: 'DenunciaFormulario', action: empresaSlug });
        
        const empresaData = await fetchEmpresaPublicaPorSlug(empresaSlug);

        if (!empresaData) {
          logger.error('Empresa não encontrada para slug', { module: 'DenunciaFormulario', action: empresaSlug });
          setLoading(false);
          return;
        }

        logger.debug('Empresa encontrada', { module: 'DenunciaFormulario' });
        setEmpresa(empresaData);

        // Buscar configurações da empresa
        logger.debug('Buscando configurações para empresa', { module: 'DenunciaFormulario' });
        const { data: configRaw, error: configError } = await supabase.rpc(
          'get_denuncia_config_publica' as never,
          { p_empresa_id: empresaData.id } as never
        );

        const configRows = (configRaw ?? null) as unknown;
        const configData: any = Array.isArray(configRows) ? configRows[0] : configRows;

        if (configError || !configData) {
          logger.error('Erro ao buscar configurações', { module: 'DenunciaFormulario', error: String(configError) });
          setLoading(false);
          return;
        }

        if (!empresaData.canal_ativo) {
          logger.debug('Canal de denúncia desativado', { module: 'DenunciaFormulario' });
          setLoading(false);
          return;
        }

        logger.debug('Configurações carregadas', { module: 'DenunciaFormulario' });
        setConfig(configData);

        const { data: categoriasData, error: categoriasError } = await supabase.rpc(
          'get_denuncias_categorias_publicas' as never,
          { p_empresa_id: empresaData.id } as never
        );

        if (!categoriasError && categoriasData) {
          setCategorias((categoriasData ?? []) as any);
        }

        // Usar logo_url da empresa, com fallback automático para o logo Akuris
        setLogoUrl(getCompanyLogo(empresaData.logo_url));
      } catch (error) {
        logger.error('Erro geral ao carregar configuração', { module: 'DenunciaFormulario', error: String(error) });
      } finally {
        setLoading(false);
      }
    };

    loadConfiguracao();
  }, [empresaSlug]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (anexos.length + files.length > 5) {
      toast.error(t('publicPortal.denunciaForm.maxFiles'));
      return;
    }
    
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(t('publicPortal.denunciaForm.fileTooLarge', { name: file.name }));
        return false;
      }
      return true;
    });
    
    setAnexos(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: DenunciaFormData) => {
    if (!empresa) return;
    
    setSubmitting(true);
    
    try {
      // Criar a denúncia usando Edge Function
      const { data: denunciaData, error: denunciaError } = await supabase.functions.invoke('create-denuncia', {
        body: {
          action: 'create',
          empresa_slug: empresa.slug,
          categoria_id: data.categoria_id || null,
          titulo: data.titulo,
          descricao: data.descricao,
          anonima: !data.denunciante_nome,
          politica_aceita: data.politica_aceita === true,
          denunciante_email: data.denunciante_email || null,
          denunciante_nome: data.denunciante_nome || null,
          /*
            Estes cinco eram recolhidos e deitados fora.

            O formulário pergunta onde, quando, com que testemunhas e que
            provas existem; a função de borda sempre soube recebê-los; e o
            envio passava só quatro campos. O investigador ficava sem o
            essencial de qualquer apuração — e ninguém percebia, porque a
            pessoa tinha mesmo preenchido.
          */
          denunciante_telefone: data.denunciante_telefone || null,
          local_ocorrencia: data.local_ocorrencia || null,
          data_ocorrencia: data.data_ocorrencia || null,
          testemunhas: data.testemunhas || null,
          evidencias_descricao: data.evidencias_descricao || null,
        }
      });

      if (denunciaError) {
        logger.error('Erro ao criar denúncia', { module: 'DenunciaFormulario', error: String(denunciaError) });
        toast.error(t('publicPortal.denunciaForm.createError'));
        return;
      }

      if (denunciaData?.error) {
        logger.error('Erro ao criar denúncia', { module: 'DenunciaFormulario', error: String(denunciaData.error) });
        toast.error(t('publicPortal.denunciaForm.createError'));
        return;
      }

      const codigo = denunciaData.codigo_acompanhamento ?? '';
      setProtocolo(denunciaData.protocolo);
      setCodigoAcompanhamento(codigo);

      /*
        A evidência, agora por URL assinada — e com o resultado à vista.

        Antes: o ficheiro ia direto para um bucket que não existia, o erro era
        só registado no log e a tela dizia "denúncia registrada" à mesma. A
        pessoa juntava a prova, via sucesso, e a prova nunca existiu. Num canal
        de denúncia a evidência É o caso.

        O denunciante é anónimo e não pode escrever no armazenamento com a
        chave pública; a função de borda valida o código, regista a linha e
        assina a URL daquele ficheiro. O que falhar sai nomeado na tela final.
      */
      const falharam: string[] = [];
      if (anexos.length > 0 && denunciaData.id) {
        for (const file of anexos) {
          try {
            const { data: pedido, error: erroPedido } = await supabase.functions.invoke(
              'create-denuncia',
              {
                body: {
                  action: 'anexo_url',
                  denuncia_id: denunciaData.id,
                  codigo,
                  nome: file.name,
                  tipo: file.type,
                  tamanho: file.size,
                },
              },
            );
            if (erroPedido || pedido?.error || !pedido?.token) {
              throw new Error(String(erroPedido ?? pedido?.error ?? 'sem_url'));
            }

            const { error: erroUpload } = await supabase.storage
              .from('denuncias-anexos')
              .uploadToSignedUrl(pedido.caminho, pedido.token, file);
            if (erroUpload) throw erroUpload;

            await supabase.functions.invoke('create-denuncia', {
              body: {
                action: 'anexo_confirmar',
                denuncia_id: denunciaData.id,
                codigo,
                anexo_id: pedido.anexo_id,
              },
            });
          } catch (erro) {
            logger.error('Falha ao anexar evidência', {
              module: 'DenunciaFormulario',
              error: String(erro),
            });
            falharam.push(file.name);
          }
        }
      }
      setAnexosFalhados(falharam);

      setShowSuccess(true);
      form.reset();
      setAnexos([]);
      
    } catch (error) {
      logger.error('Erro geral ao registrar denúncia', { module: 'DenunciaFormulario', error: String(error) });
      toast.error(t('publicPortal.denunciaForm.unexpectedError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(215,35%,12%)] flex items-center justify-center">
        <div className="text-center">
          <AkurisPulse size={32} />
          <p className="mt-2 text-sidebar-foreground">{t('publicPortal.common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!empresa || !config) {
    return (
      <div className="min-h-screen bg-[hsl(215,35%,12%)] flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-white">
          <CardContent className="text-center py-8">
            <IconShield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('publicPortal.denunciaForm.unavailableTitle')}</h2>
            <p className="text-muted-foreground">
              {t('publicPortal.denunciaForm.unavailableDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-[hsl(215,35%,12%)] py-8">
        <div className="container max-w-2xl mx-auto px-4">
          <Card className="bg-white border-success/30">
            <CardContent className="text-center py-12">
              <IconShield className="w-8 h-8 text-success mx-auto mb-6" />
              
              <h2 className="text-2xl font-bold text-success mb-4">
                {t('publicPortal.denunciaForm.successTitle')}
              </h2>
              
              <div className="bg-success/10 p-4 rounded-lg border border-success/30 mb-6">
                <p className="text-sm text-muted-foreground mb-2">{t('publicPortal.denunciaForm.yourProtocol')}</p>
                <p className="text-2xl font-mono font-bold text-success">{protocolo}</p>
              </div>

              {codigoAcompanhamento && (
                <div className="bg-success/10 p-4 rounded-lg border border-success/30 mb-6">
                  <p className="text-sm text-muted-foreground mb-2">{t('publicPortal.denunciaForm.yourTrackingCode')}</p>
                  <p className="text-lg font-mono font-bold text-success break-all">{codigoAcompanhamento}</p>
                  <p className="text-xs text-muted-foreground mt-2">{t('publicPortal.denunciaForm.trackingCodeHint')}</p>
                </div>
              )}
              
              <p className="text-success mb-6">
                {t('publicPortal.denunciaForm.successDescription')}
              </p>

              {/*
                O que NÃO chegou é dito aqui, nomeando o ficheiro.

                Antes, uma evidência que falhava a subir era registada no log e
                a tela dizia sucesso na mesma — a pessoa saía convencida de que
                a prova estava entregue. Se o canal não conseguiu guardar o
                ficheiro, quem o tem ainda é ela: tem de saber a tempo.
              */}
              {anexosFalhados.length > 0 && (
                <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-left">
                  <p className="text-sm font-semibold text-destructive">
                    {t('publicPortal.denunciaForm.anexosFalharamTitulo', {
                      count: anexosFalhados.length,
                    })}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {anexosFalhados.map((nome) => (
                      <li key={nome} className="text-xs text-muted-foreground break-all">
                        {nome}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('publicPortal.denunciaForm.anexosFalharamAjuda')}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Link to={`/${empresaSlug}/denuncia/consulta`}>
                  <Button className="w-full">
                    <IconExternal className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.checkStatus')}
                  </Button>
                </Link>
                
                <Link to={`/${empresaSlug}/denuncia`}>
                  <Button variant="outline" className="w-full">
                    <IconArrowLeft className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.backHome')}
                  </Button>
                </Link>
              </div>
              
              {config.politica_privacidade && (
                <div className="mt-6 p-4 bg-success/10 rounded-lg border border-success/30">
                  <p className="text-sm text-muted-foreground">{config.politica_privacidade}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <CanalLayout
      empresa={canal.empresa}
      config={canal.config}
      nomeDoCanal={canal.nomeDoCanal}
      estiloDaMarca={canal.estiloDaMarca}
      etapa={t('publicPortal.denunciaForm.cardTitle')}
      voltarPara={`/${empresaSlug}/denuncia`}
    >
      <div>
        {/* Formulário */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t('publicPortal.denunciaForm.cardTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Onde estou, e quanto falta. */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`publicPortal.denunciaForm.etapa${etapa}`)}
                </p>
                <p className="text-micro tabular-nums text-muted-foreground">
                  {t('publicPortal.denunciaForm.etapaDe', { atual: etapa, total: TOTAL_ETAPAS })}
                </p>
              </div>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={
                      n <= etapa
                        ? 'h-1 flex-1 rounded-full bg-primary'
                        : 'h-1 flex-1 rounded-full bg-muted'
                    }
                  />
                ))}
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {etapa === 1 && (
                  <div className="space-y-4">
                {/* Categoria */}
                <FormField
                  control={form.control}
                  name="categoria_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.category')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('publicPortal.denunciaForm.categoryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categorias.map((categoria) => (
                            <SelectItem key={categoria.id} value={categoria.id}>
                              {categoria.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Título */}
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.title')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('publicPortal.denunciaForm.titlePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Descrição */}
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.description')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={t('publicPortal.denunciaForm.descriptionPlaceholder')}
                          className="min-h-[120px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Local de Ocorrência */}
                <FormField
                  control={form.control}
                  name="local_ocorrencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.place')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('publicPortal.denunciaForm.placePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Data de Ocorrência */}
                <FormField
                  control={form.control}
                  name="data_ocorrencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.date')}</FormLabel>
                      <FormControl>
                        <DateField value={field.value || null} onChange={(v) => field.onChange(v || '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Identificação: sempre visível. Quando a empresa permite
                    denúncias anónimas os campos são opcionais e deixá-los em
                    branco envia a denúncia como anónima; quando não permite, o
                    nome é obrigatório. */}
                  </div>
                )}
                {etapa === 2 && (
                  <div className="space-y-4">
                {(
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">{t(identificacaoObrigatoria ? 'publicPortal.denunciaForm.identificationRequired' : 'publicPortal.denunciaForm.identification')}</h3>
                    
                    <FormField
                      control={form.control}
                      name="denunciante_nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('publicPortal.denunciaForm.name')}{identificacaoObrigatoria ? ' *' : ''}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t('publicPortal.denunciaForm.namePlaceholder')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="denunciante_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('publicPortal.denunciaForm.email')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder={t('residuos.placeholders.seuEmail')} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="denunciante_telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('publicPortal.denunciaForm.phone')}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(11) 99999-9999" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                  </div>
                )}
                {etapa === 3 && (
                  <div className="space-y-4">
                {/* Testemunhas */}
                <FormField
                  control={form.control}
                  name="testemunhas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.witnesses')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={t('publicPortal.denunciaForm.witnessesPlaceholder')}
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Evidências */}
                <FormField
                  control={form.control}
                  name="evidencias_descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.evidence')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={t('publicPortal.denunciaForm.evidencePlaceholder')}
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Upload de Anexos */}
                {true && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{t('publicPortal.denunciaForm.attach')}</label>
                      <span className="text-xs text-muted-foreground">{t('publicPortal.denunciaForm.attachHint')}</span>
                    </div>
                    
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <IconUpload className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {t('publicPortal.denunciaForm.attachCta')}
                          </p>
                        </div>
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                        />
                      </label>
                    </div>

                    {/* Lista de anexos */}
                    {anexos.length > 0 && (
                      <div className="space-y-2">
                        {anexos.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <IconClose className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                  </div>
                )}
                {etapa === 4 && (
                  <div className="space-y-4">
                {config.politica_privacidade && (
                  <FormField
                    control={form.control}
                    name="politica_aceita"
                    render={({ field }) => (
                      <FormItem className="space-y-3 rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {config.politica_privacidade}
                        </p>
                        <div className="flex items-start gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value === true}
                              onCheckedChange={(v) => field.onChange(v === true)}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal leading-snug">
                            {t('publicPortal.denunciaForm.policyAccept')}
                          </FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                  </div>
                )}
                {/* Botões de ação */}
                {/* Avançar só depois de a etapa estar válida: o erro aparece
                    onde o campo está, e não três telas à frente. */}
                <div className="flex gap-3 pt-4">
                  {etapa === 1 ? (
                    <Link to={`/${empresaSlug}/denuncia`} className="flex-1">
                      <Button type="button" variant="outline" className="w-full">
                        {t('publicPortal.denunciaForm.cancel')}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEtapa((e) => e - 1)}
                    >
                      {t('publicPortal.denunciaForm.voltarEtapa')}
                    </Button>
                  )}

                  {etapa < TOTAL_ETAPAS ? (
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={async () => {
                        const ok = await form.trigger(CAMPOS_POR_ETAPA[etapa]);
                        if (ok) setEtapa((e) => e + 1);
                      }}
                    >
                      {t('publicPortal.denunciaForm.avancarEtapa')}
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting} className="flex-1">
                      {submitting ? t('publicPortal.denunciaForm.submitting') : t('publicPortal.denunciaForm.submit')}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </CanalLayout>
  );
}
