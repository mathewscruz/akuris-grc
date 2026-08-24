/**
 * O que esta pessoa já viu no sino.
 *
 * As notificações calculadas — documentos vencidos, contratos a expirar,
 * controlos por avaliar — não existem em tabela nenhuma: nascem de uma consulta
 * a cada abertura do painel. O estado «lida» delas vivia em `localStorage`,
 * numa chave sem dono:
 *
 *  · era por navegador, não por pessoa — ler no portátil não fazia nada no
 *    telemóvel, e duas pessoas na mesma máquina partilhavam o estado;
 *  · desaparecia com qualquer limpeza do navegador;
 *  · e só marcava ao CLICAR. Abrir o painel, ler tudo e fechar não marcava
 *    nada — que é exactamente a queixa: «notificações que eu já vi aparecem
 *    de novo».
 *
 * Passa para a base, por pessoa. E marca-se ao VER, não ao clicar: um sino que
 * continua vermelho depois de a pessoa ter lido tudo é um sino que se aprende
 * a ignorar.
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';

/** A chave antiga, para trazer o que já estava marcado antes de mudarmos. */
const CHAVE_ANTIGA = 'readAutomaticNotifications';

export function useNotificacoesLidas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const chaveDaConsulta = ['notificacoes-lidas', user?.id];

  const { data: lidas = new Set<string>() } = useQuery({
    queryKey: chaveDaConsulta,
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      /*
        Migração silenciosa do que estava no navegador. Corre uma vez: depois
        de subir, a chave antiga é apagada e nunca mais se olha para ela.
      */
      try {
        const guardado = localStorage.getItem(CHAVE_ANTIGA);
        if (guardado) {
          const antigas = JSON.parse(guardado) as string[];
          if (Array.isArray(antigas) && antigas.length > 0) {
            await supabase.rpc('marcar_notificacoes_lidas', {
              p_chaves: antigas.slice(0, 500),
            });
          }
          localStorage.removeItem(CHAVE_ANTIGA);
        }
      } catch {
        /* localStorage indisponível ou conteúdo estragado: não impede o resto. */
      }

      const { data, error } = await supabase
        .from('notificacoes_lidas')
        .select('chave');
      if (error) throw error;
      return new Set((data ?? []).map((l) => l.chave));
    },
  });

  /**
   * Marca em lote. Devolve sem esperar quando não há nada de novo — abrir o
   * painel dez vezes seguidas não deve dar dez pedidos iguais.
   */
  const marcarLidas = useCallback(
    async (chaves: string[]) => {
      const novas = chaves.filter((c) => c && !lidas.has(c));
      if (novas.length === 0) return;

      /* Optimista: o sino apaga-se já, e o pedido confirma a seguir. */
      queryClient.setQueryData(chaveDaConsulta, (atual: Set<string> | undefined) => {
        const proximo = new Set(atual ?? []);
        novas.forEach((c) => proximo.add(c));
        return proximo;
      });

      const { error } = await supabase.rpc('marcar_notificacoes_lidas', {
        p_chaves: novas.slice(0, 500),
      });
      if (error) {
        logger.error('Falha ao marcar notificações como lidas', {
          module: 'notifications',
          error: error.message,
        });
        /* Devolve o estado: um sino que mente é pior do que um sino aceso. */
        queryClient.invalidateQueries({ queryKey: chaveDaConsulta });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lidas, queryClient, user?.id],
  );

  return { lidas, marcarLidas };
}
