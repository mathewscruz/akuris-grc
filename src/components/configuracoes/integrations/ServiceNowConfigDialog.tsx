/**
 * ServiceNow — abrir chamado na instância do cliente.
 *
 * A categoria ITSM tinha só Jira, e Jira é o ITSM de quem escreve software.
 * Banco, mineradora, telecom e utility correm ServiceNow, e para essas a
 * pergunta «isto abre chamado no nosso ServiceNow?» é a primeira do
 * questionário, não a última.
 *
 * A forma é a mesma do Jira: instância, credenciais, e um POST à Table API por
 * evento. A diferença que importa está na tabela de destino — `incident` não é
 * o mesmo que `sn_si_incident`, e mandar um achado de segurança para a fila de
 * suporte é a maneira mais rápida de ele ser fechado como duplicado.
 */
import { useState } from 'react';
import { IconExternal, IconSuccess, IconError, IconInfo } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { EventosDaIntegracao, TODOS_OS_EVENTOS } from './EventosDaIntegracao';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { getEventosDisponiveis } from '@/lib/integration-events';

const EVENTOS_DISPONIVEIS = getEventosDisponiveis();

interface ServiceNowConfigDialogProps {
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

/** As tabelas que fazem sentido receber um evento de GRC. */
const TABELAS = [
  { valor: 'incident', chave: 'tabelaIncident' },
  { valor: 'sn_si_incident', chave: 'tabelaSeguranca' },
  { valor: 'sn_grc_issue', chave: 'tabelaGrcIssue' },
  { valor: 'change_request', chave: 'tabelaMudanca' },
  { valor: 'sc_req_item', chave: 'tabelaRequisicao' },
];

export function ServiceNowConfigDialog({
  open,
  onOpenChange,
  empresaId,
  existingConfig,
  onSaved,
}: ServiceNowConfigDialogProps) {
  const { t } = useLanguage();
  const [instancia, setInstancia] = useState(
    (existingConfig?.configuracoes?.instance_url as string) || '',
  );
  const [utilizador, setUtilizador] = useState(
    (existingConfig?.configuracoes?.utilizador as string) || '',
  );
  const [senha, setSenha] = useState('');
  const [tabela, setTabela] = useState((existingConfig?.configuracoes?.tabela as string) || 'incident');
  const [categoria, setCategoria] = useState(
    (existingConfig?.configuracoes?.categoria as string) || 'inquiry',
  );
  const [eventos, setEventos] = useState<string[]>(
    (existingConfig?.configuracoes?.eventos as string[]) ?? TODOS_OS_EVENTOS,
  );
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<'success' | 'error' | null>(null);

  const testar = async () => {
    if (!instancia || !utilizador || !senha) {
      toast.error(t('configIntegrations.servicenow.toastCamposObrigatorios'), {
        description: t('configIntegrations.servicenow.toastCamposTeste'),
      });
      return;
    }

    setTestando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-integration-connection', {
        body: { tipo: 'servicenow', instance_url: instancia, utilizador, senha, tabela },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha no teste');

      setResultado('success');
      toast.success(t('configIntegrations.servicenow.toastConexaoOk'), {
        description: t('configIntegrations.servicenow.toastConexaoOkDesc'),
      });
    } catch (e) {
      setResultado('error');
      toast.error(t('configIntegrations.servicenow.toastConexaoFalha'), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setTestando(false);
    }
  };

  const guardar = async () => {
    if (!instancia || !utilizador) {
      toast.error(t('configIntegrations.servicenow.toastCamposObrigatorios'), {
        description: t('configIntegrations.servicenow.toastCamposTodos'),
      });
      return;
    }
    /* Numa configuração nova a senha é obrigatória; ao editar, deixar em branco
       significa «mantém a que já lá está» — e não «apaga». */
    if (!existingConfig && !senha) {
      toast.error(t('configIntegrations.servicenow.toastSenhaObrig'), {
        description: t('configIntegrations.servicenow.toastSenhaObrigDesc'),
      });
      return;
    }

    setSalvando(true);
    try {
      const dados = {
        empresa_id: empresaId,
        tipo_integracao: 'servicenow' as const,
        nome_exibicao: 'ServiceNow',
        webhook_url: instancia.replace(/\/+$/, ''),
        status: 'conectado',
        configuracoes: {
          instance_url: instancia.replace(/\/+$/, ''),
          utilizador,
          tabela,
          categoria,
          eventos,
          has_token: true,
        },
        ...(senha ? { credenciais_encrypted: JSON.stringify({ senha }) } : {}),
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

      toast.success(t('configIntegrations.servicenow.toastConfigurado'));
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(t('configIntegrations.servicenow.toastFalhaGuardar'), {
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
      title={t('configIntegrations.servicenow.titulo')}
      description={t('configIntegrations.servicenow.descricao')}
      onSubmit={guardar}
      isSubmitting={salvando}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sn-instancia">{t('configIntegrations.servicenow.campoInstancia')}</Label>
          <Input
            id="sn-instancia"
            value={instancia}
            onChange={(e) => setInstancia(e.target.value)}
            placeholder="https://suaempresa.service-now.com"
          />
          <p className="text-xs text-muted-foreground">
            {t('configIntegrations.servicenow.ajudaInstancia')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sn-utilizador">{t('configIntegrations.servicenow.campoUtilizador')}</Label>
            <Input
              id="sn-utilizador"
              value={utilizador}
              onChange={(e) => setUtilizador(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sn-senha">{t('configIntegrations.servicenow.campoSenha')}</Label>
            <Input
              id="sn-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              placeholder={existingConfig ? t('configIntegrations.servicenow.senhaGuardada') : ''}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sn-tabela">{t('configIntegrations.servicenow.campoTabela')}</Label>
          <Select value={tabela} onValueChange={setTabela}>
            <SelectTrigger id="sn-tabela">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABELAS.map((tb) => (
                <SelectItem key={tb.valor} value={tb.valor}>
                  {t(`configIntegrations.servicenow.${tb.chave}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('configIntegrations.servicenow.ajudaTabela')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sn-categoria">{t('configIntegrations.servicenow.campoCategoria')}</Label>
          <Input
            id="sn-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="inquiry"
          />
        </div>

        <EventosDaIntegracao
          prefixo="sn"
          valor={eventos}
          onChange={setEventos}
        />

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={testar} disabled={testando}>
            {testando ? <AkurisPulse /> : <IconExternal className="h-4 w-4" />}
            {t('configIntegrations.servicenow.testar')}
          </Button>
          {resultado === 'success' && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <IconSuccess className="h-4 w-4" />
              {t('configIntegrations.servicenow.testeOk')}
            </span>
          )}
          {resultado === 'error' && (
            <span className="flex items-center gap-1 text-sm text-destructive">
              <IconError className="h-4 w-4" />
              {t('configIntegrations.servicenow.testeFalhou')}
            </span>
          )}
        </div>

        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
          {t('configIntegrations.servicenow.notaConta')}
        </p>
      </div>
    </DialogShell>
  );
}
