import { useState, useEffect, useRef } from 'react';
import { IconSearch, IconDownload, IconView, IconExternal, IconWarning, IconRefresh, IconSave, IconLink, IconCopy, IconShield, IconSettings, IconMail, IconHide, IconQr } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from '@/lib/toast';
import { useNavigate } from 'react-router-dom';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { CanalReadiness } from './CanalReadiness';
interface ConfiguracaoDenuncia {
  id?: string;
  empresa_id: string;
  ativo: boolean;
  token_publico: string;
  permitir_anonimas: boolean;
  requerer_email: boolean;
  texto_apresentacao: string;
  politica_privacidade: string;
  notificar_administradores: boolean;
  avisar_denunciante_por_email: boolean;
  emails_notificacao: string[];
}

export function ConfiguracoesDenuncia() {
  const { t } = useLanguage();
  const { empresaId, loading: empresaLoading } = useEmpresaId();
  const loadSequence = useRef(0);
  const navigate = useNavigate();
  const [config, setConfig] = useState<ConfiguracaoDenuncia | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [empresaSlug, setEmpresaSlug] = useState<string>('');
  const [loadFailed, setLoadFailed] = useState(false);
  const { toast } = useToast();

  // Endereço público do canal: preferimos o URL amigável com slug, mas o canal
  // também é acessível pelo token enquanto a empresa não define o identificador.
  const publicChannelUrl = empresaSlug
    ? `${window.location.origin}/${empresaSlug}/denuncia`
    : config?.token_publico
      ? `${window.location.origin}/denuncia/externa/${config.token_publico}`
      : '';

  const copiarLinkPublico = async () => {
    if (!publicChannelUrl) return;
    try {
      await navigator.clipboard.writeText(publicChannelUrl);
      sonnerToast.success(t('p3Denuncia.channel.copied'), { description: t('p3Denuncia.channel.copiedDescription') });
    } catch { sonnerToast.error(t('canalExperience.copyFailed')); }
  };

  const abrirLinkPublico = () => {
    if (!publicChannelUrl) return;
    window.open(publicChannelUrl, '_blank', 'noopener,noreferrer');
  };

  const descarregarQr = () => {
    const canvas = document.getElementById('denuncia-public-qr') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `canal-denuncia-${empresaSlug || 'qr'}.png`;
    a.click();
  };

  const [formData, setFormData] = useState({
    ativo: true,
    permitir_anonimas: true,
    requerer_email: false,
    texto_apresentacao: '',
    politica_privacidade: '',
    notificar_administradores: true,
    avisar_denunciante_por_email: true,
    emails_notificacao: ''
  });

  useEffect(() => {
    setConfig(null);
    setEmpresaSlug('');
    if (!empresaLoading) void carregarConfiguracao();
    return () => { loadSequence.current += 1; };
    // Locale changes must not discard unsaved settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, empresaLoading]);

  const carregarConfiguracao = async () => {
    const sequence = ++loadSequence.current;
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    setLoadFailed(false);
    try {
      const [configuration, company] = await Promise.all([
        supabase.from('denuncias_configuracoes').select('*').eq('empresa_id', empresaId).maybeSingle(),
        supabase.from('empresas').select('slug').eq('id', empresaId).maybeSingle(),
      ]);
      if (configuration.error) throw configuration.error;
      if (company.error) throw company.error;
      if (sequence !== loadSequence.current) return;
      const data = configuration.data;
      setConfig(data);
      setEmpresaSlug(company.data?.slug ?? '');
      setFormData({
        ativo: data?.ativo ?? true,
        permitir_anonimas: data?.permitir_anonimas ?? true,
        requerer_email: data?.requerer_email ?? false,
        texto_apresentacao: data?.texto_apresentacao ?? '',
        politica_privacidade: data?.politica_privacidade ?? '',
        notificar_administradores: data?.notificar_administradores ?? true,
        avisar_denunciante_por_email: data?.avisar_denunciante_por_email ?? true,
        emails_notificacao: data?.emails_notificacao?.join(', ') ?? '',
      });
    } catch {
      if (sequence === loadSequence.current) { setLoadFailed(true); toast({ title: t('denunciasAdmin.config.errorLoad'), variant: 'destructive' }); }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  const gerarToken = async () => {
    try {
      const { data } = await supabase.rpc('gerar_token_publico');
      return data;
    } catch (error) {
      console.error('Erro ao gerar token:', error);
      return null;
    }
  };

  const handleSalvar = async () => {
    if (!empresaId || saving) return;
    const configuredEmails = formData.emails_notificacao.split(',').map((email) => email.trim()).filter(Boolean);
    if (configuredEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      sonnerToast.error(t('canalExperience.settingsInvalid')); return;
    }
    setSaving(true);
    try {
      const emailsList = formData.emails_notificacao
        .split(',')
        .map(email => email.trim())
        .filter(email => email);

      const configData = {
        ativo: formData.ativo,
        permitir_anonimas: formData.permitir_anonimas,
        requerer_email: formData.requerer_email,
        texto_apresentacao: formData.texto_apresentacao,
        politica_privacidade: formData.politica_privacidade,
        notificar_administradores: formData.notificar_administradores,
        avisar_denunciante_por_email: formData.avisar_denunciante_por_email,
        emails_notificacao: emailsList
      };

      if (config?.id) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from('denuncias_configuracoes')
          .update(configData)
          .eq('id', config.id)
          .eq('empresa_id', empresaId!).select('id').single();

        if (error) throw error;
      } else {
        // Criar nova configuração
        const token = await gerarToken();
        if (!token) {
          throw new Error('Erro ao gerar token');
        }

        const { data, error } = await supabase
          .from('denuncias_configuracoes')
          .insert([{
            token_publico: token,
            empresa_id: empresaId,
            ...configData
          }])
          .select()
          .single();

        if (error) throw error;
        setConfig(data);
      }

      toast({
        title: t('denunciasAdmin.config.saved'),
        description: t('denunciasAdmin.config.saved')
      });

      carregarConfiguracao();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: t('denunciasAdmin.config.errorSave'),
        description: t('denunciasAdmin.config.errorSave'),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const copiarLinkConsulta = async () => {
    if (!empresaSlug) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${empresaSlug}/denuncia/consulta`);
      toast({ title: t('denunciasAdmin.config.copied'), description: t('denunciasAdmin.config.queryLinkCopied') });
    } catch { sonnerToast.error(t('canalExperience.copyFailed')); }
  };

  const regenerarToken = async () => {
    if (!config?.id) return;

    try {
      const novoToken = await gerarToken();
      if (!novoToken) throw new Error('Erro ao gerar token');

      const { error } = await supabase
        .from('denuncias_configuracoes')
        .update({ token_publico: novoToken })
        .eq('id', config.id)
          .eq('empresa_id', empresaId!).select('id').single();

      if (error) throw error;

      toast({
        title: t('denunciasAdmin.config.saved'),
        description: t('denunciasAdmin.config.tokenRegenerated')
      });

      carregarConfiguracao();
    } catch (error) {
      console.error('Erro ao regenerar token:', error);
      toast({
        title: t('denunciasAdmin.config.errorRegenerate'),
        description: t('denunciasAdmin.config.errorRegenerate'),
        variant: "destructive"
      });
    }
  };

  if (loading || empresaLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  if (loadFailed) return <Alert variant="destructive"><AlertDescription>{t('denunciasAdmin.config.errorLoad')}</AlertDescription><Button className="mt-3" variant="outline" onClick={() => void carregarConfiguracao()}>{t('canalExperience.retry')}</Button></Alert>;
  if (!empresaId) return <Alert><AlertDescription>{t('denunciasAdmin.config.errorLoad')}</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('denunciasAdmin.config.pageTitle')}</h2>
          <p className="text-muted-foreground">
            {t('denunciasAdmin.config.pageDescription')}
          </p>
        </div>
      </div>

      {/*
        O canal público, num cartão só.

        Havia três a dizer a mesma coisa: «Canal de denúncia público» (URL +
        QR), «Links Públicos do Canal de Denúncia» (a MESMA URL outra vez, mais
        a de consulta) e, na aba ao lado, um terceiro QR do mesmo endereço. Três
        sítios para copiar o mesmo link é três sítios onde alguém copia o
        errado — e num canal de denúncia o link errado é um cartaz impresso que
        não leva a lado nenhum.

        Fica um: os dois endereços que existem mesmo (registo e consulta), um QR
        do primeiro, e o estado do canal ao lado.
      */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconShield className="h-5 w-5" />
            {t('p3Denuncia.channel.title')}
          </CardTitle>
          <CardDescription>{t('p3Denuncia.channel.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {publicChannelUrl ? (
            <>
              {/* Estado antes dos endereços: um canal inativo torna-os inúteis. */}
              <div className="flex flex-wrap items-center gap-2">
                <Chip family="state" tone={config?.ativo ? 'active' : 'rest'}>
                  {config?.ativo
                    ? t('denunciasAdmin.config.statusActive')
                    : t('denunciasAdmin.config.statusInactive')}
                </Chip>
                {empresaSlug ? (
                  <Badge variant="success">{t('denunciasAdmin.config.friendlyUrls')}</Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={regenerarToken}>
                    <IconRefresh className="h-4 w-4 mr-1" />
                    {t('denunciasAdmin.config.regenerateLink')}
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('denunciasAdmin.config.formLinkLabel')}
                </Label>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1 break-all rounded-lg bg-muted p-3 font-mono text-sm">
                    {publicChannelUrl}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copiarLinkPublico}>
                      <IconCopy className="h-4 w-4 mr-1" />
                      {t('p3Denuncia.channel.copy')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={abrirLinkPublico}>
                      <IconExternal className="h-4 w-4 mr-1" />
                      {t('p3Denuncia.channel.open')}
                    </Button>
                  </div>
                </div>
              </div>

              {empresaSlug && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t('denunciasAdmin.config.queryLinkLabel')}
                  </Label>
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <div className="flex-1 break-all rounded-lg bg-muted p-3 font-mono text-sm">
                      {window.location.origin}/{empresaSlug}/denuncia/consulta
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={copiarLinkConsulta}>
                        <IconCopy className="h-4 w-4 mr-1" />
                        {t('p3Denuncia.channel.copy')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `${window.location.origin}/${empresaSlug}/denuncia/consulta`,
                            '_blank', 'noopener,noreferrer',
                          )
                        }
                      >
                        <IconExternal className="h-4 w-4 mr-1" />
                        {t('p3Denuncia.channel.open')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-border pt-4">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconQr className="h-4 w-4" />
                  {t('p3Denuncia.channel.qrTitle')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('p3Denuncia.channel.qrDescription')}
                </p>
                <div className="flex items-center gap-4">
                  <div className="inline-block rounded-lg border border-border bg-background p-3">
                    <QRCodeCanvas id="denuncia-public-qr" value={publicChannelUrl} size={160} includeMargin />
                  </div>
                  <Button variant="outline" size="sm" onClick={descarregarQr}>
                    <IconDownload className="h-4 w-4 mr-1" />
                    {t('p3Denuncia.channel.downloadQr')}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Alert variant="destructive">
              <IconWarning className="h-4 w-4" />
              <AlertTitle>{t('p3Denuncia.channel.noSlugTitle')}</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{t('p3Denuncia.channel.noSlugDescription')}</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/configuracoes?tab=organizacao')}>
                  {t('p3Denuncia.channel.noSlugAction')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <CanalReadiness empresaId={empresaId} config={config} />
      {formData.requerer_email && formData.permitir_anonimas && <Alert><IconWarning className="h-4 w-4" /><AlertDescription>{t('canalExperience.emailConflict')}</AlertDescription></Alert>}

      {/* Configurações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSettings className="h-5 w-5" />
            {t('denunciasAdmin.config.generalTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('denunciasAdmin.config.labelCanalAtivo')}</Label>
                  <div className="text-sm text-muted-foreground">
                    {t('denunciasAdmin.config.descCanalAtivo')}
                  </div>
                </div>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, ativo: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('denunciasAdmin.config.labelPermitirAnonimas')}</Label>
                  <div className="text-sm text-muted-foreground">
                    {t('denunciasAdmin.config.descPermitirAnonimas')}
                  </div>
                </div>
                <Switch
                  checked={formData.permitir_anonimas}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, permitir_anonimas: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('denunciasAdmin.config.labelEmailObrigatorio')}</Label>
                  <div className="text-sm text-muted-foreground">
                    {t('denunciasAdmin.config.descEmailObrigatorio')}
                  </div>
                </div>
                <Switch
                  checked={formData.requerer_email}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, requerer_email: checked }))
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('denunciasAdmin.config.labelNotificarAdmins')}</Label>
                  <div className="text-sm text-muted-foreground">
                    {t('denunciasAdmin.config.descNotificarAdmins')}
                  </div>
                </div>
                <Switch
                  checked={formData.notificar_administradores}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, notificar_administradores: checked }))
                  }
                />
              </div>

              {/*
                O aviso para FORA.

                O de cima avisa quem trata; este avisa quem denunciou, e e o
                que faltava por completo. Fica ligado por omissao porque o
                silencio era o defeito -- mas e desligavel, porque o e-mail sai
                do perimetro e a caixa de correio pode ser da empresa que esta
                a ser denunciada.
              */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('denunciasAdmin.config.labelAvisarDenunciante')}</Label>
                  <div className="text-sm text-muted-foreground">
                    {t('denunciasAdmin.config.descAvisarDenunciante')}
                  </div>
                </div>
                <Switch
                  checked={formData.avisar_denunciante_por_email}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, avisar_denunciante_por_email: checked }))
                  }
                />
              </div>

              {formData.notificar_administradores && (
                <div className="space-y-2">
                  <Label htmlFor="emails">{t('denunciasAdmin.config.labelEmailsNotificacao')}</Label>
                  <Input
                    id="emails"
                    value={formData.emails_notificacao}
                    onChange={(e) => 
                      setFormData(prev => ({ ...prev, emails_notificacao: e.target.value }))
                    }
                    placeholder={t('denunciasAdmin.config.placeholderEmails')}
                  />
                  <div className="text-xs text-muted-foreground">
                    {t('denunciasAdmin.config.hintEmails')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Textos do Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>{t('denunciasAdmin.config.customizationTitle')}</CardTitle>
          <CardDescription>
            {t('denunciasAdmin.config.customizationDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apresentacao">{t('denunciasAdmin.config.labelApresentacao')}</Label>
            <Textarea
              id="apresentacao"
              value={formData.texto_apresentacao}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, texto_apresentacao: e.target.value }))
              }
              placeholder={t('denunciasAdmin.config.placeholderApresentacao')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="politica">{t('denunciasAdmin.config.labelPolitica')}</Label>
            <Textarea
              id="politica"
              value={formData.politica_privacidade}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, politica_privacidade: e.target.value }))
              }
              placeholder={t('denunciasAdmin.config.placeholderPolitica')}
              rows={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSalvar} disabled={saving}>
          <IconSave className="w-4 h-4 mr-2" />
          {saving ? t('denunciasAdmin.config.saving') : t('denunciasAdmin.config.saveButton')}
        </Button>
      </div>

    </div>
  );
}
