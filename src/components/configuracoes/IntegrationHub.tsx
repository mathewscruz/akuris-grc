import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plug, CheckCircle2, XCircle, Info, History, Key, Webhook } from 'lucide-react';
import { SlackConfigDialog } from './integrations/SlackConfigDialog';
import { TeamsConfigDialog } from './integrations/TeamsConfigDialog';
import { WebhooksConfigDialog } from './integrations/WebhooksConfigDialog';
import { JiraConfigDialog } from './integrations/JiraConfigDialog';
import { AzureConfigDialog } from './integrations/AzureConfigDialog';
import { IntegrationLogViewer } from './integrations/IntegrationLogViewer';
import { ApiKeysManager } from './ApiKeysManager';
import { InboundWebhooksManager } from './InboundWebhooksManager';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
// Logos inline SVG
const SlackLogo = () => (
  <svg viewBox="0 0 127 127" className="w-8 h-8">
    <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A"/>
    <path d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H14c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33z" fill="#36C5F0"/>
    <path d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V14c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v32.9z" fill="#2EB67D"/>
    <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2h-33z" fill="#ECB22E"/>
  </svg>
);

const TeamsLogo = () => (
  <svg viewBox="0 0 48 48" className="w-8 h-8">
    <path fill="#5059C9" d="M44 22v10c0 2.2-1.8 4-4 4h-4V18h4C42.2 18 44 19.8 44 22z"/>
    <circle fill="#5059C9" cx="36" cy="12" r="4"/>
    <circle fill="#7B83EB" cx="28" cy="10" r="6"/>
    <path fill="#7B83EB" d="M36 18H20c-2.2 0-4 1.8-4 4v14c0 5.5 4.5 10 10 10s10-4.5 10-10V22C36 19.8 34.2 18 32 18z"/>
  </svg>
);

// Logos removidos: OneDrive, Google Drive, Zapier (placeholders sem funcionalidade)

const JiraLogo = () => (
  <svg viewBox="0 0 32 32" className="w-8 h-8">
    <defs>
      <linearGradient id="jira-a" x1="99%" y1="26%" x2="24%" y2="99%">
        <stop offset="18%" stopColor="#0052cc"/>
        <stop offset="100%" stopColor="#2684ff"/>
      </linearGradient>
      <linearGradient id="jira-b" x1="12%" y1="80%" x2="79%" y2="20%">
        <stop offset="18%" stopColor="#0052cc"/>
        <stop offset="100%" stopColor="#2684ff"/>
      </linearGradient>
    </defs>
    <path fill="url(#jira-a)" d="M15.52 1.09L1.09 15.52a.75.75 0 000 1.06l14.43 14.43a.75.75 0 001.06 0l7.22-7.22L16.03 16l7.77-7.79-7.22-7.22a.75.75 0 00-1.06.1z"/>
    <path fill="url(#jira-b)" d="M15.52 9.44L9.06 16l6.46 6.56 6.97-6.97a.84.84 0 000-1.18z"/>
  </svg>
);

const AzureLogo = () => (
  <svg viewBox="0 0 96 96" className="w-8 h-8">
    <defs>
      <linearGradient id="azure-a" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#114a8b"/>
        <stop offset="100%" stopColor="#0669bc"/>
      </linearGradient>
      <linearGradient id="azure-c" x1="40%" y1="0%" x2="57%" y2="100%">
        <stop offset="0%" stopColor="#3ccbf4"/>
        <stop offset="100%" stopColor="#2892df"/>
      </linearGradient>
    </defs>
    <path fill="url(#azure-a)" d="M33.34 6.54H56.8L32.54 88.55a3.58 3.58 0 01-3.4 2.45H7.9a3.58 3.58 0 01-3.39-4.71L28 9a3.58 3.58 0 013.34-2.46z"/>
    <path fill="url(#azure-c)" d="M33.34 6.54a3.54 3.54 0 00-3.38 2.51L6.51 86.32a3.58 3.58 0 003.39 4.68h22.62a3.73 3.73 0 002.87-2.39l5.06-14.89 17.76 16.6a3.64 3.64 0 002.3.68h24.44l-10.7-30.74-36.08.02L56.8 6.54z"/>
  </svg>
);

const WebhookIcon = () => (
  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
    <Plug className="w-5 h-5 text-white" />
  </div>
);

interface Integration {
  id: string;
  tipo: string;
  nome: string;
  descricao: string;
  categoria: string;
  disponivel: boolean;
  betaLabel?: string;
  cor: string;
  Logo: React.FC;
}

