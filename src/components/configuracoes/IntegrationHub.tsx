import { useState, useEffect } from 'react';
import { IconSuccess, IconError, IconPlug, IconInfo, IconHistory, IconKey, IconLink, IconScale } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { SlackConfigDialog } from './integrations/SlackConfigDialog';
import { TeamsConfigDialog } from './integrations/TeamsConfigDialog';
import { WebhooksConfigDialog } from './integrations/WebhooksConfigDialog';
import { JiraConfigDialog } from './integrations/JiraConfigDialog';
import { AzureConfigDialog } from './integrations/AzureConfigDialog';
import { ServiceNowConfigDialog } from './integrations/ServiceNowConfigDialog';
import { TransparenciaConfigDialog } from './integrations/TransparenciaConfigDialog';
import { GoogleWorkspaceConfigDialog } from './integrations/GoogleWorkspaceConfigDialog';
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
    {/* Silhueta à direita e o disco por cima — as duas peças roxas da marca. */}
    <path fill="#5059C9" d="M44.5 23v9.2c0 2.4-2 4.4-4.4 4.4h-3.9V18.6h3.9c2.4 0 4.4 2 4.4 4.4z"/>
    <circle fill="#5059C9" cx="37.1" cy="11.4" r="4.2"/>
    <circle fill="#7B83EB" cx="27.6" cy="9.3" r="6.2"/>
    <path fill="#7B83EB" d="M33.6 18.6H21.7c-2.3 0-4.2 1.9-4.2 4.2v11.9c0 5.6 4.5 10.1 10.1 10.1s10.1-4.5 10.1-10.1V22.8c0-2.3-1.9-4.2-4.1-4.2z"/>
    {/* O quadrado com o T — é ele que faz a marca ser o Teams e não um ícone
        genérico de pessoas. Estava em falta. */}
    <rect fill="#4B53BC" x="2.5" y="12.5" width="23" height="23" rx="2.2"/>
    <path fill="#FFFFFF" d="M20.4 18.9H7.6v2.9h4.7v11.3h3.4V21.8h4.7z"/>
  </svg>
);

// Logos removidos: OneDrive, Google Drive, Zapier (placeholders sem funcionalidade)

const JiraLogo = () => (
  /*
    Marca oficial da Atlassian, finalmente.

    Esta foi errada tres vezes: uma por rotacao (cortava fora do viewBox), uma
    por redesenho (virou um losango solido) e uma por ficar como estava, com o
    chevron a apontar para o lado errado. O problema nunca foi a geometria ser
    dificil -- foi eu insistir em desenha-la de cabeca. Agora e o path oficial,
    e o unico juizo que fica meu e a cor de marca (#2684FF).
  */
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#2684FF" aria-hidden="true">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z" />
  </svg>
);

const AzureLogo = () => (
  <svg viewBox="0 0 96 96" className="w-8 h-8">
    <defs>
      <linearGradient id="azure-a" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#114a8b"/>
        <stop offset="100%" stopColor="#0669bc"/>
      </linearGradient>
      <linearGradient id="azure-b" x1="30%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#3ccbf4"/>
        <stop offset="100%" stopColor="#2892df"/>
      </linearGradient>
      <linearGradient id="azure-c" x1="40%" y1="0%" x2="57%" y2="100%">
        <stop offset="0%" stopColor="#3ccbf4"/>
        <stop offset="100%" stopColor="#2892df"/>
      </linearGradient>
    </defs>
    <path fill="url(#azure-a)" d="M33.3 6.5h23.5L32.5 88.6a3.6 3.6 0 01-3.4 2.4H7.9a3.6 3.6 0 01-3.4-4.7L28 9a3.6 3.6 0 013.3-2.5z"/>
    {/* A face do meio — o gradiente `azure-b` era declarado e nunca usado, e
        o "A" ficava com duas peças em vez de três. */}
    <path fill="url(#azure-b)" d="M67.8 61.2H30.5a1.7 1.7 0 00-1.1 2.9l24 22.4a3.6 3.6 0 002.5 1h21.4z"/>
    <path fill="url(#azure-c)" d="M63.9 9a3.6 3.6 0 00-3.4-2.5H33.6a3.6 3.6 0 013.4 2.5l23.5 77.3a3.6 3.6 0 01-3.4 4.7h26.9a3.6 3.6 0 003.4-4.7z"/>
  </svg>
);

