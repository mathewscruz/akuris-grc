import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Save, 
  Link2, 
  Copy, 
  ExternalLink, 
  Shield, 
  Settings,
  Mail,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  QrCode,
  Download,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
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
  emails_notificacao: string[];
}

export function ConfiguracoesDenuncia() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [config, setConfig] = useState<ConfiguracaoDenuncia | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [empresaSlug, setEmpresaSlug] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const publicChannelUrl = empresaSlug
    ? `${window.location.origin}/${empresaSlug}/denuncia`
    : '';

  const copiarLinkPublico = () => {
    if (!publicChannelUrl) return;
    navigator.clipboard.writeText(publicChannelUrl);
    sonnerToast.success(t('p3Denuncia.channel.copied'), {
      description: t('p3Denuncia.channel.copiedDescription'),
    });
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
    emails_notificacao: ''
  });

  useEffect(() => {
    carregarConfiguracao();
  }, []);

  const carregarConfiguracao = async () => {
    try {
      // Buscar configuração da denúncia
      const { data, error } = await supabase
        .from('denuncias_configuracoes')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig(data);
        setFormData({
          ativo: data.ativo,
          permitir_anonimas: data.permitir_anonimas,
          requerer_email: data.requerer_email,
          texto_apresentacao: data.texto_apresentacao || '',
          politica_privacidade: data.politica_privacidade || '',
          notificar_administradores: data.notificar_administradores,
          emails_notificacao: data.emails_notificacao?.join(', ') || ''
        });
      }

      // Buscar slug da empresa
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas')
        .select('slug')
        .single();

      if (!empresaError && empresaData?.slug) {
        setEmpresaSlug(empresaData.slug);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: t('denunciasAdmin.config.errorLoad'),
        description: t('denunciasAdmin.config.errorLoad'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
        emails_notificacao: emailsList
      };

      if (config?.id) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from('denuncias_configuracoes')
          .update(configData)
          .eq('id', config.id);

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

  const copiarLink = () => {
    const baseUrl = window.location.origin;
    const link = empresaSlug 
      ? `${baseUrl}/${empresaSlug}/denuncia` 
      : `${baseUrl}/denuncia/externa/${config?.token_publico}`;
    
    navigator.clipboard.writeText(link);
    toast({
      title: t('denunciasAdmin.config.copied'),
      description: t('denunciasAdmin.config.linkCopied')
    });
  };

  const abrirFormulario = () => {
    const baseUrl = window.location.origin;
    const link = empresaSlug 
      ? `${baseUrl}/${empresaSlug}/denuncia` 
      : `${baseUrl}/denuncia/externa/${config?.token_publico}`;
    
    window.open(link, '_blank');
  };

  const copiarLinkConsulta = () => {
    if (empresaSlug) {
      const link = `${window.location.origin}/${empresaSlug}/denuncia/consulta`;
      navigator.clipboard.writeText(link);
      toast({
        title: t('denunciasAdmin.config.copied'),
        description: t('denunciasAdmin.config.queryLinkCopied')
      });
    }
  };

  const regenerarToken = async () => {
    if (!config?.id) return;

    try {
      const novoToken = await gerarToken();
      if (!novoToken) throw new Error('Erro ao gerar token');

      const { error } = await supabase
        .from('denuncias_configuracoes')
        .update({ token_publico: novoToken })
        .eq('id', config.id);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

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

      {/* Link Público */}
      {(config?.token_publico || empresaSlug) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {t('denunciasAdmin.config.publicLinksTitle')}
            </CardTitle>
            <CardDescription>
              {t('denunciasAdmin.config.publicLinksDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Link para criar denúncia */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('denunciasAdmin.config.formLinkLabel')}</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
                  {empresaSlug 
                    ? `${window.location.origin}/${empresaSlug}/denuncia`
                    : `${window.location.origin}/denuncia/externa/${config?.token_publico}`
                  }
                </div>
                <Button variant="outline" size="sm" onClick={copiarLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={abrirFormulario}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Link para consultar denúncia (apenas com slug) */}
            {empresaSlug && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('denunciasAdmin.config.queryLinkLabel')}</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
                    {window.location.origin}/{empresaSlug}/denuncia/consulta
                  </div>
                  <Button variant="outline" size="sm" onClick={copiarLinkConsulta}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`${window.location.origin}/${empresaSlug}/denuncia/consulta`, '_blank')}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Badge variant={formData.ativo ? "default" : "secondary"}>
                {formData.ativo ? t('denunciasAdmin.config.statusActive') : t('denunciasAdmin.config.statusInactive')}
              </Badge>
              {empresaSlug ? (
                <Badge variant="success">
                  {t('denunciasAdmin.config.friendlyUrls')}
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={regenerarToken}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {t('denunciasAdmin.config.regenerateLink')}
                </Button>
              )}
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                {empresaSlug ? (
                  <>
                    <strong>{t('denunciasAdmin.config.alertFriendlyTitle')}</strong>{t('denunciasAdmin.config.alertFriendlyText')}
                  </>
                ) : (
                  <>
                    {t('denunciasAdmin.config.alertSecureText')}
                  </>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Configurações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
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
          <Save className="w-4 h-4 mr-2" />
          {saving ? t('denunciasAdmin.config.saving') : t('denunciasAdmin.config.saveButton')}
        </Button>
      </div>
    </div>
  );
}