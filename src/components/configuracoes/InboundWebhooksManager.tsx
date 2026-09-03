import { useState, useEffect } from 'react';
import { IconAdd, IconDelete, IconSend, IconLink, IconCopy, IconCode } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { exigirEscrita } from '@/lib/supabase-write';
interface InboundWebhook {
  id: string;
  nome: string;
  descricao: string | null;
  webhook_token: string;
  tipo_evento: string;
  modulo_destino: string;
  mapeamento_campos: Record<string, string>;
  ativo: boolean;
  total_recebidos: number;
  ultimo_recebimento: string | null;
  created_at: string;
}

const MODULOS_DESTINO_KEYS = [
  { value: 'incidentes', key: 'incidentes' },
  { value: 'riscos', key: 'riscos' },
  { value: 'ativos', key: 'ativos' },
  { value: 'controles', key: 'controles' },
  { value: 'denuncias', key: 'denuncias' },
];

const TIPOS_EVENTO_KEYS = [
  { value: 'siem_alert', key: 'siemAlert' },
  { value: 'vulnerability_scan', key: 'vulnerabilityScan' },
  { value: 'asset_discovery', key: 'assetDiscovery' },
  { value: 'compliance_finding', key: 'complianceFinding' },
  { value: 'custom', key: 'custom' },
];

