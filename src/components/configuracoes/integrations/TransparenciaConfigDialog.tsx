/**
 * Portal da Transparência — as listas restritivas na Due Diligence.
 *
 * Sem esta chave, a consulta de fornecedor devolve o cadastro da Receita e diz,
 * com todas as letras, que CEIS, CNEP e acordos de leniência **não foram
 * verificados**. É deliberado: dizer «sem sanções» sem ter procurado é a pior
 * resposta que uma diligência pode dar, e quem lê só vê a cor do selo.
 *
 * A chave é gratuita e nominal — o Portal manda-a por e-mail depois de um
 * registo. Fica aqui porque é da empresa, não do Akuris: é a ela que a consulta
 * é imputada.
 */
import { useState } from 'react';
import { IconExternal, IconSuccess, IconError, IconInfo } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

/** CNPJ da Presidência da República — existe, é público, e serve de sonda. */
const CNPJ_SONDA = '00394411000109';

export function TransparenciaConfigDialog({
  open,
  onOpenChange,
  empresaId,
  existingConfig,
  onSaved,
}: Props) {
  const { t } = useLanguage();
  const [chave, setChave] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<'success' | 'error' | null>(null);

  /*
    O teste é a própria consulta.

    Guardar primeiro e descobrir na primeira diligência que a chave está errada
    seria descobri-lo no pior momento possível — com o ecrã a dizer «não
    verificado» e ninguém a saber porquê.
  */
  const testar = async () => {
    if (!chave) {
      toast.error(t('configIntegrations.transparencia.toastChaveObrig'));
      return;
    }

    setTestando(true);
    setResultado(null);
    try {
      /* Grava antes de sondar: a função de borda lê a chave da configuração, e
         não a aceita pelo corpo do pedido — de propósito. */
      await gravar(chave, 'testando');

      const { data, error } = await supabase.functions.invoke('consultar-cnpj', {
        body: { cnpj: CNPJ_SONDA },
      });
      if (error) throw error;

      if (data?.sancoes?.verificado) {
        setResultado('success');
        await gravar(chave, 'conectado');
        toast.success(t('configIntegrations.transparencia.toastOk'));
        onSaved();
      } else {
        setResultado('error');
        toast.error(t('configIntegrations.transparencia.toastFalha'), {
          description: t('configIntegrations.transparencia.toastFalhaDesc'),
        });
      }
    } catch (e) {
      setResultado('error');
      toast.error(t('configIntegrations.transparencia.toastFalha'), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setTestando(false);
    }
  };

  const gravar = async (valor: string, status: string) => {
    const dados = {
      empresa_id: empresaId,
      tipo_integracao: 'transparencia' as const,
      nome_exibicao: 'Portal da Transparência',
      status,
      configuracoes: { has_token: true },
      credenciais_encrypted: JSON.stringify({ chave_api: valor }),
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
  };

  const guardar = async () => {
    if (!chave && !existingConfig) {
      toast.error(t('configIntegrations.transparencia.toastChaveObrig'));
      return;
    }
    if (!chave) {
      onOpenChange(false);
      return;
    }

    setSalvando(true);
    try {
      await gravar(chave, 'conectado');
      toast.success(t('configIntegrations.transparencia.toastGuardado'));
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(t('configIntegrations.transparencia.toastFalhaGuardar'), {
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
      title={t('configIntegrations.transparencia.titulo')}
      description={t('configIntegrations.transparencia.descricao')}
      onSubmit={guardar}
      isSubmitting={salvando}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tr-chave">{t('configIntegrations.transparencia.campoChave')}</Label>
          <Input
            id="tr-chave"
            type="password"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            autoComplete="new-password"
            placeholder={
              existingConfig ? t('configIntegrations.transparencia.chaveGuardada') : ''
            }
          />
          <a
            href="https://api.portaldatransparencia.gov.br/api-de-dados/cadastrar-email"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <IconExternal className="h-3.5 w-3.5" />
            {t('configIntegrations.transparencia.comoObter')}
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={testar} disabled={testando || !chave}>
            {testando ? <AkurisPulse /> : <IconExternal className="h-4 w-4" />}
            {t('configIntegrations.transparencia.testar')}
          </Button>
          {resultado === 'success' && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <IconSuccess className="h-4 w-4" />
              {t('configIntegrations.transparencia.testeOk')}
            </span>
          )}
          {resultado === 'error' && (
            <span className="flex items-center gap-1 text-sm text-destructive">
              <IconError className="h-4 w-4" />
              {t('configIntegrations.transparencia.testeFalhou')}
            </span>
          )}
        </div>

        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
          {t('configIntegrations.transparencia.notaSemChave')}
        </p>
      </div>
    </DialogShell>
  );
}
