import { useState, useEffect } from 'react';
import { IconExternal, IconSuccess, IconInfo, IconError, IconSend, IconUsers } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { EventosDaIntegracao } from './EventosDaIntegracao';

interface TeamsConfigDialogProps {
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

import { INTEGRATION_EVENTS } from '@/lib/integration-events';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
const EVENTOS_DISPONIVEIS = INTEGRATION_EVENTS;

const TeamsLogoInline = () => (
  <svg viewBox="0 0 48 48" className="h-6 w-6">
    <path fill="#5059C9" d="M44 22v10c0 2.2-1.8 4-4 4h-4V18h4C42.2 18 44 19.8 44 22z"/>
    <circle fill="#5059C9" cx="36" cy="12" r="4"/>
    <circle fill="#7B83EB" cx="28" cy="10" r="6"/>
    <path fill="#7B83EB" d="M36 18H20c-2.2 0-4 1.8-4 4v14c0 5.5 4.5 10 10 10s10-4.5 10-10V22C36 19.8 34.2 18 32 18z"/>
  </svg>
);

export function TeamsConfigDialog({
  open,
  onOpenChange,
  empresaId,
  existingConfig,
  onSaved
}: TeamsConfigDialogProps) {
  const { t } = useLanguage();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(EVENTOS_DISPONIVEIS.map(e => e.id));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Reset state when dialog opens or existingConfig changes
  useEffect(() => {
    if (open) {
      setWebhookUrl(existingConfig?.webhook_url || '');
      setSelectedEvents(
        (existingConfig?.configuracoes?.eventos as string[]) || EVENTOS_DISPONIVEIS.map(e => e.id)
      );
      setTestResult(null);
      setSaving(false);
      setTesting(false);
    }
  }, [open, existingConfig]);

  const handleTestConnection = async () => {
    if (!webhookUrl) {
      toast.error(t('configIntegrations.teams.toastUrlObrig'), { description: t('configIntegrations.teams.toastUrlObrigDesc') });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-integration-connection', {
        body: {
          tipo: 'teams',
          webhook_url: webhookUrl
        }
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult('success');
        toast.success(t('configIntegrations.teams.toastConexaoOk'), {
          description: t('configIntegrations.teams.toastConexaoOkDesc')
        });
      } else {
        throw new Error(data?.error || 'Falha no teste');
      }
    } catch (error: any) {
      setTestResult('error');
      toast.error(t('configIntegrations.teams.toastConexaoFalha'), {
        description: error.message || t('configIntegrations.teams.toastConexaoFalhaDesc')
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl) {
      toast.error(t('configIntegrations.teams.toastUrlObrig'), { description: t('configIntegrations.teams.toastUrlObrigDesc') });
      return;
    }

    setSaving(true);
    try {
      const configData = {
        empresa_id: empresaId,
        tipo_integracao: 'teams',
        nome_exibicao: 'Microsoft Teams',
        webhook_url: webhookUrl,
        status: 'conectado',
        configuracoes: { eventos: selectedEvents }
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

      toast.success(t('configIntegrations.teams.toastConfigurado'), {
        description: t('configIntegrations.teams.toastConfiguradoDesc')
      });
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.teams.toastErroSalvar'), { description: error.message });
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

      toast.success(t('configIntegrations.teams.toastDesconectado'));
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.teams.toastErroDesconectar'), { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
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
          {t('configIntegrations.teams.btnDesconectar')}
        </Button>
      )}
      <div className="flex gap-2 sm:ml-auto">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          {t('configIntegrations.teams.btnCancelar')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !webhookUrl}>
          {saving && <AkurisPulse size={16} className="mr-2" />}
          {t('configIntegrations.teams.btnSalvar')}
        </Button>
      </div>
    </div>
  );

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('configIntegrations.teams.title')}
      description={t('configIntegrations.teams.description')}
      icon={IconUsers}
      size="md"
      footer={footer}
      onSubmit={handleSave}
      isDirty={!!webhookUrl && webhookUrl !== (existingConfig?.webhook_url || '')}
    >
      <div className="space-y-6">
          {/* Instruções */}
          <div className="p-3 rounded-lg bg-card border space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <IconInfo className="h-4 w-4 text-primary" />
              {t('configIntegrations.teams.instrucoesTitle')}
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal">
              <li>{t('configIntegrations.teams.instrucao1')}</li>
              <li>{t('configIntegrations.teams.instrucao2')}</li>
              <li>{t('configIntegrations.teams.instrucao3')}</li>
              <li>{t('configIntegrations.teams.instrucao4')}</li>
              <li>{t('configIntegrations.teams.instrucao5')}</li>
            </ol>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="teams-webhook">{t('configIntegrations.teams.fieldWebhook')}</Label>
            <div className="flex gap-2">
              <Input
                id="teams-webhook"
                placeholder="https://outlook.office.com/webhook/..."
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setTestResult(null);
                }}
                disabled={saving}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleTestConnection}
                disabled={testing || !webhookUrl || saving}
              >
                {testing ? (
                  <AkurisPulse size={16} />
                ) : testResult === 'success' ? (
                  <IconSuccess className="h-4 w-4 text-success" />
                ) : testResult === 'error' ? (
                  <IconError className="h-4 w-4 text-destructive" />
                ) : (
                  <IconSend className="h-4 w-4" />
                )}
              </Button>
            </div>
            {testResult === 'success' && (
              <p className="text-xs text-success">{t('configIntegrations.teams.testSuccess')}</p>
            )}
            {testResult === 'error' && (
              <p className="text-xs text-destructive">{t('configIntegrations.teams.testError')}</p>
            )}
          </div>

          <EventosDaIntegracao
            prefixo="teams"
            valor={selectedEvents}
            onChange={setSelectedEvents}
          />

          {/* Link documentação */}
          <a
            href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('configIntegrations.teams.linkDocs')}
            <IconExternal className="h-3 w-3" />
          </a>
      </div>
    </DialogShell>
  );
}
