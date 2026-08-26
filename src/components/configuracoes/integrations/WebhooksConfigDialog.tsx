import { useState, useEffect } from 'react';
import { IconAdd, IconDelete, IconSuccess, IconError, IconSend, IconLink } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { EventosDaIntegracao } from './EventosDaIntegracao';

interface WebhooksConfigDialogProps {
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

function getPayloadExemplo(exampleTitle: string): string {
  return `{
  "evento": "incidente_criado",
  "timestamp": "2025-01-01T12:00:00Z",
  "dados": {
    "id": "uuid",
    "titulo": "${exampleTitle}",
    "gravidade": "alto",
    "status": "aberto"
  },
  "empresa_id": "uuid"
}`;
}

export function WebhooksConfigDialog({
  open,
  onOpenChange,
  empresaId,
  existingConfig,
  onSaved
}: WebhooksConfigDialogProps) {
  const { t } = useLanguage();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setWebhookUrl(existingConfig?.webhook_url || '');
      setSelectedEvents(
        (existingConfig?.configuracoes?.eventos as string[]) || []
      );
      setCustomHeaders(
        (existingConfig?.configuracoes?.headers as { key: string; value: string }[]) || []
      );
      setTestResult(null);
      setSaving(false);
      setTesting(false);
    }
  }, [open, existingConfig]);

  const handleTestConnection = async () => {
    if (!webhookUrl) {
      toast.error(t('configIntegrations.webhooks.toastUrlObrig'), { description: t('configIntegrations.webhooks.toastUrlObrigDesc') });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-integration-connection', {
        body: {
          tipo: 'webhook',
          webhook_url: webhookUrl,
          headers: customHeaders.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {})
        }
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult('success');
        toast.success(t('configIntegrations.webhooks.toastTestOk'), {
          description: t('configIntegrations.webhooks.toastTestOkDesc')
        });
      } else {
        throw new Error(data?.error || 'Falha no teste');
      }
    } catch (error: any) {
      setTestResult('error');
      toast.error(t('configIntegrations.webhooks.toastTestFalha'), {
        description: error.message || t('configIntegrations.webhooks.toastTestFalhaDesc')
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl) {
      toast.error(t('configIntegrations.webhooks.toastUrlObrig'), { description: t('configIntegrations.webhooks.toastUrlObrigDesc') });
      return;
    }

    if (selectedEvents.length === 0) {
      toast.error(t('configIntegrations.webhooks.toastEventosObrig'), { description: t('configIntegrations.webhooks.toastEventosObrigDesc') });
      return;
    }

    setSaving(true);
    try {
      const configData = {
        empresa_id: empresaId,
        tipo_integracao: 'webhooks',
        nome_exibicao: 'Webhooks',
        webhook_url: webhookUrl,
        status: 'conectado',
        configuracoes: { 
          eventos: selectedEvents,
          headers: customHeaders.filter(h => h.key && h.value)
        }
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

      toast.success(t('configIntegrations.webhooks.toastConfigurado'), {
        description: t('configIntegrations.webhooks.toastConfiguradoDesc')
      });
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.webhooks.toastErroSalvar'), { description: error.message });
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

      toast.success(t('configIntegrations.webhooks.toastRemovido'));
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(t('configIntegrations.webhooks.toastErroRemover'), { description: error.message });
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

  const addHeader = () => {
    setCustomHeaders(prev => [...prev, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setCustomHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    setCustomHeaders(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
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
          {t('configIntegrations.webhooks.btnRemover')}
        </Button>
      )}
      <div className="flex gap-2 sm:ml-auto">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          {t('configIntegrations.webhooks.btnCancelar')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !webhookUrl || selectedEvents.length === 0}>
          {saving && <AkurisPulse size={16} className="mr-2" />}
          {t('configIntegrations.webhooks.btnSalvar')}
        </Button>
      </div>
    </div>
  );

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('configIntegrations.webhooks.title')}
      description={t('configIntegrations.webhooks.description')}
      icon={IconLink}
      size="lg"
      footer={footer}
      onSubmit={handleSave}
      isDirty={!!webhookUrl}
    >
      <div className="space-y-6">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhook-url">{t('configIntegrations.webhooks.fieldUrl')}</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                placeholder="https://your-system.com/webhook"
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
              <p className="text-xs text-success">{t('configIntegrations.webhooks.testSuccess')}</p>
            )}
            {testResult === 'error' && (
              <p className="text-xs text-destructive">{t('configIntegrations.webhooks.testError')}</p>
            )}
          </div>

          {/* Headers personalizados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('configIntegrations.webhooks.headersLabel')}</Label>
              <Button variant="outline" size="sm" onClick={addHeader}>
                <IconAdd className="h-3 w-3 mr-1" />
                {t('configIntegrations.webhooks.btnAdicionar')}
              </Button>
            </div>
            {customHeaders.length > 0 && (
              <div className="space-y-2">
                {customHeaders.map((header, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={t('configIntegrations.webhooks.headerKeyPlaceholder')}
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder={t('configIntegrations.webhooks.headerValuePlaceholder')}
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHeader(index)}
                    >
                      <IconDelete className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <EventosDaIntegracao
            prefixo="wh"
            valor={selectedEvents}
            onChange={setSelectedEvents}
          />

          {/* Exemplo de payload */}
          <div className="space-y-2">
            <Label htmlFor="webhook-payload">{t('configIntegrations.webhooks.payloadLabel')}</Label>
            <Textarea
              id="webhook-payload"
              value={getPayloadExemplo(t('sweepConfig.integracoes.webhooks.payloadExampleTitle'))}
              readOnly
              className="font-mono text-xs h-36"
            />
        </div>
      </div>
    </DialogShell>
  );
}
