import { useState } from 'react';
import { IconExternal, IconSuccess, IconInfo, IconError, IconRefresh, IconSend, IconMonitor, IconCloud } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface AzureConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  existingConfig?: {
    id: string;
    webhook_url: string | null;
    configuracoes: Record<string, unknown>;
    status: string;
  };
  onSaved: () => void;
}

const buildSyncOptions = (t: (k: string) => string) => [
  { id: 'intune_devices', label: t('configIntegrations.azure.syncOptions.intuneDevices.label'), descricao: t('configIntegrations.azure.syncOptions.intuneDevices.descricao') },
  { id: 'azure_ad_devices', label: t('configIntegrations.azure.syncOptions.azureAdDevices.label'), descricao: t('configIntegrations.azure.syncOptions.azureAdDevices.descricao') },
  { id: 'azure_ad_users', label: t('configIntegrations.azure.syncOptions.azureAdUsers.label'), descricao: t('configIntegrations.azure.syncOptions.azureAdUsers.descricao') },
  { id: 'azure_ad_groups', label: t('configIntegrations.azure.syncOptions.azureAdGroups.label'), descricao: t('configIntegrations.azure.syncOptions.azureAdGroups.descricao') },
];

export function AzureConfigDialog({
  open,
  onOpenChange,
  empresaId,
  existingConfig,
  onSaved
}: AzureConfigDialogProps) {
  const { t } = useLanguage();
  const SYNC_OPTIONS = buildSyncOptions(t);
  const [tenantId, setTenantId] = useState(
    (existingConfig?.configuracoes?.tenant_id as string) || ''
  );
  const [clientId, setClientId] = useState(
    (existingConfig?.configuracoes?.client_id as string) || ''
  );
  const [clientSecret, setClientSecret] = useState('');
  const [selectedSync, setSelectedSync] = useState<string[]>(
    (existingConfig?.configuracoes?.sync_options as string[]) || ['intune_devices']
  );
  const [syncInterval, setSyncInterval] = useState(
    (existingConfig?.configuracoes?.sync_interval as string) || 'daily'
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [lastSyncInfo, setLastSyncInfo] = useState<{ count: number; date: string } | null>(null);

  const handleTestConnection = async () => {
    if (!tenantId || !clientId || (!clientSecret && !existingConfig)) {
      toast.error(t('configIntegrations.azure.toastCamposObrigatorios'), { description: t('configIntegrations.azure.toastCamposDesc') });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('azure-integration', {
        body: {
          action: 'test',
          tenant_id: tenantId,
          client_id: clientId,
          client_secret: clientSecret || undefined,
          empresa_id: empresaId
        }
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult('success');
        toast.success(t('configIntegrations.azure.toastConexaoOk'), {
          description: t('configIntegrations.azure.toastConexaoOkDesc').replace('{tenant}', data.tenant_name || tenantId)
        });
      } else {
        throw new Error(data?.error || 'Falha no teste');
      }
    } catch (error: any) {
      setTestResult('error');
      toast.error(t('configIntegrations.azure.toastConexaoFalha'), {
        description: error.message || t('configIntegrations.azure.toastConexaoFalhaDesc')
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    if (!existingConfig?.id) {
      toast.error(t('configIntegrations.azure.toastSalvePrimeiro'));
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('azure-integration', {
        body: {
          action: 'sync',
          empresa_id: empresaId,
          sync_options: selectedSync
        }
      });

      if (error) throw error;

      if (data?.success) {
        setLastSyncInfo({
          count: data.devices_synced || 0,
          date: new Date().toLocaleString('pt-BR')
        });
        toast.success(t('configIntegrations.azure.toastSyncOk'), {
          description: t('configIntegrations.azure.toastSyncOkDesc').replace('{count}', String(data.devices_synced || 0))
        });
      } else {
        throw new Error(data?.error || 'Falha na sincronização');
      }
    } catch (error: any) {
      toast.error(t('configIntegrations.azure.toastSyncErro'), { description: error.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !clientId) {
      toast.error(t('cardsKpi.sweep.sistema.camposObrigatorios'), { description: t('cardsKpi.sweep.sistema.preenchaTenantClient') });
      return;
    }

    if (!existingConfig && !clientSecret) {
      toast.error(t('cardsKpi.sweep.sistema.clientSecretObrigatorio'), { description: t('cardsKpi.sweep.sistema.informeClientSecret') });
      return;
    }

    setSaving(true);
    try {
      const configData = {
        empresa_id: empresaId,
        tipo_integracao: 'azure',
        nome_exibicao: 'Microsoft Azure / Intune',
        webhook_url: `https://graph.microsoft.com/v1.0`,
        status: 'conectado',
        configuracoes: { 
          tenant_id: tenantId,
          client_id: clientId,
          sync_options: selectedSync,
          sync_interval: syncInterval,
          has_secret: true
        },
        /*
          O segredo tem mesmo de ser gravado.

          Estava aqui um comentario a dizer «salvar credenciais de forma segura»
          e nenhuma linha a faze-lo: a configuracao gravava, o cartao dizia
          «conectado», o teste de conexao passava (porque leva o segredo no
          proprio pedido) -- e a sincronizacao morria sempre em «Credenciais
          Azure incompletas», porque nunca houvera credencial nenhuma guardada.

          Em branco ao editar significa «mantem a que la esta», nao «apaga».
        */
        ...(clientSecret ? { credenciais_encrypted: JSON.stringify({ client_secret: clientSecret }) } : {}),
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from('integracoes_config')
          .update({
            ...configData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integracoes_config')
          .insert(configData);
        if (error) throw error;
      }

      toast.success(t('configIntegrations.azure.toastConfigurado'), {
        description: t('configIntegrations.azure.toastConfiguradoDesc')
      });
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.azure.toastErroSalvar'), { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingConfig?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('integracoes_config')
        .delete()
        .eq('id', existingConfig.id);
      if (error) throw error;

      toast.success(t('configIntegrations.azure.toastDesconectado'));
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.azure.toastErroDesconectar'), { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleSync = (syncId: string) => {
    setSelectedSync(prev =>
      prev.includes(syncId)
        ? prev.filter(s => s !== syncId)
        : [...prev, syncId]
    );
  };

  const footer = (
    <div className="flex flex-col sm:flex-row gap-2 w-full">
      {existingConfig && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDisconnect}
          disabled={saving}
          className="sm:mr-auto"
        >
          {t('configIntegrations.azure.btnDesconectar')}
        </Button>
      )}
      <div className="flex gap-2 sm:ml-auto">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          {t('configIntegrations.azure.btnCancelar')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !tenantId || !clientId}>
          {saving && <AkurisPulse size={16} className="mr-2" />}
          {t('configIntegrations.azure.btnSalvar')}
        </Button>
      </div>
    </div>
  );

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('configIntegrations.azure.title')}
      description={t('configIntegrations.azure.description')}
      icon={IconCloud}
      size="lg"
      footer={footer}
      onSubmit={handleSave}
      noScroll
      isDirty={!!(tenantId || clientId || clientSecret)}
    >
      <Tabs defaultValue="config" className="w-full h-full flex flex-col">
        <TabsList className="mx-6 mt-4 flex-shrink-0" style={{ width: 'calc(100% - 3rem)' }}>
          <TabsTrigger value="config">{t('configIntegrations.azure.tabConfig')}</TabsTrigger>
          <TabsTrigger value="sync">{t('configIntegrations.azure.tabSync')}</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 min-h-0">
          <TabsContent value="config" className="space-y-6 px-6 py-4">
            {/* Instruções */}
            <div className="p-3 rounded-lg bg-card border space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <IconInfo className="h-4 w-4 text-primary" />
                {t('configIntegrations.azure.instrucoesTitle')}
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal">
                <li>{t('configIntegrations.azure.instrucao1')} <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t('configIntegrations.azure.instrucao1Link')}</a></li>
                <li>{t('configIntegrations.azure.instrucao2')}</li>
                <li>{t('configIntegrations.azure.instrucao3Pre')} <strong>{t('configIntegrations.azure.instrucao3Client')}</strong> {t('configIntegrations.azure.instrucao3E')} <strong>{t('configIntegrations.azure.instrucao3Tenant')}</strong></li>
                <li>{t('configIntegrations.azure.instrucao4')}</li>
                <li>{t('configIntegrations.azure.instrucao5')}
                  <ul className="ml-4 mt-1 list-disc">
                    <li>{t('configIntegrations.azure.perm1')}</li>
                    <li>{t('configIntegrations.azure.perm2')}</li>
                    <li>{t('configIntegrations.azure.perm3')}</li>
                  </ul>
                </li>
                <li>{t('configIntegrations.azure.instrucao6')}</li>
              </ol>
            </div>

            {/* Tenant ID */}
            <div className="space-y-2">
              <Label htmlFor="azure-tenant">{t('configIntegrations.azure.fieldTenant')}</Label>
              <Input
                id="azure-tenant"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setTestResult(null);
                }}
              />
            </div>

            {/* Client ID */}
            <div className="space-y-2">
              <Label htmlFor="azure-client">{t('configIntegrations.azure.fieldClient')}</Label>
              <Input
                id="azure-client"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setTestResult(null);
                }}
              />
            </div>

            {/* Client Secret */}
            <div className="space-y-2">
              <Label htmlFor="azure-secret">
                {t('configIntegrations.azure.fieldSecret')} {existingConfig ? t('configIntegrations.azure.fieldSecretKeep') : '*'}
              </Label>
              <Input
                id="azure-secret"
                type="password"
                placeholder="••••••••••••••••"
                value={clientSecret}
                onChange={(e) => {
                  setClientSecret(e.target.value);
                  setTestResult(null);
                }}
              />
            </div>

            {/* Testar conexão */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !tenantId || !clientId}
                className="flex-1"
              >
                {testing ? (
                  <AkurisPulse size={16} className="mr-2" />
                ) : testResult === 'success' ? (
                  <IconSuccess className="h-4 w-4 mr-2 text-success" />
                ) : testResult === 'error' ? (
                  <IconError className="h-4 w-4 mr-2 text-destructive" />
                ) : (
                  <IconSend className="h-4 w-4 mr-2" />
                )}
                {t('configIntegrations.azure.btnTestar')}
              </Button>
            </div>
            {testResult === 'success' && (
              <p className="text-xs text-success">{t('configIntegrations.azure.testSuccess')}</p>
            )}
            {testResult === 'error' && (
              <p className="text-xs text-destructive">{t('configIntegrations.azure.testError')}</p>
            )}

            {/* Link documentação */}
            <a
              href="https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t('configIntegrations.azure.linkDocs')}
              <IconExternal className="h-3 w-3" />
            </a>
          </TabsContent>

          <TabsContent value="sync" className="space-y-6 px-6 py-4">
            {/* Opções de sincronização */}
            <div className="space-y-3">
              <Label>{t('configIntegrations.azure.syncOptionsLabel')}</Label>
              <div className="space-y-3">
                {SYNC_OPTIONS.map(option => (
                  <div
                    key={option.id}
                    className="flex items-start gap-3 p-3 rounded-md border hover:bg-accent"
                  >
                    <Checkbox
                      id={option.id}
                      checked={selectedSync.includes(option.id)}
                      onCheckedChange={() => toggleSync(option.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={option.id}
                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        <IconMonitor className="h-4 w-4 text-muted-foreground" />
                        {option.label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {option.descricao}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Intervalo de sincronização */}
            <div className="space-y-2">
              <Label>{t('configIntegrations.azure.syncFreqLabel')}</Label>
              <div className="flex gap-2">
                {[
                  { value: 'manual', label: t('configIntegrations.azure.freqManual') },
                  { value: 'daily', label: t('configIntegrations.azure.freqDaily') },
                  { value: 'weekly', label: t('configIntegrations.azure.freqWeekly') },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    variant={syncInterval === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSyncInterval(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sincronizar agora */}
            {existingConfig && (
              <div className="space-y-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{t('configIntegrations.azure.syncManualTitle')}</h4>
                    <p className="text-xs text-muted-foreground">
                      {t('configIntegrations.azure.syncManualDesc')}
                    </p>
                  </div>
                  <Button
                    onClick={handleSyncNow}
                    disabled={syncing || selectedSync.length === 0}
                  >
                    {syncing ? (
                      <AkurisPulse size={16} className="mr-2" />
                    ) : (
                      <IconRefresh className="h-4 w-4 mr-2" />
                    )}
                    {t('configIntegrations.azure.btnSyncNow')}
                  </Button>
                </div>

                {lastSyncInfo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <IconSuccess className="h-3 w-3 text-success" />
                    {t('configIntegrations.azure.lastSync').replace('{count}', String(lastSyncInfo.count)).replace('{date}', lastSyncInfo.date)}
                  </div>
                )}
              </div>
            )}

            {/* Mapeamento */}
            <div className="p-3 rounded-lg bg-info/10 border border-info/30">
              <h4 className="font-medium text-sm text-info mb-2">{t('configIntegrations.azure.mappingTitle')}</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• <strong>{t('configIntegrations.azure.mapNome')}</strong> {t('configIntegrations.azure.mapNomeArrow')}</p>
                <p>• <strong>{t('configIntegrations.azure.mapModelo')}</strong> {t('configIntegrations.azure.mapModeloArrow')}</p>
                <p>• <strong>{t('configIntegrations.azure.mapOs')}</strong> {t('configIntegrations.azure.mapOsArrow')}</p>
                <p>• <strong>{t('configIntegrations.azure.mapUser')}</strong> {t('configIntegrations.azure.mapUserArrow')}</p>
                <p>• <strong>{t('configIntegrations.azure.mapCompliance')}</strong> {t('configIntegrations.azure.mapComplianceArrow')}</p>
                <p>• <strong>{t('configIntegrations.azure.mapSerial')}</strong> {t('configIntegrations.azure.mapSerialArrow')}</p>
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </DialogShell>
  );
}