interface IntegrationConfig {
  id: string;
  tipo_integracao: string;
  status: string;
  configuracoes: any;
  ultima_sincronizacao?: string;
}

const buildIntegracoesDisponiveis = (t: (k: string) => string): Integration[] => [
  {
    id: 'slack',
    tipo: 'slack',
    nome: t('configIntegrations.hub.integracoes.slack.nome'),
    descricao: t('configIntegrations.hub.integracoes.slack.descricao'),
    categoria: 'comunicacao',
    disponivel: true,
    betaLabel: 'Webhook',
    cor: '#4A154B',
    Logo: SlackLogo
  },
  {
    id: 'teams',
    tipo: 'teams',
    nome: t('configIntegrations.hub.integracoes.teams.nome'),
    descricao: t('configIntegrations.hub.integracoes.teams.descricao'),
    categoria: 'comunicacao',
    disponivel: true,
    betaLabel: 'Webhook',
    cor: '#5059C9',
    Logo: TeamsLogo
  },
  {
    id: 'webhooks',
    tipo: 'webhooks',
    nome: t('configIntegrations.hub.integracoes.webhooks.nome'),
    descricao: t('configIntegrations.hub.integracoes.webhooks.descricao'),
    categoria: 'automacao',
    disponivel: true,
    cor: '#7C3AED',
    Logo: WebhookIcon
  },
  {
    id: 'jira',
    tipo: 'jira',
    nome: t('configIntegrations.hub.integracoes.jira.nome'),
    descricao: t('configIntegrations.hub.integracoes.jira.descricao'),
    categoria: 'itsm',
    disponivel: true,
    cor: '#0052CC',
    Logo: JiraLogo
  },
  {
    id: 'azure',
    tipo: 'azure',
    nome: t('configIntegrations.hub.integracoes.azure.nome'),
    descricao: t('configIntegrations.hub.integracoes.azure.descricao'),
    categoria: 'cloud',
    disponivel: true,
    cor: '#0078D4',
    Logo: AzureLogo
  },
];

const buildCategorias = (t: (k: string) => string) => ({
  comunicacao: { nome: t('configIntegrations.hub.categorias.comunicacao.nome'), descricao: t('configIntegrations.hub.categorias.comunicacao.descricao') },
  automacao: { nome: t('configIntegrations.hub.categorias.automacao.nome'), descricao: t('configIntegrations.hub.categorias.automacao.descricao') },
  itsm: { nome: t('configIntegrations.hub.categorias.itsm.nome'), descricao: t('configIntegrations.hub.categorias.itsm.descricao') },
  cloud: { nome: t('configIntegrations.hub.categorias.cloud.nome'), descricao: t('configIntegrations.hub.categorias.cloud.descricao') },
});

