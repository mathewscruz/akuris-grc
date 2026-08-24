/**
 * Trazer a lista de acessos do diretório, em vez de a digitar.
 *
 * Em Revisão de Acessos tudo era escrito à mão — não havia sequer importação de
 * ficheiro. Numa empresa de duzentas pessoas isso não se faz uma vez por
 * trimestre: faz-se uma vez, e o que se revê passa a ser a lista de há um ano.
 * Uma revisão sobre dados velhos é pior do que nenhuma, porque dá o carimbo sem
 * dar a garantia.
 *
 * Só aparece o que está ligado. Um botão que falha sempre ensina a pessoa a
 * ignorar aquele canto do ecrã — e quem tem os dois diretórios ligados vê os
 * dois, porque são listas diferentes e sincronizar cada uma é decisão separada.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconRefresh } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface Props {
  onSincronizado: () => void;
}

/** Cada diretório: como está gravado, que função o traz, e como se chama. */
const DIRETORIOS = [
  { tipo: 'azure', funcao: 'azure-integration', rotulo: 'entraId' },
  { tipo: 'google_workspace', funcao: 'google-workspace', rotulo: 'google' },
] as const;

export function SincronizarDiretorio({ onSincronizado }: Props) {
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const [emCurso, setEmCurso] = useState<string | null>(null);

  const { data: ligados = [] } = useQuery({
    queryKey: ['diretorios-ligados', empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integracoes_config')
        .select('tipo_integracao')
        .eq('empresa_id', empresaId!)
        .eq('status', 'conectado')
        .in(
          'tipo_integracao',
          DIRETORIOS.map((d) => d.tipo),
        );
      if (error) throw error;
      return (data ?? []).map((c) => c.tipo_integracao);
    },
  });

  const sincronizar = async (dir: (typeof DIRETORIOS)[number]) => {
    setEmCurso(dir.tipo);
    try {
      const { data, error } = await supabase.functions.invoke(dir.funcao, {
        body: { action: 'sync_usuarios' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'falha');

      /*
        O resumo diz as três coisas separadas de propósito. «12 sincronizados»
        esconde que 3 foram desactivados, que é a linha que interessa a quem
        revê acessos.
      */
      toast.success(
        t('revisaoAcessosComp.sincronizar.toastOk', {
          criados: data.criados,
          atualizados: data.atualizados,
          desativados: data.desativados,
        }),
      );
      if (data.mfa_verificado === false) {
        /*
          A coluna de MFA vazia tem duas causas opostas — ninguém falha, ou não
          houve permissão para olhar. Calar-se aqui deixava a segunda passar por
          primeira. Só o Entra chega aqui: no Google o segundo fator vem no
          mesmo pedido dos utilizadores.
        */
        toast.info(t('revisaoAcessosComp.sincronizar.semPermissaoMfa'));
      }
      onSincronizado();
    } catch (e) {
      logger.error('Falha ao sincronizar diretório', {
        module: 'revisao-acessos',
        error: e instanceof Error ? e.message : String(e),
      });
      /*
        A mensagem do provedor NÃO vem para o toast.

        O Entra devolve coisas como «AADSTS90002: Tenant … not found» com trace
        id e correlation id — oito linhas que ninguém lê em dois segundos, e que
        empurram para fora o único texto acionável. O erro inteiro já fica
        gravado em `integracoes_webhook_logs`, que tem visor próprio em
        Configurações › Integrações › Histórico. O toast diz o que aconteceu e
        onde ver; o detalhe fica onde se pode ler com calma.
      */
      toast.error(t('revisaoAcessosComp.sincronizar.toastFalha'), {
        description: t('revisaoAcessosComp.sincronizar.verHistorico'),
      });
    } finally {
      setEmCurso(null);
    }
  };

  const disponiveis = DIRETORIOS.filter((d) => ligados.includes(d.tipo));
  if (disponiveis.length === 0) return null;

  return (
    <>
      {disponiveis.map((dir) => (
        <Button
          key={dir.tipo}
          variant="outline"
          onClick={() => sincronizar(dir)}
          disabled={emCurso !== null}
        >
          <IconRefresh className={`mr-2 h-4 w-4 ${emCurso === dir.tipo ? 'animate-spin' : ''}`} />
          {emCurso === dir.tipo
            ? t('revisaoAcessosComp.sincronizar.sincronizando')
            : t(`revisaoAcessosComp.sincronizar.botao.${dir.rotulo}`)}
        </Button>
      ))}
    </>
  );
}