const WebhookIcon = () => (
  <IconPlug className="w-5 h-5 shrink-0 text-primary" />
);

/*
  ServiceNow: o «o» de «now», recortado do logótipo oficial.

  O logótipo da ServiceNow é um wordmark — «servicenow» por extenso, numa caixa
  de 130 por 19. A vinte pixels de altura seria uma mancha ilegível. Mas dentro
  dele vive o glifo que a própria ServiceNow usa como marca compacta: o «o»
  verde, com o entalhe em baixo.

  O `viewBox` recorta esse glifo do desenho original em vez de o redesenhar —
  são as coordenadas oficiais, na cor oficial (#81B5A1), sem uma curva minha
  pelo meio.
*/
const ServiceNowLogo = () => (
  <svg viewBox="95.3 5.4 15.2 14" className="w-8 h-8 shrink-0" aria-hidden="true">
    <path
      fill="#81B5A1"
      d="m102.8 5.762c-4.2 0-7.5 3.3-7.5 7.5 0 2.2 0.9 4.2 2.3 5.6 0.5 0.5 1.4 0.5 2 0.1 0.8-0.7 2-1.1 3.2-1.1 1.3 0 2.3 0.4 3.2 1.1 0.6 0.5 1.4 0.4 2-0.2 1.4-1.4 2.3-3.3 2.3-5.5-0.1-4.1-3.4-7.5-7.5-7.5m-0.1 11.4c-2.3 0-3.8-1.7-3.8-3.8s1.5-3.8 3.8-3.8 3.8 1.7 3.8 3.8-1.5 3.8-3.8 3.8"
    />
  </svg>
);

/* O «G» de quatro cores, nas quatro demãos oficiais. */
const GoogleWorkspaceLogo = () => (
  <svg viewBox="0 0 128 128" className="w-8 h-8 shrink-0" aria-hidden="true">
    <path fill="#e33629" d="M44.59 4.21a64 64 0 0142.61.37 61.22 61.22 0 0120.35 12.62c-2 2.14-4.11 4.14-6.15 6.22Q95.58 29.23 89.77 35a34.28 34.28 0 00-13.64-8 37.17 37.17 0 00-37.46 9.74 39.25 39.25 0 00-9.18 14.91L8.76 35.6A63.53 63.53 0 0144.59 4.21z" />
    <path fill="#f8bd00" d="M3.26 51.5a62.93 62.93 0 015.5-15.9l20.73 16.09a38.31 38.31 0 000 24.63q-10.36 8-20.73 16.08a63.33 63.33 0 01-5.5-40.9z" />
    <path fill="#587dbd" d="M65.27 52.15h59.52a74.33 74.33 0 01-1.61 33.58 57.44 57.44 0 01-16 26.26c-6.69-5.22-13.41-10.4-20.1-15.62a29.72 29.72 0 0012.66-19.54H65.27c-.01-8.22 0-16.45 0-24.68z" />
    <path fill="#319f43" d="M8.75 92.4q10.37-8 20.73-16.08A39.3 39.3 0 0044 95.74a37.16 37.16 0 0014.08 6.08 41.29 41.29 0 0015.1 0 36.16 36.16 0 0013.93-5.5c6.69 5.22 13.41 10.4 20.1 15.62a57.13 57.13 0 01-25.9 13.47 67.6 67.6 0 01-32.36-.35 63 63 0 01-23-11.59A63.73 63.73 0 018.75 92.4z" />
  </svg>
);

/*
  O Portal da Transparência fica com ícone genérico, e é decisão, não desleixo.

  Não é uma marca de fornecedor: é um serviço do governo federal, cuja
  identidade visual é a do gov.br — um wordmark, sem símbolo compacto. Desenhar
  um seria inventar um brasão que não existe, que foi exactamente o erro que
  cometi três vezes com o Jira. Um ícone claramente genérico lê-se como ícone;
  uma aproximação desenhada a olho lê-se como logótipo, e está errada.

  A cor é a oficial do gov.br (#1351B4), e a balança diz do que a integração
  trata: listas restritivas.
*/
const TransparenciaLogo = () => (
  <IconScale className="w-5 h-5 shrink-0" style={{ color: '#1351B4' }} />
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
  {
    id: 'servicenow',
    tipo: 'servicenow',
    nome: t('configIntegrations.hub.integracoes.servicenow.nome'),
    descricao: t('configIntegrations.hub.integracoes.servicenow.descricao'),
    categoria: 'itsm',
    disponivel: true,
    cor: '#62D84E',
    Logo: ServiceNowLogo
  },
  {
    id: 'google_workspace',
    tipo: 'google_workspace',
    nome: t('configIntegrations.hub.integracoes.google_workspace.nome'),
    descricao: t('configIntegrations.hub.integracoes.google_workspace.descricao'),
    categoria: 'cloud',
    disponivel: true,
    cor: '#1A73E8',
    Logo: GoogleWorkspaceLogo
  },
  {
    id: 'transparencia',
    tipo: 'transparencia',
    nome: t('configIntegrations.hub.integracoes.transparencia.nome'),
    descricao: t('configIntegrations.hub.integracoes.transparencia.descricao'),
    categoria: 'dados_publicos',
    disponivel: true,
    cor: '#1351B4',
    Logo: TransparenciaLogo
  },
];