function getPayloadExamples(t: (key: string) => string): Record<string, object> {
  return {
    incidentes: {
      title: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.incidentes.title'),
      description: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.incidentes.description'),
      severity: "critical",
      type: "seguranca",
      source: "SIEM-Splunk"
    },
    riscos: {
      title: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.riscos.title'),
      description: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.riscos.description'),
      severity: "high",
      category: "Tecnologia",
      probability: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.riscos.probability'),
      impact: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.riscos.impact')
    },
    ativos: {
      name: "DESKTOP-NEW001",
      type: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.ativos.type'),
      description: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.ativos.description'),
      hostname: "srv-prod-05"
    },
    controles: {
      title: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.controles.title'),
      description: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.controles.description'),
      type: "detectivo",
      severity: "medium",
      frequency: "diario"
    },
    denuncias: {
      title: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.denuncias.title'),
      description: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.denuncias.description'),
      severity: "high",
      anonymous: true,
      source: "canal-externo"
    }
  };
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'wh_';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function InboundWebhooksManager() {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const PAYLOAD_EXAMPLES = getPayloadExamples(t);
  const MODULOS_DESTINO = MODULOS_DESTINO_KEYS.map(m => ({ value: m.value, label: t(`configGeral.inboundWebhooks.modulos.${m.key}`) }));
  const TIPOS_EVENTO = TIPOS_EVENTO_KEYS.map(m => ({ value: m.value, label: t(`configGeral.inboundWebhooks.tiposEvento.${m.key}`) }));
  const [webhooks, setWebhooks] = useState<InboundWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoEvento, setTipoEvento] = useState('');
  const [moduloDestino, setModuloDestino] = useState('');
  const [saving, setSaving] = useState(false);

  const baseUrl = `https://lnlkahtugwmkznasapfd.supabase.co/functions/v1/api-inbound-webhook`;

  useEffect(() => {
    if (empresaId) fetchWebhooks();
  }, [empresaId]);

  const fetchWebhooks = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from('api_inbound_webhooks')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setWebhooks((data || []) as InboundWebhook[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!empresaId || !nome.trim() || !tipoEvento || !moduloDestino) return;
    setSaving(true);
    try {
      const token = generateToken();
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('api_inbound_webhooks').insert({
        empresa_id: empresaId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        webhook_token: token,
        tipo_evento: tipoEvento,
        modulo_destino: moduloDestino,
        created_by: userData.user?.id,
      });

      if (error) throw error;
      toast.success(t('configGeral.inboundWebhooks.toastCreated'), { description: t('configGeral.inboundWebhooks.toastCreatedDescription') });
      setDialogOpen(false);
      setNome('');
      setDescricao('');
      setTipoEvento('');
      setModuloDestino('');
      fetchWebhooks();
    } catch (err: any) {
      toast.error(t('configGeral.inboundWebhooks.toastCreateError'), { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    try {
      await exigirEscrita(supabase.from('api_inbound_webhooks').update({ ativo }).eq('id', id));
      fetchWebhooks();
      toast.success(ativo ? t('configGeral.inboundWebhooks.toastActivated') : t('configGeral.inboundWebhooks.toastDeactivated'));
    } catch (err: any) {
      toast.error(t('configGeral.inboundWebhooks.toastToggleError'), { description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    await exigirEscrita(supabase.from('api_inbound_webhooks').delete().eq('id', id));
    setDeleteConfirm(null);
    fetchWebhooks();
    toast.success(t('configGeral.inboundWebhooks.toastDeleted'));
  };

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${baseUrl}?token=${token}`);
    toast.info(t('configGeral.inboundWebhooks.toastUrlCopied'));
  };

  const handleTestWebhook = async (wh: InboundWebhook) => {
    setTestingWebhook(wh.id);
    try {
      const payload = PAYLOAD_EXAMPLES[wh.modulo_destino] || { title: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.default.title'), description: t('sweepConfig.integracoes.inboundWebhooks.payloadExamples.default.description') };
      
      const response = await fetch(`${baseUrl}?token=${wh.webhook_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(t('configGeral.inboundWebhooks.toastTestSuccess'), { description: t('configGeral.inboundWebhooks.toastTestSuccessDescription').replace('{modulo}', wh.modulo_destino) });
        fetchWebhooks();
      } else {
        const err = await response.json();
        toast.error(t('configGeral.inboundWebhooks.toastTestError'), { description: err.error || t('configGeral.inboundWebhooks.toastTestErrorDescriptionDefault') });
      }
    } catch (err: any) {
      toast.error(t('configGeral.inboundWebhooks.toastError'), { description: err.message });
    } finally {
      setTestingWebhook(null);
    }
  };

  const getPayloadForModule = (modulo: string) => {
    return JSON.stringify(PAYLOAD_EXAMPLES[modulo] || {}, null, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('configGeral.inboundWebhooks.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('configGeral.inboundWebhooks.description')}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <IconAdd className="h-4 w-4" /> {t('configGeral.inboundWebhooks.newButton')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><AkurisPulse size={24} /></div>
      ) : webhooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <IconLink className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t('configGeral.inboundWebhooks.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('configGeral.inboundWebhooks.emptyHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('configGeral.inboundWebhooks.tableName')}</TableHead>
                <TableHead>{t('configGeral.inboundWebhooks.tableType')}</TableHead>
                <TableHead>{t('configGeral.inboundWebhooks.tableDestination')}</TableHead>
                <TableHead>{t('configGeral.inboundWebhooks.tableUrl')}</TableHead>
                <TableHead>{t('configGeral.inboundWebhooks.tableReceived')}</TableHead>
                <TableHead>{t('configGeral.inboundWebhooks.tableStatus')}</TableHead>
                <TableHead className="w-[140px]">{t('configGeral.inboundWebhooks.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map(wh => (
                <TableRow key={wh.id}>
                  <TableCell className="font-medium">{wh.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {TIPOS_EVENTO.find(t => t.value === wh.tipo_evento)?.label || wh.tipo_evento}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {MODULOS_DESTINO.find(m => m.value === wh.modulo_destino)?.label || wh.modulo_destino}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="text-micro bg-muted px-1 py-0.5 rounded max-w-[200px] truncate">
                        {baseUrl}?token={wh.webhook_token.substring(0, 8)}...
                      </code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyUrl(wh.webhook_token)}>
                        <IconCopy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{wh.total_recebidos?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Switch checked={wh.ativo} onCheckedChange={v => handleToggle(wh.id, v)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={t('configGeral.inboundWebhooks.actionViewPayload')}
                        onClick={() => setPayloadDialogOpen(wh.modulo_destino)}
                      >
                        <IconCode className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={t('configGeral.inboundWebhooks.actionSendTest')}
                        disabled={testingWebhook === wh.id || !wh.ativo}
                        onClick={() => handleTestWebhook(wh)}
                      >
                        {testingWebhook === wh.id ? (
                          <AkurisPulse size={14} />
                        ) : (
                          <IconSend className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(wh.id)}>
                        <IconDelete className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <DialogShell
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t('configGeral.inboundWebhooks.newDialogTitle')}
        icon={IconLink}
        size="md"
        onSubmit={handleCreate}
        submitLabel={t('configGeral.inboundWebhooks.createButton')}
        submitDisabled={!nome.trim() || !tipoEvento || !moduloDestino || saving}
        isSubmitting={saving}
        isDirty={!!(nome || descricao || tipoEvento || moduloDestino)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">{t('configGeral.inboundWebhooks.labelName')}</Label>
            <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder={t('configGeral.inboundWebhooks.placeholderName')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">{t('configGeral.inboundWebhooks.labelDescription')}</Label>
            <Textarea id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder={t('configGeral.inboundWebhooks.placeholderDescription')} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>{t('configGeral.inboundWebhooks.labelEventType')}</Label>
            <Select value={tipoEvento} onValueChange={setTipoEvento}>
              <SelectTrigger><SelectValue placeholder={t('configGeral.inboundWebhooks.placeholderSelect')} /></SelectTrigger>
              <SelectContent>
                {TIPOS_EVENTO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('configGeral.inboundWebhooks.labelDestinationModule')}</Label>
            <Select value={moduloDestino} onValueChange={setModuloDestino}>
              <SelectTrigger><SelectValue placeholder={t('configGeral.inboundWebhooks.placeholderDestinationModule')} /></SelectTrigger>
              <SelectContent>
                {MODULOS_DESTINO.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {moduloDestino && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('configGeral.inboundWebhooks.expectedPayloadLabel').replace('{modulo}', MODULOS_DESTINO.find(m => m.value === moduloDestino)?.label || '')}</Label>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto font-mono">
                {getPayloadForModule(moduloDestino)}
              </pre>
            </div>
          )}
        </div>
      </DialogShell>

      {/* Payload Example Dialog */}
      <DialogShell
        open={!!payloadDialogOpen}
        onOpenChange={(o) => !o && setPayloadDialogOpen(null)}
        title={t('configGeral.inboundWebhooks.payloadDialogTitle')}
        icon={IconCode}
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(payloadDialogOpen ? getPayloadForModule(payloadDialogOpen) : '');
                toast.info(t('cardsKpi.sweep.sistema.payloadCopiado'));
              }}
            >
              <IconCopy className="h-4 w-4 mr-2" /> {t('configGeral.inboundWebhooks.copyButton')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground mb-2">
          {t('configGeral.inboundWebhooks.payloadDialogDescription')}
        </p>
        <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto font-mono">
          {payloadDialogOpen ? getPayloadForModule(payloadDialogOpen) : ''}
        </pre>
        <p className="text-xs text-muted-foreground mt-3">
          {t('configGeral.inboundWebhooks.payloadFieldsHint')}
        </p>
      </DialogShell>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title={t('configGeral.inboundWebhooks.deleteDialogTitle')}
        description={t('configGeral.inboundWebhooks.deleteDialogDescription')}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}