export function IntegrationHub() {
  const { t } = useLanguage();
  const INTEGRACOES_DISPONIVEIS = buildIntegracoesDisponiveis(t);
  const CATEGORIAS = buildCategorias(t);
  const [loading, setLoading] = useState(true);
  const [configuredIntegrations, setConfiguredIntegrations] = useState<IntegrationConfig[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  
  // Dialog states
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [webhooksDialogOpen, setWebhooksDialogOpen] = useState(false);
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false);
  const [azureDialogOpen, setAzureDialogOpen] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user.id)
        .single();

      if (profile?.empresa_id) {
        setEmpresaId(profile.empresa_id);
        const { data, error } = await supabase
          .from('integracoes_config')
          .select('*')
          .eq('empresa_id', profile.empresa_id);

        if (error) throw error;
        setConfiguredIntegrations((data || []).map(d => ({
          id: d.id,
          tipo_integracao: d.tipo_integracao,
          status: d.status,
          configuracoes: d.configuracoes,
          ultima_sincronizacao: d.ultima_sincronizacao
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar integrações:', error);
      toast.error(t('configIntegrations.hub.toastErrorLoad'));
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationStatus = (tipo: string): 'conectado' | 'desconectado' | 'erro' => {
    const config = configuredIntegrations.find(c => c.tipo_integracao === tipo);
    if (!config) return 'desconectado';
    return config.status as 'conectado' | 'desconectado' | 'erro';
  };

  const getExistingConfig = (tipo: string) => {
    return configuredIntegrations.find(c => c.tipo_integracao === tipo);
  };

  const handleConfigureClick = (integration: Integration) => {
    if (!integration.disponivel) {
      toast.info(t('configIntegrations.hub.toastEmBreveTitle'), {
        description: t('configIntegrations.hub.toastEmBreveDesc').replace('{nome}', integration.nome),
      });
      return;
    }

    switch (integration.tipo) {
      case 'slack':
        setSlackDialogOpen(true);
        break;
      case 'teams':
        setTeamsDialogOpen(true);
        break;
      case 'webhooks':
        setWebhooksDialogOpen(true);
        break;
      case 'jira':
        setJiraDialogOpen(true);
        break;
      case 'azure':
        setAzureDialogOpen(true);
        break;
    }
  };

  const renderIntegrationCard = (integration: Integration) => {
    const status = getIntegrationStatus(integration.tipo);
    const Logo = integration.Logo;

    return (
      <Card 
        key={integration.id} 
        className={`relative overflow-hidden transition-all hover:shadow-md ${
          !integration.disponivel ? 'opacity-60' : ''
        }`}
      >
        {!integration.disponivel && (
          <Badge variant="secondary" className="absolute top-3 right-3 text-xs">
            {t('configIntegrations.hub.emBreve')}
          </Badge>
        )}
        {integration.disponivel && integration.betaLabel && (
          <Badge variant="outline" className="absolute top-3 right-3 text-xs border-primary/30 text-primary">
            {integration.betaLabel}
          </Badge>
        )}
        
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div 
              className="p-2 rounded-lg flex items-center justify-center" 
              style={{ backgroundColor: `${integration.cor}15` }}
            >
              <Logo />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                {integration.nome}
                {status === 'conectado' && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {status === 'erro' && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-1 line-clamp-2">
                {integration.descricao}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <Badge 
              variant={status === 'conectado' ? 'default' : 'outline'}
              className={status === 'conectado' ? 'bg-green-500/10 text-green-600 border-green-200' : ''}
            >
              {status === 'conectado' ? t('configIntegrations.hub.conectado') : t('configIntegrations.hub.desconectado')}
            </Badge>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleConfigureClick(integration)}
              disabled={!integration.disponivel}
            >
              {status === 'conectado' ? t('configIntegrations.hub.btnConfigurar') : t('configIntegrations.hub.btnConectar')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <AkurisPulse size={32} className="text-muted-foreground" />
      </div>
    );
  }

  const integracoesPorCategoria = INTEGRACOES_DISPONIVEIS.reduce((acc, int) => {
    if (!acc[int.categoria]) acc[int.categoria] = [];
    acc[int.categoria].push(int);
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="conectores" className="space-y-6">
        <TabsList>
          <TabsTrigger value="conectores" className="gap-2">
            <Plug className="h-4 w-4" /> {t('configIntegrations.hub.tabConectores')}
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-4 w-4" /> {t('configIntegrations.hub.tabApiKeys')}
          </TabsTrigger>
          <TabsTrigger value="inbound-webhooks" className="gap-2">
            <Webhook className="h-4 w-4" /> {t('configIntegrations.hub.tabInboundWebhooks')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conectores">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border flex-1">
                <Info className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {t('configIntegrations.hub.infoBanner')}
                </p>
              </div>
              <Button variant="outline" className="ml-4" onClick={() => setLogViewerOpen(true)}>
                <History className="h-4 w-4 mr-2" />
                {t('configIntegrations.hub.verLogs')}
              </Button>
            </div>

            {Object.entries(integracoesPorCategoria).map(([categoria, integracoes]) => (
              <div key={categoria} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{CATEGORIAS[categoria as keyof typeof CATEGORIAS]?.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {CATEGORIAS[categoria as keyof typeof CATEGORIAS]?.descricao}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integracoes.map(renderIntegrationCard)}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysManager />
        </TabsContent>

        <TabsContent value="inbound-webhooks">
          <InboundWebhooksManager />
        </TabsContent>
      </Tabs>

      {empresaId && (
        <>
          <SlackConfigDialog
            open={slackDialogOpen}
            onOpenChange={setSlackDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('slack') as any}
            onSaved={fetchIntegrations}
          />
          <TeamsConfigDialog
            open={teamsDialogOpen}
            onOpenChange={setTeamsDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('teams') as any}
            onSaved={fetchIntegrations}
          />
          <WebhooksConfigDialog
            open={webhooksDialogOpen}
            onOpenChange={setWebhooksDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('webhooks') as any}
            onSaved={fetchIntegrations}
          />
          <JiraConfigDialog
            open={jiraDialogOpen}
            onOpenChange={setJiraDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('jira') as any}
            onSaved={fetchIntegrations}
          />
          <AzureConfigDialog
            open={azureDialogOpen}
            onOpenChange={setAzureDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('azure') as any}
            onSaved={fetchIntegrations}
          />
        </>
      )}

      <IntegrationLogViewer open={logViewerOpen} onOpenChange={setLogViewerOpen} />
    </div>
  );
}