const buildCategorias = (t: (k: string) => string) => ({
  comunicacao: { nome: t('configIntegrations.hub.categorias.comunicacao.nome'), descricao: t('configIntegrations.hub.categorias.comunicacao.descricao') },
  automacao: { nome: t('configIntegrations.hub.categorias.automacao.nome'), descricao: t('configIntegrations.hub.categorias.automacao.descricao') },
  itsm: { nome: t('configIntegrations.hub.categorias.itsm.nome'), descricao: t('configIntegrations.hub.categorias.itsm.descricao') },
  cloud: { nome: t('configIntegrations.hub.categorias.cloud.nome'), descricao: t('configIntegrations.hub.categorias.cloud.descricao') },
  dados_publicos: { nome: t('configIntegrations.hub.categorias.dados_publicos.nome'), descricao: t('configIntegrations.hub.categorias.dados_publicos.descricao') },
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
  const [serviceNowDialogOpen, setServiceNowDialogOpen] = useState(false);
  const [transparenciaDialogOpen, setTransparenciaDialogOpen] = useState(false);
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);

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
      case 'servicenow':
        setServiceNowDialogOpen(true);
        break;
      case 'transparencia':
        setTransparenciaDialogOpen(true);
        break;
      case 'google_workspace':
        setGoogleDialogOpen(true);
        break;
    }
  };

  const renderIntegrationCard = (integration: Integration) => {
    const status = getIntegrationStatus(integration.tipo);
    const Logo = integration.Logo;

    return (
      <Card 
        key={integration.id} 
        className={`relative overflow-hidden transition-ui hover:shadow-sm ${
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
                  <IconSuccess className="h-4 w-4 text-success" />
                )}
                {status === 'erro' && (
                  <IconError className="h-4 w-4 text-destructive" />
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
              className={status === 'conectado' ? 'bg-success/10 text-success border-success/30' : ''}
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
      <Tabs defaultValue="conectores">
        <TabsList>
          <TabsTrigger value="conectores" className="gap-2">
            <IconPlug className="h-4 w-4" /> {t('configIntegrations.hub.tabConectores')}
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <IconKey className="h-4 w-4" /> {t('configIntegrations.hub.tabApiKeys')}
          </TabsTrigger>
          <TabsTrigger value="inbound-webhooks" className="gap-2">
            <IconLink className="h-4 w-4" /> {t('configIntegrations.hub.tabInboundWebhooks')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conectores">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border flex-1">
                <IconInfo className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {t('configIntegrations.hub.infoBanner')}
                </p>
              </div>
              <Button variant="outline" className="ml-4" onClick={() => setLogViewerOpen(true)}>
                <IconHistory className="h-4 w-4 mr-2" />
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
          <ServiceNowConfigDialog
            open={serviceNowDialogOpen}
            onOpenChange={setServiceNowDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('servicenow') as any}
            onSaved={fetchIntegrations}
          />
          <TransparenciaConfigDialog
            open={transparenciaDialogOpen}
            onOpenChange={setTransparenciaDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('transparencia') as any}
            onSaved={fetchIntegrations}
          />
          <GoogleWorkspaceConfigDialog
            open={googleDialogOpen}
            onOpenChange={setGoogleDialogOpen}
            empresaId={empresaId}
            existingConfig={getExistingConfig('google_workspace') as any}
            onSaved={fetchIntegrations}
          />
        </>
      )}

      <IntegrationLogViewer open={logViewerOpen} onOpenChange={setLogViewerOpen} />
    </div>
  );
}
