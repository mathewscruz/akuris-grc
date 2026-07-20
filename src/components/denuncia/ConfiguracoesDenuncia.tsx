import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
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
  const [config, setConfig] = useState<ConfiguracaoDenuncia | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [empresaSlug, setEmpresaSlug] = useState<string>('');
  const { toast } = useToast();

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
        title: "Erro",
        description: "Erro ao carregar configurações",
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
        title: "Sucesso",
        description: "Configurações salvas com sucesso"
      });

      carregarConfiguracao();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
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
      title: "Copiado!",
      description: "Link copiado para a área de transferência"
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
        title: "Copiado!",
        description: "Link de consulta copiado para a área de transferência"
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
        title: "Sucesso",
        description: "Link regenerado com sucesso. O link anterior não funcionará mais."
      });

      carregarConfiguracao();
    } catch (error) {
      console.error('Erro ao regenerar token:', error);
      toast({
        title: "Erro",
        description: "Erro ao regenerar link",
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
          <h2 className="text-2xl font-bold">Configurações do Canal de Denúncia</h2>
          <p className="text-muted-foreground">
            Configure como o canal de denúncia funcionará na sua empresa
          </p>
        </div>
      </div>

      {/* Link Público */}
      {(config?.token_publico || empresaSlug) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Links Públicos do Canal de Denúncia
            </CardTitle>
            <CardDescription>
              Links que devem ser compartilhados para receber denúncias e consultas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Link para criar denúncia */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Formulário de Denúncia</Label>
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
                <Label className="text-sm font-medium">Consulta de Protocolo</Label>
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
                {formData.ativo ? "Ativo" : "Inativo"}
              </Badge>
              {empresaSlug ? (
                <Badge variant="success">
                  URLs Amigáveis
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={regenerarToken}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerar Link
                </Button>
              )}
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                {empresaSlug ? (
                  <>
                    <strong>URLs Amigáveis Ativas:</strong> Suas denúncias agora usam links 
                    profissionais com o nome da empresa. Os denunciantes podem acompanhar 
                    o status usando o protocolo recebido.
                  </>
                ) : (
                  <>
                    Mantenha este link seguro. Qualquer pessoa com acesso poderá enviar denúncias.
                    Ao regenerar o link, o anterior deixará de funcionar.
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
            Configurações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Canal Ativo</Label>
                  <div className="text-sm text-muted-foreground">
                    Permitir recebimento de novas denúncias
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
                  <Label>Permitir Denúncias Anônimas</Label>
                  <div className="text-sm text-muted-foreground">
                    Denunciantes podem optar por não se identificar
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
                  <Label>E-mail Obrigatório</Label>
                  <div className="text-sm text-muted-foreground">
                    Exigir e-mail em denúncias não anônimas
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
                  <Label>Notificar Administradores</Label>
                  <div className="text-sm text-muted-foreground">
                    Enviar e-mail quando nova denúncia for recebida
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
                  <Label htmlFor="emails">E-mails para Notificação</Label>
                  <Input
                    id="emails"
                    value={formData.emails_notificacao}
                    onChange={(e) => 
                      setFormData(prev => ({ ...prev, emails_notificacao: e.target.value }))
                    }
                    placeholder="email1@empresa.com, email2@empresa.com"
                  />
                  <div className="text-xs text-muted-foreground">
                    Separe múltiplos e-mails com vírgula
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
          <CardTitle>Personalização do Formulário</CardTitle>
          <CardDescription>
            Customize os textos exibidos no formulário público
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apresentacao">Texto de Apresentação</Label>
            <Textarea
              id="apresentacao"
              value={formData.texto_apresentacao}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, texto_apresentacao: e.target.value }))
              }
              placeholder="Texto que aparecerá no topo do formulário..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="politica">Política de Privacidade</Label>
            <Textarea
              id="politica"
              value={formData.politica_privacidade}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, politica_privacidade: e.target.value }))
              }
              placeholder="Política de privacidade que o denunciante deve aceitar..."
              rows={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSalvar} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}