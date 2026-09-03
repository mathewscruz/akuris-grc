/**
 * useDashboardLive — o painel atualiza-se sozinho quando o número muda.
 *
 * O cabeçalho tinha um botão "atualizar" e um carimbo "Atualizado às HH:MM".
 * Os dois foram removidos, e a razão é a mesma pela qual este ficheiro existe:
 * pedir a alguém que carregue num botão para ver a verdade é transferir para o
 * utilizador um trabalho que a máquina faz melhor — e o carimbo só servia para
 * confessar que o que estava no ecrã podia já não ser verdade.
 *
 * Três caminhos, porque nenhum sozinho cobre tudo:
 *
 *  1. **Realtime.** Uma linha mexida noutro módulo — ou por outra pessoa, ou
 *     noutro separador — invalida as consultas afectadas. As tabelas têm de
 *     estar na publicação `supabase_realtime`; ver a migration
 *     `20260821130000_painel_ao_vivo.sql`, que as põe lá. Sem ela a subscrição
 *     liga-se e nunca recebe nada.
 *
 *  2. **Regresso ao separador.** Se o Realtime estiver indisponível (rede,
 *     websocket bloqueado por um proxy), voltar ao separador reconsulta. É a
 *     rede de segurança que impede o ecrã de mentir indefinidamente.
 *
 *  3. **Entrada no painel.** Ao montar, invalida uma vez. Cobre o caso mais
 *     comum de todos: editar um risco em /riscos e voltar ao painel.
 *
 * A invalidação é agrupada num intervalo curto: uma importação de 500 linhas
 * dispara 500 eventos, e sem isto seriam 500 rondas de consultas.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

/**
 * Que consultas ficam velhas quando cada tabela muda.
 *
 * Faltar uma chave aqui é o mesmo defeito que a lista do botão "atualizar"
 * tinha: o ecrã mostra um número velho sem nenhum aviso.
 */
const CONSULTAS_POR_TABELA: Record<string, readonly string[]> = {
  riscos: ['riscos-stats', 'dashboard-stats', 'riscos-timeline', 'recent-activities'],
  riscos_historico_avaliacoes: ['riscos-timeline'],
  controles: ['controles-stats', 'dashboard-stats', 'recent-activities'],
  ativos: ['ativos-stats'],
  incidentes: ['incidentes-stats', 'dashboard-stats'],
  documentos: ['documentos-stats', 'dashboard-stats', 'recent-activities'],
  contratos: ['contratos-stats'],
  denuncias: ['denuncias-stats', 'dashboard-stats', 'recent-activities'],
  planos_acao: ['planos-acao-stats', 'dashboard-stats', 'minhas-pendencias-planos'],
  due_diligence_assessments: ['due-diligence-stats'],
  gap_analysis_evaluations: [
    'gap-analysis-stats',
    'dashboard-stats',
    'frameworks-overview',
    'maturity-trend',
  ],
  projeto_tarefas: ['minhas-pendencias-projeto'],
};

/** `projeto_tarefas` não tem `empresa_id` — o inquilino vem pelo projeto. */
const SEM_EMPRESA_ID = new Set(['projeto_tarefas']);

/** Janela de agrupamento. Curta o bastante para parecer imediato. */
const AGRUPAR_MS = 600;

export function useDashboardLive() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!empresaId) return;

    const todasAsChaves = Array.from(
      new Set(Object.values(CONSULTAS_POR_TABELA).flat()),
    );

    const invalidar = (chaves: readonly string[]) => {
      chaves.forEach((chave) => queryClient.invalidateQueries({ queryKey: [chave] }));
    };

    /* Agrupa os eventos: uma importação em massa não pode virar uma consulta
       por linha inserida. */
    let pendentes = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const agendar = (chaves: readonly string[]) => {
      chaves.forEach((c) => pendentes.add(c));
      if (timer) return;
      timer = setTimeout(() => {
        const lote = Array.from(pendentes);
        pendentes = new Set();
        timer = null;
        invalidar(lote);
      }, AGRUPAR_MS);
    };

    // O encerramento de um canal é assíncrono. Um identificador por montagem
    // evita que o StrictMode recupere um canal anterior já inscrito antes que
    // a limpeza termine.
    const channelId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const canal = supabase.channel(`painel-${empresaId}-${channelId}`);

    Object.entries(CONSULTAS_POR_TABELA).forEach(([tabela, chaves]) => {
      canal.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tabela,
          // Filtrar no servidor poupa tráfego a todos os separadores abertos.
          // Onde a coluna não existe fica sem filtro: o RLS já isola o
          // inquilino, o filtro só evita entregar o que seria descartado.
          ...(SEM_EMPRESA_ID.has(tabela) ? {} : { filter: `empresa_id=eq.${empresaId}` }),
        },
        () => agendar(chaves),
      );
    });

    canal.subscribe();

    // Rede de segurança: voltar ao separador reconsulta tudo.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') invalidar(todasAsChaves);
    };
    document.addEventListener('visibilitychange', aoVoltar);

    // E ao entrar no painel, uma vez — o caso de longe mais comum é editar
    // noutro módulo e voltar aqui.
    invalidar(todasAsChaves);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
      void supabase.removeChannel(canal);
    };
  }, [empresaId, queryClient]);
}
