import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Shield, Upload, X, ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchEmpresaPublicaPorSlug } from '@/lib/denuncia-publica';
import { logger } from '@/lib/logger';
import { getCompanyLogo, AKURIS_DEFAULT_LOGO } from '@/lib/brand-logo';
import { useLanguage } from '@/contexts/LanguageContext';
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

const buildDenunciaSchema = (t: (key: string) => string) => z.object({
  categoria_id: z.string().min(1, t('publicPortal.denunciaForm.validation.category')),
  titulo: z.string().min(5, t('publicPortal.denunciaForm.validation.title')),
  descricao: z.string().min(20, t('publicPortal.denunciaForm.validation.description')),
  local_ocorrencia: z.string().optional(),
  data_ocorrencia: z.string().optional(),
  denunciante_nome: z.string().optional(),
  denunciante_email: z.string().email(t('publicPortal.denunciaForm.validation.email')).optional().or(z.literal('')),
  denunciante_telefone: z.string().optional(),
  testemunhas: z.string().optional(),
  evidencias_descricao: z.string().optional(),
});

type DenunciaFormData = z.infer<ReturnType<typeof buildDenunciaSchema>>;

export default function DenunciaFormulario() {
  const { empresa: empresaSlug } = useParams();
  const { t } = useLanguage();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>(AKURIS_DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<string>('');
  const [anexos, setAnexos] = useState<File[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const denunciaSchema = useMemo(() => buildDenunciaSchema(t), [t]);

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
        const { data: configData, error: configError } = await supabase
          .from('denuncias_configuracoes_public' as any)
          .select('*')
          .eq('empresa_id', empresaData.id)
          .single() as { data: any; error: any };

        if (configError) {
          logger.error('Erro ao buscar configurações', { module: 'DenunciaFormulario', error: String(configError) });
          setLoading(false);
          return;
        }

        if (!configData?.ativo) {
          logger.debug('Canal de denúncia desativado', { module: 'DenunciaFormulario' });
          setLoading(false);
          return;
        }

        logger.debug('Configurações carregadas', { module: 'DenunciaFormulario' });
        setConfig(configData);

        // Buscar categorias ativas da empresa
        logger.debug('Buscando categorias', { module: 'DenunciaFormulario' });
        const { data: categoriasData, error: categoriasError } = await supabase
          .from('denuncias_categorias')
          .select('*')
          .eq('empresa_id', empresaData.id)
          .eq('ativo', true)
          .order('nome');

        if (!categoriasError && categoriasData) {
          logger.debug('Categorias carregadas', { module: 'DenunciaFormulario' });
          setCategorias(categoriasData);
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
          empresa_id: empresa.id,
          categoria_id: data.categoria_id,
          titulo: data.titulo,
          descricao: data.descricao,
          anonima: !data.denunciante_nome,
          email_denunciante: data.denunciante_email || null,
          nome_denunciante: data.denunciante_nome || null
        }
      });

      if (denunciaError) {
        logger.error('Erro ao criar denúncia', { module: 'DenunciaFormulario', error: String(denunciaError) });
        toast.error(t('publicPortal.denunciaForm.createError'));
        return;
      }

      setProtocolo(denunciaData.protocolo);

      // Upload de anexos se houver
      if (anexos.length > 0) {
        for (const file of anexos) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${denunciaData.id}/${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('denuncias-anexos')
            .upload(fileName, file);

          if (uploadError) {
            logger.error('Erro ao fazer upload', { module: 'DenunciaFormulario', error: String(uploadError) });
          }
        }
      }

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
            <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
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
          <Card className="bg-white border-green-200">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-green-800 mb-4">
                {t('publicPortal.denunciaForm.successTitle')}
              </h2>
              
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
                <p className="text-sm text-gray-600 mb-2">{t('publicPortal.denunciaForm.yourProtocol')}</p>
                <p className="text-2xl font-mono font-bold text-green-700">{protocolo}</p>
              </div>
              
              <p className="text-green-700 mb-6">
                {t('publicPortal.denunciaForm.successDescription')}
              </p>
              
              <div className="space-y-3">
                <Link to={`/${empresaSlug}/denuncia/consulta`}>
                  <Button className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.checkStatus')}
                  </Button>
                </Link>
                
                <Link to={`/${empresaSlug}/denuncia`}>
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.backHome')}
                  </Button>
                </Link>
              </div>
              
              {config.politica_privacidade && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">{config.politica_privacidade}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(215,35%,12%)] py-8">
      <div className="container max-w-2xl mx-auto px-4">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link 
            to={`/${empresaSlug}/denuncia`}
            className="inline-flex items-center text-sm text-sidebar-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('publicPortal.denunciaForm.backToMenu')}
          </Link>
        </div>

        {/* Header com logotipo */}
        <div className="text-center mb-6">
          {/* Logotipo da empresa */}
          <div className="mb-6">
            <img
              src={logoUrl}
              alt={`Logo ${empresa?.nome ?? 'Akuris'}`}
              className="mx-auto h-20 w-auto object-contain"
              onError={() => setLogoUrl(AKURIS_DEFAULT_LOGO)}
            />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-xl text-sidebar-foreground">{t('publicPortal.denunciaForm.headerTitle')}</h2>
          </div>
        </div>

        {/* Texto de apresentação */}
        {config.texto_apresentacao && (
          <Alert className="mb-6 bg-white">
            <Shield className="h-4 w-4" />
            <AlertDescription>{config.texto_apresentacao}</AlertDescription>
          </Alert>
        )}

        {/* Formulário */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t('publicPortal.denunciaForm.cardTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                {/* Dados do Denunciante (se não for obrigatório email) */}
                {config.permitir_anonimas && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">{t('publicPortal.denunciaForm.identification')}</h3>
                    
                    <FormField
                      control={form.control}
                      name="denunciante_nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('publicPortal.denunciaForm.name')}</FormLabel>
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
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
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
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex gap-4 pt-4">
                  <Link to={`/${empresaSlug}/denuncia`} className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      {t('publicPortal.denunciaForm.cancel')}
                    </Button>
                  </Link>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? t('publicPortal.denunciaForm.submitting') : t('publicPortal.denunciaForm.submit')}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
