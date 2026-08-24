import { useState, useEffect } from 'react';
import { IconExternal, IconSuccess, IconInfo, IconError, IconSend, IconMessage } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SlackConfigDialogProps {
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
import { useLanguage } from '@/contexts/LanguageContext';
import { EventosDaIntegracao } from './EventosDaIntegracao';
const EVENTOS_DISPONIVEIS = INTEGRATION_EVENTS;


export function SlackConfigDialog({
  open,
  onOpenChange,
  empresaId,
  existingConfig,
  onSaved
}: SlackConfigDialogProps) {
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
      toast.error(t('configIntegrations.slack.toastUrlObrig'), { description: t('configIntegrations.slack.toastUrlObrigDesc') });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-integration-connection', {
        body: {
          tipo: 'slack',
          webhook_url: webhookUrl
        }
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult('success');
        toast.success(t('configIntegrations.slack.toastConexaoOk'), {
          description: t('configIntegrations.slack.toastConexaoOkDesc')
        });
      } else {
        throw new Error(data?.error || 'Falha no teste');
      }
    } catch (error: any) {
      setTestResult('error');
      toast.error(t('configIntegrations.slack.toastConexaoFalha'), {
        description: error.message || t('configIntegrations.slack.toastConexaoFalhaDesc')
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl) {
      toast.error(t('configIntegrations.slack.toastUrlObrig'), { description: t('configIntegrations.slack.toastUrlObrigDesc') });
      return;
    }

    setSaving(true);
    try {
      const configData = {
        empresa_id: empresaId,
        tipo_integracao: 'slack',
        nome_exibicao: 'Slack',
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

      toast.success(t('configIntegrations.slack.toastConfigurado'), {
        description: t('configIntegrations.slack.toastConfiguradoDesc')
      });
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.slack.toastErroSalvar'), { description: error.message });
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

      toast.success(t('configIntegrations.slack.toastDesconectado'));
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.slack.toastErroDesconectar'), { description: error.message });
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
          {t('configIntegrations.slack.btnDesconectar')}
        </Button>
      )}
      <div className="flex gap-2 sm:ml-auto">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          {t('configIntegrations.slack.btnCancelar')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !webhookUrl}>
          {saving && <AkurisPulse size={16} className="mr-2" />}
          {t('configIntegrations.slack.btnSalvar')}
        </Button>
      </div>
    </div>
  );

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('configIntegrations.slack.title')}
      description={t('configIntegrations.slack.description')}
      icon={IconMessage}
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
              {t('configIntegrations.slack.instrucoesTitle')}
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal">
              <li>{t('configIntegrations.slack.instrucao1')}</li>
              <li>{t('configIntegrations.slack.instrucao2')}</li>
              <li>{t('configIntegrations.slack.instrucao3')}</li>
              <li>{t('configIntegrations.slack.instrucao4')}</li>
              <li>{t('configIntegrations.slack.instrucao5')}</li>
            </ol>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="slack-webhook">{t('configIntegrations.slack.fieldWebhook')}</Label>
            <div className="flex gap-2">
              <Input
                id="slack-webhook"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setTestResult(null);
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleTestConnection}
                disabled={testing || !webhookUrl}
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
              <p className="text-xs text-success">{t('configIntegrations.slack.testSuccess')}</p>
            )}
            {testResult === 'error' && (
              <p className="text-xs text-destructive">{t('configIntegrations.slack.testError')}</p>
            )}
          </div>

          <EventosDaIntegracao
            prefixo="slack"
            valor={selectedEvents}
            onChange={setSelectedEvents}
          />

          {/* Link documentação */}
          <a
            href="https://api.slack.com/messaging/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('configIntegrations.slack.linkDocs')}
            <IconExternal className="h-3 w-3" />
          </a>
      </div>
    </DialogShell>
  );
}
