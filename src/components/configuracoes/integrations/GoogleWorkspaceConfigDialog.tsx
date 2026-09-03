/**
 * Google Workspace — o diretório de quem não corre Microsoft.
 *
 * O formulário aceita o JSON inteiro da conta de serviço, colado tal como o
 * Google o entrega. Podia pedir os campos um a um, e seria pior: `private_key`
 * tem quebras de linha e mais de mil e seiscentos caracteres, e copiá-la à mão
 * de dentro do JSON é a forma mais rápida de a partir sem perceber porquê.
 *
 * O campo que a configuração costuma errar não é a chave — é o e-mail de
 * administrador. A conta de serviço não vê o diretório por si: age em nome de
 * alguém, e sem esse alguém o Google devolve `unauthorized_client` com uma
 * mensagem que não ajuda. Por isso está aqui como campo próprio, com a razão
 * escrita ao lado.
 */
import { useState } from 'react';
import { IconExternal, IconSuccess, IconError, IconInfo } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  existingConfig?: {
    id: string;
    configuracoes: Record<string, unknown>;
    status: string;
  };
  onSaved: () => void;
}

/** Extrai o par que interessa do JSON da conta de serviço. */
function lerContaDeServico(texto: string): { client_email: string; private_key: string } | null {
  try {
    const j = JSON.parse(texto);
    if (typeof j?.client_email === 'string' && typeof j?.private_key === 'string') {
      return { client_email: j.client_email, private_key: j.private_key };
    }
  } catch {
    /* Não é JSON — cai no aviso do formulário. */
  }
  return null;
}

export function GoogleWorkspaceConfigDialog({
  open,
  onOpenChange,
  empresaId,
  existingConfig,
  onSaved,
}: Props) {
  const { t } = useLanguage();
  const [contaJson, setContaJson] = useState('');
  const [adminEmail, setAdminEmail] = useState(
    (existingConfig?.configuracoes?.admin_email as string) || '',
  );
  const [cliente, setCliente] = useState(
    (existingConfig?.configuracoes?.customer as string) || 'my_customer',
  );
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<'success' | 'error' | null>(null);

  const conta = contaJson.trim() ? lerContaDeServico(contaJson) : null;
  const jsonInvalido = contaJson.trim().length > 0 && conta === null;

  const testar = async () => {
    if (!conta || !adminEmail) {
      toast.error(t('configIntegrations.google.toastCamposObrigatorios'), {
        description: t('configIntegrations.google.toastCamposTeste'),
      });
      return;
    }

    setTestando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('google-workspace', {
        body: {
          action: 'test',
          client_email: conta.client_email,
          private_key: conta.private_key,
          admin_email: adminEmail,
          customer: cliente,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha no teste');

      setResultado('success');
      toast.success(t('configIntegrations.google.toastConexaoOk'));
    } catch (e) {
      setResultado('error');
      toast.error(t('configIntegrations.google.toastConexaoFalha'), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setTestando(false);
    }
  };

  const guardar = async () => {
    if (!adminEmail) {
      toast.error(t('configIntegrations.google.toastCamposObrigatorios'), {
        description: t('configIntegrations.google.toastAdminObrig'),
      });
      return;
    }
    /* Numa configuração nova a conta de serviço é obrigatória; ao editar,
       deixar em branco mantém a que já está gravada. */
    if (!existingConfig && !conta) {
      toast.error(t('configIntegrations.google.toastCamposObrigatorios'), {
        description: t('configIntegrations.google.toastContaObrig'),
      });
      return;
    }

    setSalvando(true);
    try {
      const dados = {
        empresa_id: empresaId,
        tipo_integracao: 'google_workspace' as const,
        nome_exibicao: 'Google Workspace',
        webhook_url: 'https://admin.googleapis.com/admin/directory/v1',
        status: 'conectado',
        configuracoes: {
          admin_email: adminEmail,
          customer: cliente || 'my_customer',
          /* O e-mail da conta de serviço não é segredo e ajuda a reconhecer a
             configuração; a chave privada nunca sai de credenciais. */
          client_email:
            conta?.client_email ?? (existingConfig?.configuracoes?.client_email as string) ?? null,
          has_token: true,
        },
        ...(conta ? { credenciais_encrypted: JSON.stringify(conta) } : {}),
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from('integracoes_config')
          .update({ ...dados, updated_at: new Date().toISOString() })
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('integracoes_config').insert(dados);
        if (error) throw error;
      }

      toast.success(t('configIntegrations.google.toastConfigurado'));
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(t('configIntegrations.google.toastFalhaGuardar'), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('configIntegrations.google.titulo')}
      description={t('configIntegrations.google.descricao')}
      onSubmit={guardar}
      isSubmitting={salvando}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gw-conta">{t('configIntegrations.google.campoConta')}</Label>
          <Textarea
            id="gw-conta"
            rows={5}
            value={contaJson}
            onChange={(e) => setContaJson(e.target.value)}
            placeholder={
              existingConfig
                ? t('configIntegrations.google.contaGuardada')
                : '{ "type": "service_account", "client_email": "...", "private_key": "..." }'
            }
            className="font-mono text-xs"
            aria-invalid={jsonInvalido || undefined}
          />
          {jsonInvalido && (
            <p className="text-xs text-destructive">{t('configIntegrations.google.jsonInvalido')}</p>
          )}
          {conta && (
            <p className="text-xs text-muted-foreground">
              {t('configIntegrations.google.contaLida', { email: conta.client_email })}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="gw-admin">{t('configIntegrations.google.campoAdmin')}</Label>
          <Input
            id="gw-admin"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@suaempresa.com"
          />
          <p className="text-xs text-muted-foreground">
            {t('configIntegrations.google.ajudaAdmin')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gw-cliente">{t('configIntegrations.google.campoCliente')}</Label>
          <Input id="gw-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {t('configIntegrations.google.ajudaCliente')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={testar} disabled={testando}>
            {testando ? <AkurisPulse /> : <IconExternal className="h-4 w-4" />}
            {t('configIntegrations.google.testar')}
          </Button>
          {resultado === 'success' && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <IconSuccess className="h-4 w-4" />
              {t('configIntegrations.google.testeOk')}
            </span>
          )}
          {resultado === 'error' && (
            <span className="flex items-center gap-1 text-sm text-destructive">
              <IconError className="h-4 w-4" />
              {t('configIntegrations.google.testeFalhou')}
            </span>
          )}
        </div>

        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
          {t('configIntegrations.google.notaDelegacao')}
        </p>
      </div>
    </DialogShell>
  );
}
